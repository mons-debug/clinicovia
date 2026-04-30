"""
Body-zone catalog + patient photo gallery API.

Photos are uploaded as multipart, persisted via services.photo_storage
(local fs in dev; swap to S3 in prod), and served back through an
authenticated GET endpoint so consent + tenant isolation are enforced
on every read.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.patient import Patient
from app.models.photo import (
    BodyZone,
    PatientPhoto,
    PhotoAngle,
    PhotoConsentScope,
    PhotoStage,
    ZoneCategory,
)
from app.models.user import User
from app.schemas.photo import (
    BodyZoneCreate,
    BodyZoneListResponse,
    BodyZoneResponse,
    PhotoListResponse,
    PhotoResponse,
)
from app.services import photo_storage
from app.services.zone_seed import seed_zones_for_clinic


router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


# ---------- Zones -------------------------------------------------------

@router.get("/zones", response_model=BodyZoneListResponse)
async def list_zones(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(BodyZone)
        .where(BodyZone.clinic_id == clinic_id, BodyZone.is_active.is_(True))
        .order_by(BodyZone.sort_order.asc(), BodyZone.name_fr.asc())
    )
    rows = list(res.scalars().all())
    return BodyZoneListResponse(
        zones=[BodyZoneResponse.model_validate(r) for r in rows],
        total=len(rows),
    )


@router.post("/zones/seed")
async def seed_zones(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    inserted = await seed_zones_for_clinic(db, clinic_id)
    return {"inserted": inserted}


@router.post("/zones", response_model=BodyZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    body: BodyZoneCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    try:
        cat = ZoneCategory(body.category)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown category: {body.category}")
    z = BodyZone(
        clinic_id=clinic_id,
        slug=body.slug,
        name_fr=body.name_fr,
        name_ar=body.name_ar,
        name_en=body.name_en,
        category=cat,
        sort_order=body.sort_order,
    )
    db.add(z)
    await db.commit()
    await db.refresh(z)
    return BodyZoneResponse.model_validate(z)


# ---------- Photos ------------------------------------------------------

@router.get("", response_model=PhotoListResponse)
async def list_photos(
    patient_id: uuid.UUID,
    zone_slug: str | None = None,
    stage: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    stmt = (
        select(PatientPhoto)
        .where(
            PatientPhoto.clinic_id == clinic_id,
            PatientPhoto.patient_id == patient_id,
            PatientPhoto.deleted_at.is_(None),
        )
        .order_by(PatientPhoto.captured_at.desc())
    )
    if zone_slug:
        stmt = stmt.where(PatientPhoto.zone_slug == zone_slug)
    if stage:
        try:
            stmt = stmt.where(PatientPhoto.stage == PhotoStage(stage))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown stage: {stage}")
    res = await db.execute(stmt)
    rows = list(res.scalars().all())
    return PhotoListResponse(
        photos=[PhotoResponse.model_validate(r) for r in rows],
        total=len(rows),
    )


@router.post("/upload", response_model=PhotoResponse, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    patient_id: uuid.UUID = Form(...),
    zone_slug: str = Form(...),
    stage: str = Form("before"),
    angle: str | None = Form(None),
    consent_scope: str = Form("medical"),
    plan_id: uuid.UUID | None = Form(None),
    appointment_id: uuid.UUID | None = Form(None),
    note: str | None = Form(None),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    # Validate patient
    pres = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    if not pres.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    # Validate zone
    zres = await db.execute(
        select(BodyZone).where(BodyZone.clinic_id == clinic_id, BodyZone.slug == zone_slug)
    )
    if not zres.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Unknown zone: {zone_slug}")

    # Validate enums
    try:
        stage_enum = PhotoStage(stage)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown stage: {stage}")
    angle_enum: PhotoAngle | None = None
    if angle:
        try:
            angle_enum = PhotoAngle(angle)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown angle: {angle}")
    try:
        consent_enum = PhotoConsentScope(consent_scope)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown consent_scope: {consent_scope}")

    # Read + persist
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 25 MB)")

    ext = (file.filename or "").rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    storage_key, size_bytes = photo_storage.save(
        clinic_id=clinic_id,
        patient_id=patient_id,
        ext=ext,
        data=data,
    )

    photo = PatientPhoto(
        clinic_id=clinic_id,
        patient_id=patient_id,
        plan_id=plan_id,
        appointment_id=appointment_id,
        captured_by=user.id,
        storage="local",
        storage_key=storage_key,
        content_type=file.content_type or "image/jpeg",
        size_bytes=size_bytes,
        zone_slug=zone_slug,
        stage=stage_enum,
        angle=angle_enum,
        consent_scope=consent_enum,
        captured_at=datetime.now(timezone.utc),
        note=note,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return PhotoResponse.model_validate(photo)


@router.get("/{photo_id}/file")
async def serve_photo_file(
    photo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(PatientPhoto).where(
            PatientPhoto.id == photo_id,
            PatientPhoto.clinic_id == clinic_id,
            PatientPhoto.deleted_at.is_(None),
        )
    )
    photo = res.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    try:
        data = photo_storage.open_bytes(photo.storage_key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Photo file missing on disk")

    return StreamingResponse(
        iter([data]),
        media_type=photo.content_type or "image/jpeg",
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    photo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(PatientPhoto).where(
            PatientPhoto.id == photo_id,
            PatientPhoto.clinic_id == clinic_id,
            PatientPhoto.deleted_at.is_(None),
        )
    )
    photo = res.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    photo.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return None
