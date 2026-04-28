"""Tracking hooks — called from deal stage changes, WhatsApp webhooks, and appointment status updates.

These functions look up enabled integrations and event mappings, then dispatch Celery tasks.
"""

import uuid
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tracking import TriggerType
from app.services.tracking.dispatcher import (
    get_event_mapping,
    create_conversion_events,
    ensure_default_mappings,
)


async def on_deal_stage_change(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    deal_id: uuid.UUID,
    new_stage: str,
    patient_id: uuid.UUID | None = None,
    deal_value: Decimal | None = None,
    currency: str = "AED",
) -> None:
    """Called when a deal moves to a new pipeline stage."""
    await ensure_default_mappings(db, clinic_id)
    mapping = await get_event_mapping(db, clinic_id, new_stage)
    if not mapping:
        return

    value = deal_value if mapping.include_value else None

    events = await create_conversion_events(
        db,
        clinic_id=clinic_id,
        event_name=mapping.event_name,
        trigger_type=TriggerType.DEAL_STAGE_CHANGE,
        trigger_id=deal_id,
        patient_id=patient_id,
        value=value,
        currency=currency,
    )

    # Dispatch Celery tasks
    from app.tasks.tracking import fire_conversion_event
    for event in events:
        fire_conversion_event.delay(
            str(event.id),
            event.platform.value if hasattr(event.platform, "value") else str(event.platform),
            str(clinic_id),
        )


async def on_whatsapp_new_conversation(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    conversation_id: uuid.UUID,
    patient_id: uuid.UUID | None = None,
) -> None:
    """Called when a new WhatsApp conversation is created (first inbound message)."""
    events = await create_conversion_events(
        db,
        clinic_id=clinic_id,
        event_name="Lead",
        trigger_type=TriggerType.WHATSAPP_MESSAGE,
        trigger_id=conversation_id,
        patient_id=patient_id,
    )

    from app.tasks.tracking import fire_conversion_event
    for event in events:
        fire_conversion_event.delay(
            str(event.id),
            event.platform.value if hasattr(event.platform, "value") else str(event.platform),
            str(clinic_id),
        )


async def on_appointment_status_change(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    appointment_id: uuid.UUID,
    new_status: str,
    patient_id: uuid.UUID | None = None,
    deal_value: Decimal | None = None,
    currency: str = "AED",
) -> None:
    """Called when an appointment status changes to a trackable state."""
    # Map appointment statuses to event names
    status_event_map = {
        "confirmed": "Schedule",
        "completed": "Purchase",
    }
    event_name = status_event_map.get(new_status)
    if not event_name:
        return

    value = deal_value if event_name == "Purchase" else None

    events = await create_conversion_events(
        db,
        clinic_id=clinic_id,
        event_name=event_name,
        trigger_type=TriggerType.APPOINTMENT_STATUS,
        trigger_id=appointment_id,
        patient_id=patient_id,
        value=value,
        currency=currency,
    )

    from app.tasks.tracking import fire_conversion_event
    for event in events:
        fire_conversion_event.delay(
            str(event.id),
            event.platform.value if hasattr(event.platform, "value") else str(event.platform),
            str(clinic_id),
        )


async def on_form_submission(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    form_id: uuid.UUID,
    patient_id: uuid.UUID | None = None,
) -> None:
    """Called when a public form is submitted."""
    events = await create_conversion_events(
        db,
        clinic_id=clinic_id,
        event_name="Lead",
        trigger_type=TriggerType.FORM_SUBMISSION,
        trigger_id=form_id,
        patient_id=patient_id,
    )

    from app.tasks.tracking import fire_conversion_event
    for event in events:
        fire_conversion_event.delay(
            str(event.id),
            event.platform.value if hasattr(event.platform, "value") else str(event.platform),
            str(clinic_id),
        )
