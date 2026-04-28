"""Celery tasks for firing conversion events to ad platforms."""

import asyncio
import uuid
from datetime import datetime, timezone

from app.tasks import celery_app
from app.database import async_session


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    retry_backoff=True,
)
def fire_conversion_event(self, event_id: str, platform: str, clinic_id: str):
    """Fire a single conversion event to its target platform.

    Called by the tracking hooks after ConversionEvent records are created.
    """
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_fire_event(self, event_id, platform, clinic_id))
    finally:
        loop.close()


async def _fire_event(task, event_id: str, platform: str, clinic_id: str):
    from sqlalchemy import select
    from app.models.tracking import ConversionEvent, TrackingIntegration, EventStatus, TrackingPlatform, TriggerType
    from app.models.patient import Patient
    from app.utils.encryption import decrypt_credentials
    from app.services.tracking.hasher import build_hashed_user_data

    async with async_session() as db:
        # Load the event
        result = await db.execute(
            select(ConversionEvent).where(ConversionEvent.id == uuid.UUID(event_id))
        )
        event = result.scalar_one_or_none()
        if not event or event.status == EventStatus.SENT:
            return

        # Load integration credentials
        result = await db.execute(
            select(TrackingIntegration).where(
                TrackingIntegration.clinic_id == uuid.UUID(clinic_id),
                TrackingIntegration.platform == platform,
                TrackingIntegration.is_enabled == True,  # noqa: E712
            )
        )
        integration = result.scalar_one_or_none()
        if not integration:
            event.status = EventStatus.FAILED
            event.error_message = "Integration not found or disabled"
            await db.commit()
            return

        credentials = decrypt_credentials(integration.encrypted_credentials)
        if not credentials:
            event.status = EventStatus.FAILED
            event.error_message = "Could not decrypt credentials"
            await db.commit()
            return

        # Load patient data for hashing
        user_data = {}
        if event.patient_id:
            p_result = await db.execute(
                select(Patient).where(Patient.id == event.patient_id)
            )
            patient = p_result.scalar_one_or_none()
            if patient:
                user_data = build_hashed_user_data(
                    email=patient.email,
                    phone=patient.phone,
                    phone_country_code=patient.phone_country_code or "",
                    first_name=patient.first_name,
                    last_name=patient.last_name,
                    city=patient.city,
                    country=patient.country,
                )

        # If no patient data yet, try to get data from the trigger source
        if not user_data and event.trigger_id and event.trigger_type == TriggerType.DEAL_STAGE_CHANGE:
            from app.models.pipeline import Deal
            deal_result = await db.execute(
                select(Deal).where(Deal.id == event.trigger_id)
            )
            deal = deal_result.scalar_one_or_none()
            if deal and deal.patient_id:
                p2_result = await db.execute(
                    select(Patient).where(Patient.id == deal.patient_id)
                )
                patient2 = p2_result.scalar_one_or_none()
                if patient2:
                    user_data = build_hashed_user_data(
                        email=patient2.email,
                        phone=patient2.phone,
                        phone_country_code=patient2.phone_country_code or "",
                        first_name=patient2.first_name,
                        last_name=patient2.last_name,
                        city=patient2.city,
                        country=patient2.country,
                    )

        if not user_data and event.trigger_id and event.trigger_type == TriggerType.WHATSAPP_MESSAGE:
            from app.models.whatsapp import WhatsAppConversation
            conv_result = await db.execute(
                select(WhatsAppConversation).where(WhatsAppConversation.id == event.trigger_id)
            )
            conv = conv_result.scalar_one_or_none()
            if conv and conv.contact_phone:
                user_data = build_hashed_user_data(
                    phone=conv.contact_phone,
                    first_name=conv.contact_name.split(" ")[0] if conv.contact_name else None,
                    last_name=conv.contact_name.split(" ")[-1] if conv.contact_name and " " in conv.contact_name else None,
                )

        # Fire to the appropriate platform
        event.attempts += 1
        event.status = EventStatus.RETRYING

        try:
            if platform == TrackingPlatform.META.value:
                from app.services.tracking.meta import send_meta_event
                await send_meta_event(credentials, event, user_data)
            elif platform == TrackingPlatform.GA4.value:
                from app.services.tracking.ga4 import send_ga4_event
                await send_ga4_event(credentials, event, user_data)
            else:
                event.status = EventStatus.FAILED
                event.error_message = f"Unsupported platform: {platform}"
                await db.commit()
                return

            # Success
            event.status = EventStatus.SENT
            event.sent_at = datetime.now(timezone.utc)
            event.error_message = None
            await db.commit()

        except Exception as exc:
            event.error_message = str(exc)[:500]
            if event.attempts >= 3:
                event.status = EventStatus.FAILED
            else:
                event.status = EventStatus.RETRYING
            await db.commit()

            # Retry via Celery
            if event.attempts < 3:
                raise task.retry(exc=exc)
