"""
Prescriptions (ordonnances) + drug catalog API.

Issuance flow mirrors invoices:
  POST /prescriptions               draft (no number)
  POST /prescriptions/:id/sign      locks ORD-YYYY-NNNN, status=signed
  POST /prescriptions/:id/cancel    soft-cancel
  GET  /prescriptions/:id/pdf       Maroc-conforme PDF
  POST /prescriptions/seed-drugs    populate the catalog with the
                                    common Maroc DCI list (idempotent)
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.clinic import Clinic
from app.models.patient import Patient
from app.models.prescription import (
    Drug,
    DrugForm,
    Prescription,
    PrescriptionCounter,
    PrescriptionStatus,
)
from app.models.user import User
from app.schemas.prescription import (
    CancelRequest,
    DrugCreate,
    DrugListResponse,
    DrugResponse,
    PrescriptionCreate,
    PrescriptionListResponse,
    PrescriptionResponse,
)
from app.services.drug_seed import seed_drugs_for_clinic
from app.services.pdf import render_prescription_pdf


router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


async def _next_prescription_number(db: AsyncSession, clinic_id: uuid.UUID, year: int) -> str:
    res = await db.execute(
        select(PrescriptionCounter)
        .where(PrescriptionCounter.clinic_id == clinic_id, PrescriptionCounter.year == year)
        .with_for_update()
    )
    counter = res.scalar_one_or_none()
    if counter is None:
        counter = PrescriptionCounter(clinic_id=clinic_id, year=year, last_number=0)
        db.add(counter)
        await db.flush()
    counter.last_number += 1
    return f"ORD-{year}-{counter.last_number:04d}"


# ---------- Drugs -------------------------------------------------------

@router.get("/drugs", response_model=DrugListResponse)
async def list_drugs(
    search: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    stmt = (
        select(Drug)
        .where(Drug.clinic_id == clinic_id, Drug.is_active.is_(True))
        .order_by(Drug.dci.asc())
    )
    if search:
        like = f"%{search.lower()}%"
        from sqlalchemy import func, or_
        stmt = stmt.where(
            or_(
                func.lower(Drug.dci).like(like),
                func.lower(Drug.brand).like(like),
            )
        )
    res = await db.execute(stmt.limit(60))
    rows = list(res.scalars().all())
    return DrugListResponse(
        drugs=[DrugResponse.model_validate(r) for r in rows],
        total=len(rows),
    )


@router.post("/drugs", response_model=DrugResponse, status_code=status.HTTP_201_CREATED)
async def create_drug(
    body: DrugCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    try:
        form = DrugForm(body.form)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown form: {body.form}")
    drug = Drug(
        clinic_id=clinic_id,
        dci=body.dci,
        brand=body.brand,
        form=form,
        strength=body.strength,
        drug_class=body.drug_class,
        default_posology=body.default_posology,
        default_duration=body.default_duration,
    )
    db.add(drug)
    await db.commit()
    await db.refresh(drug)
    return DrugResponse.model_validate(drug)


@router.post("/seed-drugs")
async def seed_drugs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Populate the clinic's drug catalog with common Maroc DCI."""
    clinic_id = _get_clinic_id(user)
    inserted = await seed_drugs_for_clinic(db, clinic_id)
    return {"inserted": inserted}


# ---------- Prescriptions ----------------------------------------------

@router.get("", response_model=PrescriptionListResponse)
async def list_prescriptions(
    patient_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    stmt = (
        select(Prescription)
        .where(Prescription.clinic_id == clinic_id)
        .order_by(Prescription.created_at.desc())
    )
    if patient_id is not None:
        stmt = stmt.where(Prescription.patient_id == patient_id)
    res = await db.execute(stmt)
    rows = list(res.scalars().all())
    return PrescriptionListResponse(
        prescriptions=[PrescriptionResponse.model_validate(r) for r in rows],
        total=len(rows),
    )


@router.post("", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    body: PrescriptionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    # Validate patient
    pres = await db.execute(
        select(Patient).where(Patient.id == body.patient_id, Patient.clinic_id == clinic_id)
    )
    if not pres.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    if not body.lines:
        raise HTTPException(status_code=400, detail="At least one drug line is required")

    rx = Prescription(
        clinic_id=clinic_id,
        patient_id=body.patient_id,
        plan_id=body.plan_id,
        appointment_id=body.appointment_id,
        doctor_id=user.id,
        number=f"DRAFT-{uuid.uuid4().hex[:8].upper()}",
        issue_date=body.issue_date or date.today(),
        language=body.language or "fr",
        lines=[li.model_dump() for li in body.lines],
        diagnosis=body.diagnosis,
        notes=body.notes,
        renewable=body.renewable,
        status=PrescriptionStatus.DRAFT,
    )
    db.add(rx)
    await db.commit()
    await db.refresh(rx)
    return PrescriptionResponse.model_validate(rx)


@router.get("/{prescription_id}", response_model=PrescriptionResponse)
async def get_prescription(
    prescription_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Prescription).where(
            Prescription.id == prescription_id,
            Prescription.clinic_id == clinic_id,
        )
    )
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return PrescriptionResponse.model_validate(rx)


@router.post("/{prescription_id}/sign", response_model=PrescriptionResponse)
async def sign_prescription(
    prescription_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Prescription)
        .where(Prescription.id == prescription_id, Prescription.clinic_id == clinic_id)
        .with_for_update()
    )
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if rx.status != PrescriptionStatus.DRAFT:
        raise HTTPException(status_code=409, detail=f"Only draft prescriptions can be signed (current: {rx.status.value})")

    year = rx.issue_date.year
    rx.number = await _next_prescription_number(db, clinic_id, year)
    rx.status = PrescriptionStatus.SIGNED
    rx.signed_at = datetime.now(timezone.utc)
    rx.doctor_id = user.id
    await db.commit()
    await db.refresh(rx)
    return PrescriptionResponse.model_validate(rx)


@router.post("/{prescription_id}/cancel", response_model=PrescriptionResponse)
async def cancel_prescription(
    prescription_id: uuid.UUID,
    body: CancelRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Prescription).where(
            Prescription.id == prescription_id,
            Prescription.clinic_id == clinic_id,
        )
    )
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if rx.status == PrescriptionStatus.CANCELLED:
        raise HTTPException(status_code=409, detail="Already cancelled")

    rx.status = PrescriptionStatus.CANCELLED
    rx.cancelled_at = datetime.now(timezone.utc)
    rx.cancel_reason = body.reason
    await db.commit()
    await db.refresh(rx)
    return PrescriptionResponse.model_validate(rx)


@router.get("/{prescription_id}/pdf")
async def prescription_pdf(
    prescription_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(Prescription).where(
            Prescription.id == prescription_id,
            Prescription.clinic_id == clinic_id,
        )
    )
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    pat = (await db.execute(select(Patient).where(Patient.id == rx.patient_id))).scalar_one()
    cl = (await db.execute(select(Clinic).where(Clinic.id == clinic_id))).scalar_one()
    doctor = None
    if rx.doctor_id:
        doctor = (await db.execute(select(User).where(User.id == rx.doctor_id))).scalar_one_or_none()

    pdf_bytes = render_prescription_pdf(clinic=cl, patient=pat, prescription=rx, doctor=doctor)

    filename = f"{rx.number}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
