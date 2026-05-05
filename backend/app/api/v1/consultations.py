"""
Consultation (SOAP) API.

  POST   /consultations              create draft (no number yet)
  POST   /consultations/:id/sign     locks CONS-YYYY-NNNN, status=signed
  POST   /consultations/:id/cancel   soft-cancel
  GET    /consultations?patient_id=  list
  GET    /consultations/:id          detail
  PATCH  /consultations/:id          edit while still draft
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.consultation import (
    Consultation,
    ConsultationCounter,
    ConsultationStatus,
)
from app.models.patient import Patient
from app.models.user import User
from app.schemas.consultation import (
    CancelRequest,
    ConsultationCreate,
    ConsultationListResponse,
    ConsultationResponse,
    ConsultationUpdate,
)


router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


async def _next_consultation_number(db: AsyncSession, clinic_id: uuid.UUID, year: int) -> str:
    res = await db.execute(
        select(ConsultationCounter)
        .where(ConsultationCounter.clinic_id == clinic_id, ConsultationCounter.year == year)
        .with_for_update()
    )
    counter = res.scalar_one_or_none()
    if counter is None:
        counter = ConsultationCounter(clinic_id=clinic_id, year=year, last_number=0)
        db.add(counter)
        await db.flush()
    counter.last_number += 1
    return f"CONS-{year}-{counter.last_number:04d}"


# ---------- List + create ----------------------------------------------

@router.get("", response_model=ConsultationListResponse)
async def list_consultations(
    patient_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    stmt = (
        select(Consultation)
        .where(Consultation.clinic_id == clinic_id)
        .order_by(Consultation.created_at.desc())
    )
    if patient_id is not None:
        stmt = stmt.where(Consultation.patient_id == patient_id)
    res = await db.execute(stmt)
    rows = list(res.scalars().all())
    return ConsultationListResponse(
        consultations=[ConsultationResponse.model_validate(r) for r in rows],
        total=len(rows),
    )


@router.post("", response_model=ConsultationResponse, status_code=status.HTTP_201_CREATED)
async def create_consultation(
    body: ConsultationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    pres = await db.execute(
        select(Patient).where(Patient.id == body.patient_id, Patient.clinic_id == clinic_id)
    )
    if not pres.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    cons = Consultation(
        clinic_id=clinic_id,
        patient_id=body.patient_id,
        appointment_id=body.appointment_id,
        plan_id=body.plan_id,
        session_id=body.session_id,
        doctor_id=user.id,
        number=f"DRAFT-{uuid.uuid4().hex[:8].upper()}",
        visit_date=body.visit_date or date.today(),
        language=body.language or "fr",
        chief_complaint=body.chief_complaint,
        subjective=body.subjective,
        objective=body.objective,
        assessment=body.assessment,
        plan_text=body.plan_text,
        notes=body.notes,
        status=ConsultationStatus.DRAFT,
    )
    db.add(cons)
    await db.commit()
    await db.refresh(cons)
    return ConsultationResponse.model_validate(cons)


# ---------- Detail / update --------------------------------------------

@router.get("/{cons_id}", response_model=ConsultationResponse)
async def get_consultation(
    cons_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Consultation).where(
            Consultation.id == cons_id,
            Consultation.clinic_id == clinic_id,
        )
    )
    cons = res.scalar_one_or_none()
    if not cons:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return ConsultationResponse.model_validate(cons)


@router.patch("/{cons_id}", response_model=ConsultationResponse)
async def update_consultation(
    cons_id: uuid.UUID,
    body: ConsultationUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Consultation).where(
            Consultation.id == cons_id,
            Consultation.clinic_id == clinic_id,
        )
    )
    cons = res.scalar_one_or_none()
    if not cons:
        raise HTTPException(status_code=404, detail="Consultation not found")
    if cons.status != ConsultationStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Only draft consultations can be edited")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cons, k, v)

    await db.commit()
    await db.refresh(cons)
    return ConsultationResponse.model_validate(cons)


@router.post("/{cons_id}/sign", response_model=ConsultationResponse)
async def sign_consultation(
    cons_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Consultation)
        .where(Consultation.id == cons_id, Consultation.clinic_id == clinic_id)
        .with_for_update()
    )
    cons = res.scalar_one_or_none()
    if not cons:
        raise HTTPException(status_code=404, detail="Consultation not found")
    if cons.status != ConsultationStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Only draft consultations can be signed")

    year = cons.visit_date.year
    cons.number = await _next_consultation_number(db, clinic_id, year)
    cons.status = ConsultationStatus.SIGNED
    cons.signed_at = datetime.now(timezone.utc)
    cons.doctor_id = user.id
    await db.commit()
    await db.refresh(cons)
    return ConsultationResponse.model_validate(cons)


@router.post("/{cons_id}/cancel", response_model=ConsultationResponse)
async def cancel_consultation(
    cons_id: uuid.UUID,
    body: CancelRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Consultation).where(
            Consultation.id == cons_id,
            Consultation.clinic_id == clinic_id,
        )
    )
    cons = res.scalar_one_or_none()
    if not cons:
        raise HTTPException(status_code=404, detail="Consultation not found")
    if cons.status == ConsultationStatus.CANCELLED:
        raise HTTPException(status_code=409, detail="Already cancelled")

    cons.status = ConsultationStatus.CANCELLED
    cons.cancelled_at = datetime.now(timezone.utc)
    cons.cancel_reason = body.reason
    await db.commit()
    await db.refresh(cons)
    return ConsultationResponse.model_validate(cons)
