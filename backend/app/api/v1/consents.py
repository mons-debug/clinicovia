"""Patient consent forms API — create, sign, list, revoke, PDF."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.consent import ConsentStatus, ConsentType, PatientConsent
from app.models.clinic import Clinic
from app.models.patient import Patient
from app.models.user import User as UserModel
from app.models.user import User

router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


# ── Schemas ──────────────────────────────────────────────────────

class ConsentCreate(BaseModel):
    patient_id: uuid.UUID
    consent_type: str = "treatment"
    title: str = Field(min_length=1, max_length=255)
    body_text: str | None = None
    treatment_name: str | None = None
    plan_id: uuid.UUID | None = None


class ConsentSign(BaseModel):
    signature_data: str = Field(min_length=10)


class ConsentResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID | None
    consent_type: str
    title: str
    body_text: str | None
    treatment_name: str | None
    plan_id: uuid.UUID | None
    status: str
    signature_data: str | None
    signed_at: datetime | None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Endpoints ────────────────────────────────────────────────────

@router.get("", response_model=list[ConsentResponse])
async def list_consents(
    patient_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(PatientConsent).where(
            PatientConsent.clinic_id == clinic_id,
            PatientConsent.patient_id == patient_id,
        ).order_by(PatientConsent.created_at.desc())
    )
    return [ConsentResponse.model_validate(c) for c in res.scalars().all()]


@router.post("", response_model=ConsentResponse, status_code=201)
async def create_consent(
    body: ConsentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    pres = await db.execute(
        select(Patient).where(Patient.id == body.patient_id, Patient.clinic_id == clinic_id)
    )
    if not pres.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    try:
        ct = ConsentType(body.consent_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown consent type: {body.consent_type}")

    consent = PatientConsent(
        clinic_id=clinic_id,
        patient_id=body.patient_id,
        doctor_id=user.id,
        consent_type=ct,
        title=body.title,
        body_text=body.body_text,
        treatment_name=body.treatment_name,
        plan_id=body.plan_id,
        status=ConsentStatus.PENDING,
    )
    db.add(consent)
    await db.commit()
    await db.refresh(consent)
    return ConsentResponse.model_validate(consent)


@router.post("/{consent_id}/sign", response_model=ConsentResponse)
async def sign_consent(
    consent_id: uuid.UUID,
    body: ConsentSign,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(PatientConsent).where(
            PatientConsent.id == consent_id,
            PatientConsent.clinic_id == clinic_id,
        )
    )
    consent = res.scalar_one_or_none()
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")
    if consent.status != ConsentStatus.PENDING:
        raise HTTPException(status_code=409, detail=f"Cannot sign: status is {consent.status.value}")

    consent.signature_data = body.signature_data
    consent.signed_at = datetime.now(timezone.utc)
    consent.signed_ip = request.client.host if request.client else None
    consent.status = ConsentStatus.SIGNED

    await db.commit()
    await db.refresh(consent)
    return ConsentResponse.model_validate(consent)


@router.post("/{consent_id}/revoke", response_model=ConsentResponse)
async def revoke_consent(
    consent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(PatientConsent).where(
            PatientConsent.id == consent_id,
            PatientConsent.clinic_id == clinic_id,
        )
    )
    consent = res.scalar_one_or_none()
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")

    consent.status = ConsentStatus.REVOKED
    consent.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(consent)
    return ConsentResponse.model_validate(consent)


@router.get("/{consent_id}/pdf")
async def consent_pdf(
    consent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Render the consent as a downloadable PDF."""
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(PatientConsent).where(
            PatientConsent.id == consent_id,
            PatientConsent.clinic_id == clinic_id,
        )
    )
    consent = res.scalar_one_or_none()
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")

    clinic_res = await db.execute(select(Clinic).where(Clinic.id == clinic_id))
    clinic = clinic_res.scalar_one()

    patient_res = await db.execute(select(Patient).where(Patient.id == consent.patient_id))
    patient = patient_res.scalar_one()

    doctor = None
    if consent.doctor_id:
        doc_res = await db.execute(select(UserModel).where(UserModel.id == consent.doctor_id))
        doctor = doc_res.scalar_one_or_none()

    from app.services.pdf import render_consent_pdf
    pdf_bytes = render_consent_pdf(clinic=clinic, patient=patient, consent=consent, doctor=doctor)

    filename = f"consentement-{patient.last_name}-{consent.treatment_name or 'acte'}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
