"""Core orchestrator — creates workflows, dispatches Celery chains, deduplicates triggers."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_agent import (
    AIAgentConfig, OrchestrationWorkflow, AgentTask,
    WorkflowStatus, TaskStatus, TriggerType, AgentTaskType, FunctionalType,
)
from app.models.whatsapp import WhatsAppConversation, ConversationHandler
from app.models.patient import Patient


async def can_dispatch(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    conversation_id: uuid.UUID | None = None,
    patient_id: uuid.UUID | None = None,
) -> tuple[bool, str]:
    """Check if orchestration can proceed for this lead.

    Returns (can_proceed, reason).
    """
    # Check conversation handler status
    if conversation_id:
        result = await db.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.id == conversation_id,
                WhatsAppConversation.clinic_id == clinic_id,
            )
        )
        conv = result.scalar_one_or_none()
        if conv:
            if conv.handled_by == ConversationHandler.HUMAN:
                return False, "conversation_human_handled"
            if conv.ai_opt_out:
                return False, "conversation_opted_out"

    # Check patient opt-out and rate limits
    if patient_id:
        result = await db.execute(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.clinic_id == clinic_id,
            )
        )
        patient = result.scalar_one_or_none()
        if patient:
            if patient.ai_opt_out:
                return False, "patient_opted_out"

    return True, "ok"


async def check_rate_limit(
    db: AsyncSession,
    patient_id: uuid.UUID,
    agent_config: AIAgentConfig,
) -> bool:
    """Check if the patient has exceeded their daily AI message rate limit."""
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.clinic_id == agent_config.clinic_id,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        return True  # No patient = no limit to check
    return patient.ai_message_count_today < agent_config.rate_limit_messages


async def is_duplicate_trigger(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    trigger_type: TriggerType,
    trigger_entity_id: uuid.UUID,
) -> bool:
    """Check if a workflow already exists for this trigger.

    WhatsApp webhooks can be retried after a workflow completes. Dedupe across
    every workflow state so a previously handled message does not generate a
    second AI response.
    """
    result = await db.execute(
        select(OrchestrationWorkflow).where(
            OrchestrationWorkflow.clinic_id == clinic_id,
            OrchestrationWorkflow.trigger_type == trigger_type,
            OrchestrationWorkflow.trigger_entity_id == trigger_entity_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def get_active_agent(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    functional_type: FunctionalType,
    conversation_id: uuid.UUID | None = None,
) -> AIAgentConfig | None:
    """Get the active agent config for a given functional type.

    If `conversation_id` is provided and the conversation has an explicit
    `enabled_agents` allowlist, the agent's `persona_id` must be in it.
    NULL allowlist = inherit clinic defaults (all is_active agents allowed).
    """
    result = await db.execute(
        select(AIAgentConfig).where(
            AIAgentConfig.clinic_id == clinic_id,
            AIAgentConfig.functional_type == functional_type,
            AIAgentConfig.is_active == True,  # noqa: E712
        )
    )
    agent = result.scalar_one_or_none()
    if not agent or not conversation_id:
        return agent

    conv_result = await db.execute(
        select(WhatsAppConversation.enabled_agents).where(
            WhatsAppConversation.id == conversation_id,
            WhatsAppConversation.clinic_id == clinic_id,
        )
    )
    enabled = conv_result.scalar_one_or_none()
    if enabled is None:
        return agent  # inherit defaults
    return agent if agent.persona_id in enabled else None


async def create_workflow(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    trigger_type: TriggerType,
    trigger_entity_id: uuid.UUID | None = None,
    trigger_entity_type: str | None = None,
    patient_id: uuid.UUID | None = None,
    conversation_id: uuid.UUID | None = None,
    goal: str,
    task_definitions: list[dict],
) -> OrchestrationWorkflow:
    """Create a workflow with its task chain."""
    workflow = OrchestrationWorkflow(
        clinic_id=clinic_id,
        trigger_type=trigger_type,
        trigger_entity_id=trigger_entity_id,
        trigger_entity_type=trigger_entity_type,
        patient_id=patient_id,
        conversation_id=conversation_id,
        goal=goal,
        status=WorkflowStatus.PENDING,
    )
    db.add(workflow)
    await db.flush()

    for i, task_def in enumerate(task_definitions):
        task = AgentTask(
            clinic_id=clinic_id,
            workflow_id=workflow.id,
            agent_config_id=task_def.get("agent_config_id"),
            task_type=task_def["task_type"],
            task_order=i,
            input_data=task_def.get("input_data"),
            scheduled_at=task_def.get("scheduled_at"),
        )
        db.add(task)

    await db.flush()
    return workflow


async def update_workflow_status(
    db: AsyncSession,
    workflow_id: uuid.UUID,
    status: WorkflowStatus,
    result_summary: str | None = None,
    error_message: str | None = None,
) -> None:
    """Update a workflow's status."""
    result = await db.execute(
        select(OrchestrationWorkflow).where(OrchestrationWorkflow.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        return

    workflow.status = status
    if status == WorkflowStatus.RUNNING and not workflow.started_at:
        workflow.started_at = datetime.now(timezone.utc)
    if status in (WorkflowStatus.COMPLETED, WorkflowStatus.FAILED):
        workflow.completed_at = datetime.now(timezone.utc)
    if result_summary:
        workflow.result_summary = result_summary
    if error_message:
        workflow.error_message = error_message
    await db.flush()


async def cancel_pending_tasks_for_conversation(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> int:
    """Cancel all pending agent tasks for a conversation (used on human takeover / reply)."""
    result = await db.execute(
        select(OrchestrationWorkflow).where(
            OrchestrationWorkflow.conversation_id == conversation_id,
            OrchestrationWorkflow.status.in_([
                WorkflowStatus.PENDING, WorkflowStatus.RUNNING
            ]),
        )
    )
    workflows = result.scalars().all()
    cancelled = 0
    for wf in workflows:
        task_result = await db.execute(
            select(AgentTask).where(
                AgentTask.workflow_id == wf.id,
                AgentTask.status.in_([TaskStatus.PENDING]),
            )
        )
        for task in task_result.scalars().all():
            task.status = TaskStatus.CANCELLED
            cancelled += 1
    await db.flush()
    return cancelled
