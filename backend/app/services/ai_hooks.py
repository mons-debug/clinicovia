"""AI orchestration hooks — called from WhatsApp webhook, form submissions,
deal stage changes, and appointment status changes.

Mirrors `tracking_hooks.py`. Each hook:
1. Checks if a relevant agent is active for the clinic.
2. Checks handled_by / opt-out / rate limit gates.
3. Creates an `OrchestrationWorkflow` + task chain.
4. Dispatches the Celery chain.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_agent import (
    AgentTaskType,
    FunctionalType,
    TriggerType,
)
from app.models.whatsapp import WhatsAppConversation
from app.services.ai.orchestrator import (
    can_dispatch,
    check_rate_limit,
    create_workflow,
    get_active_agent,
    is_duplicate_trigger,
)


ACKNOWLEDGEMENT_INTENTS = {
    "thanks",
    "thank_you",
    "acknowledgement",
    "acknowledgment",
    "ok",
    "confirmation",
    "greeting",
}

ACKNOWLEDGEMENT_PHRASES = {
    "thanks",
    "thank you",
    "ok",
    "okay",
    "شكرا",
    "شكراً",
    "شكرًا",
    "تمام",
    "اوكي",
    "أوكي",
    "ماشي",
}


def _should_reply_to_none_route(message_content: str, route_intent: str | None) -> bool:
    """Return true for polite short replies that should still get an AI response."""
    intent = (route_intent or "").strip().lower()
    if intent in ACKNOWLEDGEMENT_INTENTS:
        return True

    normalized = " ".join((message_content or "").strip().lower().split())
    return normalized in ACKNOWLEDGEMENT_PHRASES


async def on_new_whatsapp_message(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    message_id: uuid.UUID,
    conversation: WhatsAppConversation,
    message_content: str,
    patient_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Fired after an inbound WhatsApp message is saved.

    Returns the dispatched workflow ID, or None if skipped.
    """
    # Gate: conversation handler + opt-outs
    can_proceed, _ = await can_dispatch(
        db,
        clinic_id,
        conversation_id=conversation.id,
        patient_id=patient_id,
    )
    if not can_proceed:
        return None

    # Dedup on message trigger
    if await is_duplicate_trigger(
        db, clinic_id, TriggerType.NEW_WHATSAPP_MESSAGE, message_id
    ):
        return None

    # Resolve available specialists (all respect the per-conversation allowlist)
    leader = await get_active_agent(
        db, clinic_id, FunctionalType.ORCHESTRATION_ROUTER, conversation_id=conversation.id
    )
    qualifier = await get_active_agent(
        db, clinic_id, FunctionalType.LEAD_QUALIFICATION, conversation_id=conversation.id
    )
    sales = await get_active_agent(
        db, clinic_id, FunctionalType.WHATSAPP_SALES, conversation_id=conversation.id
    )
    appointment = await get_active_agent(
        db, clinic_id, FunctionalType.APPOINTMENT_OPTIMIZATION, conversation_id=conversation.id
    )
    follow_up = await get_active_agent(
        db, clinic_id, FunctionalType.FOLLOW_UP, conversation_id=conversation.id
    )

    # If Rafiq (Leader) is active for this chat, ask it who should handle this message.
    route_to: str | None = None
    route_intent: str | None = None
    if leader:
        try:
            from app.services.ai.agents.leader import LeaderAgent
            runner = LeaderAgent(leader)
            decision = await runner.run(
                db,
                conversation_id=conversation.id,
                patient_id=patient_id,
                extra_context={"current_message": message_content},
            )
            route_to = decision.get("route_to")
            route_intent = decision.get("intent")
            print(f"[leader] conv={conversation.id} route_to={route_to} intent={route_intent} confidence={decision.get('confidence')}")
        except Exception as e:
            import traceback
            print(f"[leader] FAILED conv={conversation.id}: {e}")
            traceback.print_exc()
            route_to = None  # fall back to default pipeline

    # Handle routing decision
    if route_to == "none" and _should_reply_to_none_route(message_content, route_intent):
        route_to = "omar"

    if route_to == "none":
        # Leader chose not to reply (spam or truly off-topic chatter).
        await db.commit()
        return None

    if route_to == "human":
        # Escalate: flip conversation to human-handled so staff see it.
        from app.models.whatsapp import ConversationHandler
        from app.models.ai_agent import AgentEventType, AgentEventLog
        from datetime import datetime, timezone
        conversation.handled_by = ConversationHandler.HUMAN
        conversation.human_takeover_at = datetime.now(timezone.utc)
        db.add(AgentEventLog(
            clinic_id=clinic_id,
            patient_id=patient_id,
            event_type=AgentEventType.ESCALATED_TO_HUMAN,
            event_data={"reason": "leader_routed_to_human", "intent": route_intent},
        ))
        await db.commit()
        return None

    if route_to == "sara" and appointment:
        responder = appointment
        task_defs = [
            {
                "task_type": AgentTaskType.RESCHEDULE_APPOINTMENT,
                "agent_config_id": appointment.id,
                "input_data": {"current_message": message_content, "routed_intent": route_intent},
            },
            {
                "task_type": AgentTaskType.SEND_MESSAGE,
                "agent_config_id": appointment.id,
                "input_data": {},
            },
        ]
    elif route_to == "noor" and follow_up:
        responder = follow_up
        task_defs = [
            {
                "task_type": AgentTaskType.CHECK_REPLY,
                "agent_config_id": follow_up.id,
                "input_data": {"current_message": message_content, "routed_intent": route_intent},
            },
            {
                "task_type": AgentTaskType.SEND_MESSAGE,
                "agent_config_id": follow_up.id,
                "input_data": {},
            },
        ]
    else:
        responder = sales
        task_defs = []

    # A responder is required for any reply path — without one we can't answer.
    if not responder:
        await db.commit()
        return None

    # Rate limit check
    if patient_id and not await check_rate_limit(db, patient_id, responder):
        return None

    # Build the default WhatsApp sales task chain. Logic:
    #  - If Leader explicitly routed to omar → skip qualification, just respond.
    #  - If Leader routed to layla or no Leader decision → run qualifier (if allowed) + respond.
    #  - If Leader routed to sara/noor and those agents are active, task_defs
    #    was already built above with the specialist response + send.
    skip_qualification = route_to == "omar"

    if not task_defs and qualifier and not skip_qualification:
        task_defs.append({
            "task_type": AgentTaskType.QUALIFY_LEAD,
            "agent_config_id": qualifier.id,
            "input_data": {"current_message": message_content},
        })
    if not any(task["task_type"] == AgentTaskType.SEND_MESSAGE for task in task_defs):
        task_defs.extend([
            {
                "task_type": AgentTaskType.GENERATE_RESPONSE,
                "agent_config_id": responder.id,
                "input_data": {"current_message": message_content, "routed_intent": route_intent},
            },
            {
                "task_type": AgentTaskType.SEND_MESSAGE,
                "agent_config_id": responder.id,
                "input_data": {},
            },
        ])

    workflow = await create_workflow(
        db,
        clinic_id=clinic_id,
        trigger_type=TriggerType.NEW_WHATSAPP_MESSAGE,
        trigger_entity_id=message_id,
        trigger_entity_type="whatsapp_message",
        patient_id=patient_id,
        conversation_id=conversation.id,
        goal="qualify_and_engage",
        task_definitions=task_defs,
    )

    # Fetch the task IDs inside the async context so the sync Celery dispatcher
    # doesn't need to create a second event loop.
    from sqlalchemy import select
    from app.models.ai_agent import AgentTask
    task_rows = await db.execute(
        select(AgentTask.id)
        .where(AgentTask.workflow_id == workflow.id)
        .order_by(AgentTask.task_order)
    )
    task_ids = [str(row[0]) for row in task_rows.all()]

    await db.commit()

    from app.tasks.ai import dispatch_new_lead_workflow
    dispatch_new_lead_workflow(str(workflow.id), str(clinic_id), task_ids=task_ids)
    print(f"[ai_hooks] enqueued workflow={workflow.id} with {len(task_ids)} tasks")
    return workflow.id


async def on_form_submission_ai(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    form_id: uuid.UUID,
    submission_id: uuid.UUID,
    submission_data: dict,
    patient_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Fired after a public form submission that created/matched a patient."""
    can_proceed, _ = await can_dispatch(
        db, clinic_id, patient_id=patient_id
    )
    if not can_proceed:
        return None

    if await is_duplicate_trigger(
        db, clinic_id, TriggerType.FORM_SUBMISSION, submission_id
    ):
        return None

    qualifier = await get_active_agent(
        db, clinic_id, FunctionalType.LEAD_QUALIFICATION
    )
    if not qualifier:
        return None

    # Summarize submission as the "current message" for the qualifier
    summary_parts = []
    for k, v in (submission_data or {}).items():
        if v:
            summary_parts.append(f"{k}: {v}")
    current_text = "\n".join(summary_parts) or "Form submitted"

    workflow = await create_workflow(
        db,
        clinic_id=clinic_id,
        trigger_type=TriggerType.FORM_SUBMISSION,
        trigger_entity_id=submission_id,
        trigger_entity_type="form_submission",
        patient_id=patient_id,
        goal="qualify_lead",
        task_definitions=[
            {
                "task_type": AgentTaskType.QUALIFY_LEAD,
                "agent_config_id": qualifier.id,
                "input_data": {
                    "current_message": current_text,
                    "source": "form",
                    "form_id": str(form_id),
                },
            },
        ],
    )
    await db.commit()

    from app.tasks.ai import dispatch_new_lead_workflow
    dispatch_new_lead_workflow(str(workflow.id), str(clinic_id))
    return workflow.id


async def on_deal_stage_change_ai(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    deal_id: uuid.UUID,
    from_stage: str | None,
    to_stage: str,
    patient_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Fired when a deal moves to a new pipeline stage. Used by US6 attribution + US7 drop-off."""
    if to_stage not in ("won", "closed_won"):
        return None

    attribution_agent = await get_active_agent(
        db, clinic_id, FunctionalType.AD_ATTRIBUTION
    )
    if not attribution_agent:
        return None

    if await is_duplicate_trigger(
        db, clinic_id, TriggerType.DEAL_STAGE_CHANGE, deal_id
    ):
        return None

    workflow = await create_workflow(
        db,
        clinic_id=clinic_id,
        trigger_type=TriggerType.DEAL_STAGE_CHANGE,
        trigger_entity_id=deal_id,
        trigger_entity_type="deal",
        patient_id=patient_id,
        goal="attribute_conversion",
        task_definitions=[
            {
                "task_type": AgentTaskType.ATTRIBUTE_CONVERSION,
                "agent_config_id": attribution_agent.id,
                "input_data": {
                    "deal_id": str(deal_id),
                    "from_stage": from_stage,
                    "to_stage": to_stage,
                },
            },
        ],
    )
    await db.commit()

    from app.tasks.ai import dispatch_new_lead_workflow
    dispatch_new_lead_workflow(str(workflow.id), str(clinic_id))
    return workflow.id


async def on_appointment_status_change_ai(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    appointment_id: uuid.UUID,
    old_status: str | None,
    new_status: str,
    patient_id: uuid.UUID | None = None,
    conversation_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Fired on appointment status change — dispatches no-show recovery workflow."""
    if new_status != "no_show":
        return None

    optimizer = await get_active_agent(
        db, clinic_id, FunctionalType.APPOINTMENT_OPTIMIZATION
    )
    if not optimizer:
        return None

    if await is_duplicate_trigger(
        db, clinic_id, TriggerType.APPOINTMENT_STATUS_CHANGE, appointment_id
    ):
        return None

    workflow = await create_workflow(
        db,
        clinic_id=clinic_id,
        trigger_type=TriggerType.APPOINTMENT_STATUS_CHANGE,
        trigger_entity_id=appointment_id,
        trigger_entity_type="appointment",
        patient_id=patient_id,
        conversation_id=conversation_id,
        goal="reschedule_appointment",
        task_definitions=[
            {
                "task_type": AgentTaskType.RESCHEDULE_APPOINTMENT,
                "agent_config_id": optimizer.id,
                "input_data": {
                    "appointment_id": str(appointment_id),
                    "old_status": old_status,
                    "new_status": new_status,
                },
            },
            {
                "task_type": AgentTaskType.SEND_MESSAGE,
                "agent_config_id": optimizer.id,
                "input_data": {},
            },
        ],
    )
    await db.commit()

    from app.tasks.ai import dispatch_new_lead_workflow
    dispatch_new_lead_workflow(str(workflow.id), str(clinic_id))
    return workflow.id
