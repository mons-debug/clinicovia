"""Event dispatcher — creates ConversionEvent records and dispatches to Celery tasks."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tracking import (
    TrackingIntegration,
    EventMapping,
    ConversionEvent,
    TrackingPlatform,
    TriggerType,
    EventStatus,
)


# Default stage-to-event mappings
DEFAULT_MAPPINGS = [
    ("New Lead", "Lead", False),
    ("Contacted", "Contact", False),
    ("Qualified", "QualifiedLead", False),
    ("Consultation Booked", "Schedule", False),
    ("Consultation Done", "ViewContent", False),
    ("Treatment Proposed", "InitiateCheckout", True),
    ("Treatment Accepted", "AddToCart", True),
    ("Payment", "Purchase", True),
    ("Completed", "CompleteRegistration", True),
]


async def ensure_default_mappings(db: AsyncSession, clinic_id: uuid.UUID) -> None:
    """Create default event mappings for a clinic if none exist."""
    result = await db.execute(
        select(EventMapping).where(EventMapping.clinic_id == clinic_id).limit(1)
    )
    if result.scalar_one_or_none():
        return  # Already has mappings

    for stage, event_name, include_value in DEFAULT_MAPPINGS:
        mapping = EventMapping(
            clinic_id=clinic_id,
            pipeline_stage=stage,
            event_name=event_name,
            include_value=include_value,
        )
        db.add(mapping)
    await db.commit()


async def get_enabled_integrations(
    db: AsyncSession, clinic_id: uuid.UUID
) -> list[TrackingIntegration]:
    """Get all enabled tracking integrations for a clinic."""
    result = await db.execute(
        select(TrackingIntegration).where(
            TrackingIntegration.clinic_id == clinic_id,
            TrackingIntegration.is_enabled == True,  # noqa: E712
        )
    )
    return list(result.scalars().all())


async def get_event_mapping(
    db: AsyncSession, clinic_id: uuid.UUID, pipeline_stage: str
) -> EventMapping | None:
    """Get the event mapping for a specific pipeline stage."""
    result = await db.execute(
        select(EventMapping).where(
            EventMapping.clinic_id == clinic_id,
            EventMapping.pipeline_stage == pipeline_stage,
            EventMapping.is_active == True,  # noqa: E712
        )
    )
    return result.scalar_one_or_none()


async def create_conversion_events(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    event_name: str,
    trigger_type: TriggerType,
    trigger_id: uuid.UUID | None = None,
    patient_id: uuid.UUID | None = None,
    value: Decimal | None = None,
    currency: str = "AED",
) -> list[ConversionEvent]:
    """Create ConversionEvent records for all enabled platforms and return them."""
    integrations = await get_enabled_integrations(db, clinic_id)
    if not integrations:
        return []

    events = []
    for integration in integrations:
        # Skip client-side-only platforms — no server-side events needed
        if integration.platform in (
            TrackingPlatform.GTM,
            TrackingPlatform.GOOGLE_ADS,  # Google Ads uses gtag.js client-side, not API
            TrackingPlatform.SNAPCHAT,    # Snapchat CAPI deferred to v2
            TrackingPlatform.TIKTOK,      # TikTok Events API deferred to v2
        ):
            continue

        event = ConversionEvent(
            clinic_id=clinic_id,
            platform=integration.platform,
            event_name=event_name,
            event_id=str(uuid.uuid4()),
            trigger_type=trigger_type,
            trigger_id=trigger_id,
            patient_id=patient_id,
            value=value,
            currency=currency,
            status=EventStatus.PENDING,
        )
        db.add(event)
        events.append(event)

    if events:
        await db.commit()
        for e in events:
            await db.refresh(e)

    return events
