"""Celery tasks for AI agent execution, follow-up checks, and reminders."""

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.tasks import celery_app
from app.config import settings


def _make_session_factory():
    """Build a per-invocation AsyncSession factory with NullPool.

    Celery spawns a fresh event loop per task. A shared asyncpg connection
    pool bound to the backend's default loop will raise "another operation
    is in progress" when reused here. NullPool means each session opens a
    new connection tied to the current loop and closes it on exit — safe
    but slightly slower. Fine for our task volume.
    """
    engine = create_async_engine(
        settings.database_url,
        poolclass=NullPool,
        echo=False,
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False), engine


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30, retry_backoff=True)
def execute_agent_task(self, task_id: str, workflow_id: str, clinic_id: str):
    """Execute a single agent task within a workflow."""
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_execute_agent_task(self, task_id, workflow_id, clinic_id))
    finally:
        loop.close()


async def _execute_agent_task(celery_task, task_id: str, workflow_id: str, clinic_id: str):
    from sqlalchemy import select
    from app.models.ai_agent import (
        AgentTask, AIAgentConfig, OrchestrationWorkflow,
        TaskStatus, WorkflowStatus, AgentTaskType, FunctionalType,
        AgentEventLog, AgentEventType,
    )
    from app.services.ai.orchestrator import update_workflow_status

    async_session, _engine = _make_session_factory()
    async with async_session() as db:
        # Load the task
        result = await db.execute(
            select(AgentTask).where(AgentTask.id == uuid.UUID(task_id))
        )
        task = result.scalar_one_or_none()
        if not task or task.status in (TaskStatus.COMPLETED, TaskStatus.CANCELLED):
            return

        # Mark running
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now(timezone.utc)
        task.celery_task_id = celery_task.request.id
        await db.commit()

        # Update workflow to running
        await update_workflow_status(db, uuid.UUID(workflow_id), WorkflowStatus.RUNNING)
        await db.commit()

        # Load agent config
        agent_config = None
        if task.agent_config_id:
            ac_result = await db.execute(
                select(AIAgentConfig).where(AIAgentConfig.id == task.agent_config_id)
            )
            agent_config = ac_result.scalar_one_or_none()

        # Load workflow for context
        wf_result = await db.execute(
            select(OrchestrationWorkflow).where(OrchestrationWorkflow.id == uuid.UUID(workflow_id))
        )
        workflow = wf_result.scalar_one_or_none()

        try:
            # Dispatch to the appropriate agent
            result_data = await _dispatch_task(
                db, task, agent_config, workflow
            )

            # Mark completed
            task.status = TaskStatus.COMPLETED
            task.output_data = result_data
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()

            # Side effects: apply qualification results to CRM entities
            if task.task_type == AgentTaskType.QUALIFY_LEAD and workflow:
                await _apply_qualification_to_crm(
                    db,
                    clinic_id=workflow.clinic_id,
                    conversation_id=workflow.conversation_id,
                    patient_id=workflow.patient_id,
                    qualification=result_data,
                )
                await db.commit()

            # Check if all tasks in workflow are done
            await _check_workflow_completion(db, uuid.UUID(workflow_id))
            await db.commit()

        except Exception as exc:
            task.retry_count += 1
            task.error_message = str(exc)[:500]

            if task.retry_count >= task.max_retries:
                task.status = TaskStatus.FAILED
                await db.commit()

                # Escalate to human
                await _escalate_workflow(db, uuid.UUID(workflow_id), str(exc))
                await db.commit()
            else:
                task.status = TaskStatus.PENDING
                await db.commit()
                raise celery_task.retry(exc=exc)


async def _dispatch_task(db, task, agent_config, workflow):
    """Route task to the correct agent implementation."""
    from app.models.ai_agent import AgentTaskType

    input_data = dict(task.input_data or {})
    conversation_id = workflow.conversation_id if workflow else None
    patient_id = workflow.patient_id if workflow else None

    # Inject outputs from previously completed tasks in this workflow
    prior_outputs = await _load_prior_task_outputs(db, workflow.id) if workflow else {}

    qualification = prior_outputs.get(AgentTaskType.QUALIFY_LEAD.value)
    if qualification:
        input_data["qualification_summary"] = (
            f"Lead score {qualification.get('score', 0)}/100, "
            f"intent={qualification.get('intent', 'unknown')}, "
            f"service={qualification.get('service', 'unknown')}, "
            f"urgency={qualification.get('urgency', 'unknown')}. "
            f"{qualification.get('reasoning', '')}"
        )

    if task.task_type == AgentTaskType.SEND_MESSAGE:
        generated = prior_outputs.get(AgentTaskType.GENERATE_RESPONSE.value)
        if not generated:
            for output_key in (
                AgentTaskType.RESCHEDULE_APPOINTMENT.value,
                AgentTaskType.SEND_REMINDER.value,
                AgentTaskType.SCHEDULE_FOLLOWUP.value,
                AgentTaskType.CHECK_REPLY.value,
            ):
                candidate = prior_outputs.get(output_key)
                if candidate and candidate.get("message"):
                    generated = candidate
                    break
        if generated and generated.get("message"):
            input_data["message"] = generated["message"]
            task.input_data = input_data

    if task.task_type == AgentTaskType.QUALIFY_LEAD:
        from app.services.ai.agents.lead_qualifier import LeadQualifierAgent
        agent = LeadQualifierAgent(agent_config)
        return await agent.run(
            db,
            conversation_id=conversation_id,
            patient_id=patient_id,
            workflow_id=workflow.id if workflow else None,
            task_id=task.id,
            extra_context=input_data,
        )

    if task.task_type == AgentTaskType.GENERATE_RESPONSE:
        from app.services.ai.agents.sales_responder import SalesResponderAgent
        agent = SalesResponderAgent(agent_config)
        return await agent.run(
            db,
            conversation_id=conversation_id,
            patient_id=patient_id,
            workflow_id=workflow.id if workflow else None,
            task_id=task.id,
            extra_context=input_data,
        )

    if task.task_type == AgentTaskType.SEND_MESSAGE:
        return await _send_whatsapp_message(db, task, workflow)

    if task.task_type in (AgentTaskType.SCHEDULE_FOLLOWUP, AgentTaskType.CHECK_REPLY):
        from app.services.ai.agents.follow_up import FollowUpAgent
        agent = FollowUpAgent(agent_config)
        return await agent.run(
            db,
            conversation_id=conversation_id,
            patient_id=patient_id,
            workflow_id=workflow.id if workflow else None,
            task_id=task.id,
            extra_context=input_data,
        )

    if task.task_type == AgentTaskType.SEND_REMINDER:
        from app.services.ai.agents.appointment_optimizer import AppointmentOptimizerAgent
        agent = AppointmentOptimizerAgent(agent_config)
        return await agent.run(
            db,
            conversation_id=conversation_id,
            patient_id=patient_id,
            workflow_id=workflow.id if workflow else None,
            task_id=task.id,
            extra_context=input_data,
        )

    if task.task_type == AgentTaskType.RESCHEDULE_APPOINTMENT:
        from app.services.ai.agents.appointment_optimizer import AppointmentOptimizerAgent
        agent = AppointmentOptimizerAgent(agent_config)
        return await agent.run(
            db,
            conversation_id=conversation_id,
            patient_id=patient_id,
            workflow_id=workflow.id if workflow else None,
            task_id=task.id,
            extra_context={**input_data, "mode": "reschedule"},
        )

    if task.task_type == AgentTaskType.ATTRIBUTE_CONVERSION:
        from app.services.ai.agents.attribution import AttributionAgent
        agent = AttributionAgent(agent_config)
        return await agent.run(
            db,
            conversation_id=conversation_id,
            patient_id=patient_id,
            workflow_id=workflow.id if workflow else None,
            task_id=task.id,
            extra_context=input_data,
        )

    return {"status": "skipped", "reason": f"Unknown task type: {task.task_type}"}


async def _send_whatsapp_message(db, task, workflow):
    """Send a WhatsApp message via the bridge client."""
    from sqlalchemy import select
    from app.models.whatsapp import WhatsAppConversation, WhatsAppSession, WhatsAppMessage, MessageDirection, MessageType
    from app.models.patient import Patient
    from app.models.ai_agent import AgentEventLog, AgentEventType
    from app.services.whatsapp_bridge import WhatsAppBridgeClient

    input_data = task.input_data or {}
    message_text = input_data.get("message", "")
    if not message_text:
        return {"status": "skipped", "reason": "no message text"}

    # Load conversation
    conv_result = await db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.id == workflow.conversation_id
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        return {"status": "failed", "reason": "conversation not found"}

    # Load session
    session_result = await db.execute(
        select(WhatsAppSession).where(WhatsAppSession.id == conv.session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        return {"status": "failed", "reason": "session not found"}

    # Send via bridge
    bridge = WhatsAppBridgeClient()
    send_result = await bridge.send_message(
        session_id=str(session.id),
        jid=conv.jid,
        text=message_text,
    )

    # Save outbound message
    from datetime import datetime, timezone
    msg = WhatsAppMessage(
        clinic_id=task.clinic_id,
        conversation_id=conv.id,
        wa_message_id=send_result.get("messageId", f"ai-{task.id}"),
        direction=MessageDirection.OUTBOUND,
        type=MessageType.TEXT,
        content=message_text,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(msg)

    # Update conversation
    conv.last_message = message_text[:200]
    conv.last_message_at = datetime.now(timezone.utc)

    # Update patient rate limit counter
    if workflow.patient_id:
        patient_result = await db.execute(
            select(Patient).where(Patient.id == workflow.patient_id)
        )
        patient = patient_result.scalar_one_or_none()
        if patient:
            patient.ai_message_count_today += 1
            patient.last_ai_contact_at = datetime.now(timezone.utc).isoformat()

    # Log event
    log = AgentEventLog(
        clinic_id=task.clinic_id,
        workflow_id=workflow.id,
        task_id=task.id,
        agent_config_id=task.agent_config_id,
        patient_id=workflow.patient_id,
        event_type=AgentEventType.MESSAGE_SENT,
        event_data={"message_preview": message_text[:200]},
    )
    db.add(log)
    await db.flush()

    try:
        from app.services.cache import cache_delete_pattern
        await cache_delete_pattern(f"wa:{task.clinic_id}:conversations:*")
        await cache_delete_pattern(f"wa:{task.clinic_id}:messages:{conv.id}:*")
        await cache_delete_pattern(f"wa:{task.clinic_id}:conversation:{conv.id}")
    except Exception:
        pass

    return {"status": "sent", "message_preview": message_text[:200]}


async def _check_workflow_completion(db, workflow_id: uuid.UUID):
    """Check if all tasks in a workflow are done."""
    from sqlalchemy import select, func
    from app.models.ai_agent import AgentTask, TaskStatus, OrchestrationWorkflow, WorkflowStatus

    result = await db.execute(
        select(
            func.count(AgentTask.id).label("total"),
            func.count(AgentTask.id).filter(
                AgentTask.status == TaskStatus.COMPLETED
            ).label("completed"),
            func.count(AgentTask.id).filter(
                AgentTask.status == TaskStatus.FAILED
            ).label("failed"),
        ).where(AgentTask.workflow_id == workflow_id)
    )
    row = result.one()

    if row.failed > 0:
        await _escalate_workflow(db, workflow_id, "One or more tasks failed")
    elif row.completed == row.total:
        from app.services.ai.orchestrator import update_workflow_status
        await update_workflow_status(
            db, workflow_id, WorkflowStatus.COMPLETED,
            result_summary=f"All {row.total} tasks completed"
        )


async def _escalate_workflow(db, workflow_id: uuid.UUID, error: str):
    """Escalate a failed workflow — notify staff via dashboard alert."""
    from sqlalchemy import select
    from app.models.ai_agent import (
        OrchestrationWorkflow, WorkflowStatus, AgentEventLog, AgentEventType,
    )
    from app.services.ai.orchestrator import update_workflow_status

    wf_result = await db.execute(
        select(OrchestrationWorkflow).where(OrchestrationWorkflow.id == workflow_id)
    )
    workflow = wf_result.scalar_one_or_none()
    if not workflow:
        return

    workflow.escalated_to_human = True
    await update_workflow_status(
        db, workflow_id, WorkflowStatus.FAILED, error_message=error
    )

    # Create dashboard alert
    log = AgentEventLog(
        clinic_id=workflow.clinic_id,
        workflow_id=workflow_id,
        patient_id=workflow.patient_id,
        event_type=AgentEventType.ESCALATED_TO_HUMAN,
        event_data={"reason": error[:500], "workflow_goal": workflow.goal},
    )
    db.add(log)
    await db.flush()


# ── Celery task chain helper ──

def dispatch_new_lead_workflow(workflow_id: str, clinic_id: str, task_ids: list[str] | None = None):
    """Dispatch the qualify → respond → send chain for a new lead.

    If `task_ids` is provided, skip the DB lookup (preferred — avoids creating a
    new event loop when called from an async FastAPI handler). Otherwise fall
    back to fetching via a fresh event loop (safe only from a sync context).
    """
    from celery import chain

    if task_ids is None:
        # Sync fallback — only safe when NOT inside an already-running event loop.
        loop = asyncio.new_event_loop()
        try:
            task_ids = loop.run_until_complete(_get_workflow_task_ids(workflow_id))
        finally:
            loop.close()

    if not task_ids:
        return

    tasks = [
        execute_agent_task.si(tid, workflow_id, clinic_id)
        for tid in task_ids
    ]
    chain(*tasks).apply_async()


async def _load_prior_task_outputs(db, workflow_id: uuid.UUID) -> dict[str, dict]:
    """Return a map of task_type (string value) → latest output_data for completed tasks."""
    from sqlalchemy import select
    from app.models.ai_agent import AgentTask, TaskStatus

    result = await db.execute(
        select(AgentTask)
        .where(
            AgentTask.workflow_id == workflow_id,
            AgentTask.status == TaskStatus.COMPLETED,
        )
        .order_by(AgentTask.task_order)
    )
    outputs: dict[str, dict] = {}
    for t in result.scalars().all():
        if t.output_data:
            key = t.task_type.value if hasattr(t.task_type, "value") else str(t.task_type)
            outputs[key] = t.output_data
    return outputs


async def _apply_qualification_to_crm(
    db,
    *,
    clinic_id: uuid.UUID,
    conversation_id: uuid.UUID | None,
    patient_id: uuid.UUID | None,
    qualification: dict,
) -> None:
    """Persist lead score/intent/service onto the conversation, patient, and any active deal."""
    from sqlalchemy import select
    from app.models.whatsapp import WhatsAppConversation
    from app.models.patient import Patient
    from app.models.pipeline import Deal

    score_raw = qualification.get("score")
    try:
        score = int(score_raw) if score_raw is not None else None
    except (TypeError, ValueError):
        score = None
    intent = qualification.get("intent")
    service = qualification.get("service")

    if conversation_id:
        conv_result = await db.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.id == conversation_id
            )
        )
        conv = conv_result.scalar_one_or_none()
        if conv:
            if score is not None:
                conv.lead_score = score
            if intent:
                conv.lead_intent = intent
            if service:
                conv.lead_service = service

    if patient_id:
        p_result = await db.execute(select(Patient).where(Patient.id == patient_id))
        patient = p_result.scalar_one_or_none()
        if patient and score is not None:
            patient.lead_score = score

        # Optional: update an active deal for this patient
        deal_result = await db.execute(
            select(Deal).where(
                Deal.clinic_id == clinic_id,
                Deal.patient_id == patient_id,
            ).order_by(Deal.created_at.desc()).limit(1)
        )
        deal = deal_result.scalar_one_or_none()
        if deal:
            if score is not None and hasattr(deal, "lead_score"):
                deal.lead_score = score
            if service and hasattr(deal, "service_interest"):
                deal.service_interest = service


async def _get_workflow_task_ids(workflow_id: str) -> list[str]:
    from sqlalchemy import select
    from app.models.ai_agent import AgentTask

    async_session, _engine = _make_session_factory()
    async with async_session() as db:
        result = await db.execute(
            select(AgentTask.id)
            .where(AgentTask.workflow_id == uuid.UUID(workflow_id))
            .order_by(AgentTask.task_order)
        )
        return [str(row[0]) for row in result.all()]
