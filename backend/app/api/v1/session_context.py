"""
Active session context — powers the doctor's checklist card.

When a patient is IN_ROOM, this returns everything the checklist needs:
  - mode: "seance" (plan) or "consultation" (standalone)
  - plan + séance info if applicable
  - completion flags for each checklist step
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.appointment import Appointment, AppointmentStatus
from app.models.billing import Invoice
from app.models.consent import ConsentStatus, PatientConsent
from app.models.consultation import Consultation
from app.models.patient import IntakeStatus, Patient
from app.models.photo import PatientPhoto
from app.models.prescription import Prescription
from app.models.screening import PatientScreening
from app.models.treatment_plan import TreatmentPlan, TreatmentSession
from app.models.user import User

router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


class SessionContext(BaseModel):
    active: bool = False
    mode: str = "consultation"  # "consultation" | "seance"
    # Appointment
    appointment_id: str | None = None
    treatment: str | None = None
    # Plan/séance (if mode=seance)
    plan_id: str | None = None
    plan_title: str | None = None
    session_id: str | None = None
    session_number: int | None = None
    total_sessions: int | None = None
    # Checklist flags
    screening_ok: bool = False
    screening_flags: int = 0
    consent_signed: bool = False
    consent_pending: bool = False
    photos_before: int = 0
    photos_after: int = 0
    soap_exists: bool = False
    soap_id: str | None = None
    ordonnance_exists: bool = False
    can_terminate: bool = False


@router.get("/{patient_id}/session-context", response_model=SessionContext)
async def get_session_context(
    patient_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    # Check patient exists + is in room
    p_res = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    patient = p_res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient.intake_status != IntakeStatus.IN_ROOM:
        return SessionContext(active=False)

    today = date.today()
    ctx = SessionContext(active=True)

    # Find today's active appointment
    appt_res = await db.execute(
        select(Appointment).where(
            Appointment.clinic_id == clinic_id,
            Appointment.patient_id == patient_id,
            Appointment.appointment_date == today,
            Appointment.status.in_([
                AppointmentStatus.IN_PROGRESS,
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.SCHEDULED,
            ]),
        ).order_by(Appointment.created_at.desc()).limit(1)
    )
    appt = appt_res.scalar_one_or_none()
    if appt:
        ctx.appointment_id = str(appt.id)
        ctx.treatment = appt.treatment

    # Detect plan séance
    if appt:
        sess_res = await db.execute(
            select(TreatmentSession, TreatmentPlan)
            .join(TreatmentPlan, TreatmentPlan.id == TreatmentSession.plan_id)
            .where(TreatmentSession.appointment_id == appt.id)
        )
        row = sess_res.first()
        if row:
            session, plan = row
            ctx.mode = "seance"
            ctx.plan_id = str(plan.id)
            ctx.plan_title = plan.title
            ctx.session_id = str(session.id)
            ctx.session_number = session.session_number
            ctx.total_sessions = plan.total_sessions

    # Screening
    scr_res = await db.execute(
        select(PatientScreening).where(
            PatientScreening.clinic_id == clinic_id,
            PatientScreening.patient_id == patient_id,
        )
    )
    screening = scr_res.scalar_one_or_none()
    if screening and screening.assessed_at:
        flags = sum(
            1 for col in [
                "pregnancy_or_breastfeeding", "drug_allergies", "blood_thinners",
                "autoimmune_disease", "uncontrolled_diabetes", "active_cancer",
                "local_skin_infection", "active_herpes", "bleeding_disorder",
                "keloid_scarring", "uncontrolled_hypertension", "thyroid_disease",
                "implants_or_devices", "tattoo_or_pigment_in_zone", "prior_injectables",
                "recent_isotretinoin", "recent_sun_exposure", "herbal_supplements",
                "body_dysmorphia_concern",
            ] if getattr(screening, col) is True
        )
        ctx.screening_ok = True
        ctx.screening_flags = flags

    # Consent
    consent_res = await db.execute(
        select(PatientConsent).where(
            PatientConsent.clinic_id == clinic_id,
            PatientConsent.patient_id == patient_id,
        ).order_by(PatientConsent.created_at.desc()).limit(1)
    )
    consent = consent_res.scalar_one_or_none()
    if consent:
        ctx.consent_signed = consent.status.value == "signed"
        ctx.consent_pending = consent.status.value == "pending"

    # Photos today
    if appt:
        photo_res = await db.execute(
            select(
                PatientPhoto.stage,
                func.count(PatientPhoto.id),
            ).where(
                PatientPhoto.clinic_id == clinic_id,
                PatientPhoto.patient_id == patient_id,
                PatientPhoto.appointment_id == appt.id,
                PatientPhoto.deleted_at.is_(None),
            ).group_by(PatientPhoto.stage)
        )
        for stage, count in photo_res.all():
            if stage.value == "before":
                ctx.photos_before = count
            elif stage.value in ("after", "follow_up"):
                ctx.photos_after = count

    # SOAP consultation today
    consult_res = await db.execute(
        select(Consultation).where(
            Consultation.clinic_id == clinic_id,
            Consultation.patient_id == patient_id,
            Consultation.appointment_id == (appt.id if appt else None),
        ).order_by(Consultation.created_at.desc()).limit(1)
    )
    consult = consult_res.scalar_one_or_none()
    if consult:
        ctx.soap_exists = True
        ctx.soap_id = str(consult.id)

    # Ordonnance today
    if appt:
        rx_res = await db.execute(
            select(func.count(Prescription.id)).where(
                Prescription.clinic_id == clinic_id,
                Prescription.patient_id == patient_id,
                Prescription.appointment_id == appt.id,
            )
        )
        ctx.ordonnance_exists = (rx_res.scalar_one() or 0) > 0

    # Can terminate: minimum = screening done + SOAP exists
    ctx.can_terminate = ctx.screening_ok and ctx.soap_exists

    return ctx
