"""
Patient pre-treatment screening API.

19 binary contraindication flags + free-form notes. One row per
patient (idempotent upsert on PUT). Doctor-only edit.

Read access is open to anyone in the clinic (reception still needs
to see the count of red flags on the patient header).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.clinic import Role
from app.models.patient import Patient
from app.models.screening import PatientScreening
from app.models.user import User


router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


def _is_doctor_or_above(user: User) -> bool:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        return False
    return membership.role in (
        Role.DOCTOR,
        Role.MANAGER,
        Role.CLINIC_OWNER,
        Role.SUPER_ADMIN,
    )


# ── Flag list (kept in sync with the SQLAlchemy model) ──────────────
# Expose to clients so the UI can render labels / help text in FR.

FLAG_KEYS = [
    "pregnancy_or_breastfeeding",
    "drug_allergies",
    "blood_thinners",
    "autoimmune_disease",
    "uncontrolled_diabetes",
    "active_cancer",
    "local_skin_infection",
    "active_herpes",
    "bleeding_disorder",
    "keloid_scarring",
    "uncontrolled_hypertension",
    "thyroid_disease",
    "implants_or_devices",
    "tattoo_or_pigment_in_zone",
    "prior_injectables",
    "recent_isotretinoin",
    "recent_sun_exposure",
    "herbal_supplements",
    "body_dysmorphia_concern",
]


class ScreeningPayload(BaseModel):
    pregnancy_or_breastfeeding: bool | None = None
    drug_allergies: bool | None = None
    blood_thinners: bool | None = None
    autoimmune_disease: bool | None = None
    uncontrolled_diabetes: bool | None = None
    active_cancer: bool | None = None
    local_skin_infection: bool | None = None
    active_herpes: bool | None = None
    bleeding_disorder: bool | None = None
    keloid_scarring: bool | None = None
    uncontrolled_hypertension: bool | None = None
    thyroid_disease: bool | None = None
    implants_or_devices: bool | None = None
    tattoo_or_pigment_in_zone: bool | None = None
    prior_injectables: bool | None = None
    recent_isotretinoin: bool | None = None
    recent_sun_exposure: bool | None = None
    herbal_supplements: bool | None = None
    body_dysmorphia_concern: bool | None = None
    notes: str | None = None


class ScreeningResponse(ScreeningPayload):
    id: uuid.UUID
    patient_id: uuid.UUID
    assessed_by: uuid.UUID | None
    assessed_at: datetime | None
    flag_count: int   # how many fields are TRUE
    answered_count: int  # how many are not NULL
    model_config = {"from_attributes": True}


def _summary(row: PatientScreening) -> tuple[int, int]:
    flags = 0
    answered = 0
    for k in FLAG_KEYS:
        v = getattr(row, k)
        if v is True:
            flags += 1
        if v is not None:
            answered += 1
    return flags, answered


def _to_response(row: PatientScreening) -> ScreeningResponse:
    flag_count, answered_count = _summary(row)
    payload = {k: getattr(row, k) for k in FLAG_KEYS}
    return ScreeningResponse(
        id=row.id,
        patient_id=row.patient_id,
        assessed_by=row.assessed_by,
        assessed_at=row.assessed_at,
        flag_count=flag_count,
        answered_count=answered_count,
        notes=row.notes,
        **payload,
    )


@router.get("/{patient_id}/screening", response_model=ScreeningResponse | None)
async def get_screening(
    patient_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Read the screening row. Returns null if never assessed."""
    clinic_id = _get_clinic_id(user)

    res = await db.execute(
        select(PatientScreening).where(
            PatientScreening.clinic_id == clinic_id,
            PatientScreening.patient_id == patient_id,
        )
    )
    row = res.scalar_one_or_none()
    return _to_response(row) if row else None


@router.put("/{patient_id}/screening", response_model=ScreeningResponse)
async def upsert_screening(
    patient_id: uuid.UUID,
    body: ScreeningPayload,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or overwrite the screening row. Doctor-only."""
    clinic_id = _get_clinic_id(user)

    if not _is_doctor_or_above(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can record medical screenings",
        )

    # Verify patient belongs to clinic
    p_res = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    if not p_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    res = await db.execute(
        select(PatientScreening).where(
            PatientScreening.clinic_id == clinic_id,
            PatientScreening.patient_id == patient_id,
        )
    )
    row = res.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    payload = body.model_dump(exclude_unset=False)

    if row is None:
        row = PatientScreening(
            clinic_id=clinic_id,
            patient_id=patient_id,
            assessed_by=user.id,
            assessed_at=now,
            **payload,
        )
        db.add(row)
    else:
        for k, v in payload.items():
            setattr(row, k, v)
        row.assessed_by = user.id
        row.assessed_at = now

    await db.commit()
    await db.refresh(row)
    return _to_response(row)
