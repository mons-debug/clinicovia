import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.tracking import (
    TrackingIntegration,
    TrackingPlatform,
    EventMapping,
    ConversionEvent,
    EventStatus,
)
from app.schemas.tracking import (
    IntegrationResponse,
    IntegrationDetailResponse,
    IntegrationListResponse,
    IntegrationUpsert,
    EventMappingResponse,
    EventMappingListResponse,
    EventMappingBulkUpdate,
    ConversionEventResponse,
    ConversionEventListResponse,
    ConversionStatsResponse,
)
from app.middleware.auth import get_current_user
from app.utils.encryption import encrypt_credentials, decrypt_credentials
from app.services.tracking.dispatcher import ensure_default_mappings

router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


VALID_PLATFORMS = {p.value for p in TrackingPlatform}

# Credential field definitions per platform (for UI guidance)
PLATFORM_FIELDS: dict[str, list[str]] = {
    "meta": ["pixel_id", "access_token"],
    "google_ads": ["conversion_id", "conversion_label"],
    "ga4": ["measurement_id", "api_secret"],
    "gtm": ["container_id"],
    "snapchat": ["pixel_id", "capi_token"],
    "tiktok": ["pixel_id", "events_api_token"],
}

# Fields that are secret (should be redacted in responses)
SECRET_FIELDS = {"access_token", "capi_token", "events_api_token", "api_secret"}


def _redact_credentials(creds: dict) -> dict:
    """Show field names with values redacted for secrets."""
    result = {}
    for key, value in creds.items():
        if key in SECRET_FIELDS and value:
            result[key] = "****"
        else:
            result[key] = value
    return result


# ── Integrations CRUD ────────────────────────────────────────────

@router.get("/integrations", response_model=IntegrationListResponse)
async def list_integrations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(TrackingIntegration).where(TrackingIntegration.clinic_id == clinic_id)
        .order_by(TrackingIntegration.platform)
    )
    integrations = result.scalars().all()

    responses = []
    for i in integrations:
        creds = decrypt_credentials(i.encrypted_credentials) if i.encrypted_credentials else {}
        responses.append(IntegrationResponse(
            id=i.id,
            platform=i.platform.value if hasattr(i.platform, "value") else str(i.platform),
            is_enabled=i.is_enabled,
            has_credentials=bool(creds),
            created_at=i.created_at,
            updated_at=i.updated_at,
        ))
    return IntegrationListResponse(integrations=responses)


@router.get("/integrations/{platform}", response_model=IntegrationDetailResponse)
async def get_integration(
    platform: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if platform not in VALID_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")

    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(TrackingIntegration).where(
            TrackingIntegration.clinic_id == clinic_id,
            TrackingIntegration.platform == platform,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    creds = decrypt_credentials(integration.encrypted_credentials) if integration.encrypted_credentials else {}

    return IntegrationDetailResponse(
        id=integration.id,
        platform=integration.platform.value if hasattr(integration.platform, "value") else str(integration.platform),
        is_enabled=integration.is_enabled,
        credential_fields=_redact_credentials(creds),
        created_at=integration.created_at,
        updated_at=integration.updated_at,
    )


@router.put("/integrations/{platform}", response_model=IntegrationDetailResponse)
async def upsert_integration(
    platform: str,
    body: IntegrationUpsert,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if platform not in VALID_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")

    clinic_id = _get_clinic_id(user)

    result = await db.execute(
        select(TrackingIntegration).where(
            TrackingIntegration.clinic_id == clinic_id,
            TrackingIntegration.platform == platform,
        )
    )
    integration = result.scalar_one_or_none()

    encrypted = encrypt_credentials(body.credentials) if body.credentials else ""

    if integration:
        integration.is_enabled = body.is_enabled
        if body.credentials:
            integration.encrypted_credentials = encrypted
    else:
        integration = TrackingIntegration(
            clinic_id=clinic_id,
            platform=TrackingPlatform(platform),
            is_enabled=body.is_enabled,
            encrypted_credentials=encrypted,
        )
        db.add(integration)

    await db.commit()
    await db.refresh(integration)

    creds = decrypt_credentials(integration.encrypted_credentials) if integration.encrypted_credentials else {}
    return IntegrationDetailResponse(
        id=integration.id,
        platform=integration.platform.value if hasattr(integration.platform, "value") else str(integration.platform),
        is_enabled=integration.is_enabled,
        credential_fields=_redact_credentials(creds),
        created_at=integration.created_at,
        updated_at=integration.updated_at,
    )


@router.delete("/integrations/{platform}", status_code=204)
async def delete_integration(
    platform: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if platform not in VALID_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")

    clinic_id = _get_clinic_id(user)
    await db.execute(
        delete(TrackingIntegration).where(
            TrackingIntegration.clinic_id == clinic_id,
            TrackingIntegration.platform == platform,
        )
    )
    await db.commit()


# ── Event Mappings ───────────────────────────────────────────────

@router.get("/mappings", response_model=EventMappingListResponse)
async def list_mappings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    await ensure_default_mappings(db, clinic_id)

    result = await db.execute(
        select(EventMapping).where(EventMapping.clinic_id == clinic_id)
        .order_by(EventMapping.created_at)
    )
    mappings = result.scalars().all()
    return EventMappingListResponse(
        mappings=[EventMappingResponse.model_validate(m) for m in mappings]
    )


@router.put("/mappings", response_model=EventMappingListResponse)
async def bulk_update_mappings(
    body: EventMappingBulkUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    # Delete existing
    await db.execute(
        delete(EventMapping).where(EventMapping.clinic_id == clinic_id)
    )

    # Insert new
    for item in body.mappings:
        mapping = EventMapping(
            clinic_id=clinic_id,
            pipeline_stage=item.pipeline_stage,
            event_name=item.event_name,
            include_value=item.include_value,
            is_active=item.is_active,
        )
        db.add(mapping)

    await db.commit()

    result = await db.execute(
        select(EventMapping).where(EventMapping.clinic_id == clinic_id)
        .order_by(EventMapping.created_at)
    )
    mappings = result.scalars().all()
    return EventMappingListResponse(
        mappings=[EventMappingResponse.model_validate(m) for m in mappings]
    )


@router.post("/mappings/reset", response_model=EventMappingListResponse)
async def reset_mappings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    await db.execute(
        delete(EventMapping).where(EventMapping.clinic_id == clinic_id)
    )
    await db.commit()
    await ensure_default_mappings(db, clinic_id)

    result = await db.execute(
        select(EventMapping).where(EventMapping.clinic_id == clinic_id)
        .order_by(EventMapping.created_at)
    )
    mappings = result.scalars().all()
    return EventMappingListResponse(
        mappings=[EventMappingResponse.model_validate(m) for m in mappings]
    )


# ── Conversion Events (read-only log + stats) ───────────────────

@router.get("/events", response_model=ConversionEventListResponse)
async def list_events(
    platform: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    event_name: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    query = select(ConversionEvent).where(ConversionEvent.clinic_id == clinic_id)

    if platform:
        query = query.where(ConversionEvent.platform == platform)
    if status_filter:
        query = query.where(ConversionEvent.status == status_filter)
    if event_name:
        query = query.where(ConversionEvent.event_name == event_name)
    if date_from:
        query = query.where(func.date(ConversionEvent.created_at) >= date_from)
    if date_to:
        query = query.where(func.date(ConversionEvent.created_at) <= date_to)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    query = query.order_by(ConversionEvent.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    events = result.scalars().all()

    return ConversionEventListResponse(
        events=[ConversionEventResponse(
            id=e.id,
            platform=e.platform.value if hasattr(e.platform, "value") else str(e.platform),
            event_name=e.event_name,
            event_id=e.event_id,
            trigger_type=e.trigger_type.value if hasattr(e.trigger_type, "value") else str(e.trigger_type),
            trigger_id=e.trigger_id,
            patient_id=e.patient_id,
            value=e.value,
            currency=e.currency,
            status=e.status.value if hasattr(e.status, "value") else str(e.status),
            error_message=e.error_message,
            attempts=e.attempts,
            sent_at=e.sent_at,
            created_at=e.created_at,
        ) for e in events],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/events/stats", response_model=ConversionStatsResponse)
async def get_event_stats(
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    base = select(ConversionEvent).where(ConversionEvent.clinic_id == clinic_id)
    if date_from:
        base = base.where(func.date(ConversionEvent.created_at) >= date_from)
    if date_to:
        base = base.where(func.date(ConversionEvent.created_at) <= date_to)

    result = await db.execute(base)
    events = list(result.scalars().all())

    by_platform: dict = {}
    by_event_name: dict = {}
    by_status: dict = {}
    total_value = Decimal("0")

    for e in events:
        p = e.platform.value if hasattr(e.platform, "value") else str(e.platform)
        s = e.status.value if hasattr(e.status, "value") else str(e.status)

        by_platform.setdefault(p, {"sent": 0, "failed": 0})
        if s == "sent":
            by_platform[p]["sent"] += 1
        elif s == "failed":
            by_platform[p]["failed"] += 1

        by_event_name[e.event_name] = by_event_name.get(e.event_name, 0) + 1
        by_status[s] = by_status.get(s, 0) + 1

        if e.value and s == "sent":
            total_value += e.value

    return ConversionStatsResponse(
        total_events=len(events),
        by_platform=by_platform,
        by_event_name=by_event_name,
        by_status=by_status,
        total_value=total_value,
    )


# ── Public pixel config (no auth) ───────────────────────────────

@router.get("/public/pixels/{clinic_id}")
async def get_public_pixels(
    clinic_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return non-secret pixel IDs for client-side injection. No auth required."""
    result = await db.execute(
        select(TrackingIntegration).where(
            TrackingIntegration.clinic_id == clinic_id,
            TrackingIntegration.is_enabled == True,  # noqa: E712
        )
    )
    integrations = result.scalars().all()

    pixels: dict = {}
    for i in integrations:
        creds = decrypt_credentials(i.encrypted_credentials) if i.encrypted_credentials else {}
        p = i.platform.value if hasattr(i.platform, "value") else str(i.platform)

        if p == "meta" and creds.get("pixel_id"):
            pixels["meta_pixel_id"] = creds["pixel_id"]
        elif p == "google_ads" and creds.get("conversion_id"):
            pixels["google_ads_conversion_id"] = creds["conversion_id"]
            if creds.get("conversion_label"):
                pixels["google_ads_conversion_label"] = creds["conversion_label"]
        elif p == "ga4" and creds.get("measurement_id"):
            pixels["ga4_measurement_id"] = creds["measurement_id"]
        elif p == "gtm" and creds.get("container_id"):
            pixels["gtm_container_id"] = creds["container_id"]
        elif p == "snapchat" and creds.get("pixel_id"):
            pixels["snapchat_pixel_id"] = creds["pixel_id"]
        elif p == "tiktok" and creds.get("pixel_id"):
            pixels["tiktok_pixel_id"] = creds["pixel_id"]

    return {"clinic_id": str(clinic_id), "pixels": pixels}
