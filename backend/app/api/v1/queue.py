"""
Queue (salle d'attente) — reception <-> doctor workflow API.

Three buckets matter for the live board:
  - intake_pending   reception filled the form, patient is sitting down
  - awaiting_doctor  reception checked the patient in, doctor's turn
  - in_room          doctor called the patient in

The doctor's "Done" action moves the row to ACTIVE (out of the board).
Archive is destructive (removes from queue, sets archived_at).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import date as date_type, datetime, time as time_type, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.appointment import Appointment, AppointmentKind, AppointmentStatus
from app.models.patient import IntakeStatus, Patient
from app.models.user import User
from app.schemas.appointment import AppointmentResponse
from app.schemas.patient import PatientResponse


router = APIRouter()


# ---------- Helpers -----------------------------------------------------

def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


# Allowed transitions — protects the state machine from accidental moves
TRANSITIONS: dict[IntakeStatus, set[IntakeStatus]] = {
    IntakeStatus.INTAKE_PENDING: {IntakeStatus.AWAITING_DOCTOR, IntakeStatus.ARCHIVED},
    IntakeStatus.AWAITING_DOCTOR: {IntakeStatus.IN_ROOM, IntakeStatus.INTAKE_PENDING, IntakeStatus.ARCHIVED},
    IntakeStatus.IN_ROOM: {
        IntakeStatus.CHECKOUT_PENDING,  # normal happy path: consultation → reception
        IntakeStatus.ACTIVE,             # bypass payment (free follow-up, etc.)
        IntakeStatus.AWAITING_DOCTOR,   # mistake — patient back to waiting
        IntakeStatus.ARCHIVED,
    },
    IntakeStatus.CHECKOUT_PENDING: {
        IntakeStatus.ACTIVE,             # paid → done
        IntakeStatus.IN_ROOM,            # doctor called them back
        IntakeStatus.ARCHIVED,
    },
    IntakeStatus.ACTIVE: {IntakeStatus.AWAITING_DOCTOR, IntakeStatus.ARCHIVED},
    IntakeStatus.ARCHIVED: set(),  # terminal
}


# ---------- Schemas -----------------------------------------------------

class CheckoutDocuments(BaseModel):
    patient_id: str
    invoice_id: str | None = None
    invoice_number: str | None = None
    invoice_total: float | None = None
    prescription_ids: list[str] = []
    prescription_numbers: list[str] = []


class InRoomDocuments(BaseModel):
    patient_id: str
    consent_id: str | None = None
    consent_status: str | None = None
    invoice_id: str | None = None
    invoice_number: str | None = None
    invoice_total: float | None = None
    invoice_status: str | None = None
    prescription_ids: list[str] = []
    prescription_numbers: list[str] = []


class QueueBoard(BaseModel):
    intake_pending: list[PatientResponse]
    awaiting_doctor: list[PatientResponse]
    in_room: list[PatientResponse]
    checkout_pending: list[PatientResponse]
    checkout_documents: list[CheckoutDocuments] = []
    in_room_documents: list[InRoomDocuments] = []
    counts: dict[str, int]


class IntakeAdvanceRequest(BaseModel):
    to_status: str  # one of: intake_pending | awaiting_doctor | in_room | active | archived


# ---------- Endpoints ---------------------------------------------------

@router.get("", response_model=QueueBoard)
async def get_queue(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return today's salle d'attente — three buckets + counts."""
    clinic_id = _get_clinic_id(user)

    async def _bucket(status: IntakeStatus) -> list[Patient]:
        result = await db.execute(
            select(Patient)
            .options(selectinload(Patient.tags))
            .where(
                Patient.clinic_id == clinic_id,
                Patient.intake_status == status,
                Patient.archived_at.is_(None),
            )
            .order_by(Patient.intake_at.asc().nullsfirst(), Patient.created_at.asc())
        )
        return list(result.scalars().all())

    pending = await _bucket(IntakeStatus.INTAKE_PENDING)
    awaiting = await _bucket(IntakeStatus.AWAITING_DOCTOR)
    in_room = await _bucket(IntakeStatus.IN_ROOM)
    checkout = await _bucket(IntakeStatus.CHECKOUT_PENDING)

    # Enrich checkout patients with their draft invoice + prescriptions
    # so reception can click directly to view/print.
    from app.models.billing import Invoice, InvoiceStatus
    from app.models.prescription import Prescription

    checkout_docs: list[CheckoutDocuments] = []
    for p in checkout:
        doc = CheckoutDocuments(patient_id=str(p.id))

        # Latest draft invoice for this patient
        inv_res = await db.execute(
            select(Invoice).where(
                Invoice.clinic_id == clinic_id,
                Invoice.patient_id == p.id,
                Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.DRAFT]),
            ).order_by(Invoice.created_at.desc()).limit(1)
        )
        inv = inv_res.scalar_one_or_none()
        if inv:
            doc.invoice_id = str(inv.id)
            doc.invoice_number = inv.number
            doc.invoice_total = float(inv.total)

        # Recent prescriptions (today)
        rx_res = await db.execute(
            select(Prescription).where(
                Prescription.clinic_id == clinic_id,
                Prescription.patient_id == p.id,
            ).order_by(Prescription.created_at.desc()).limit(3)
        )
        for rx in rx_res.scalars().all():
            doc.prescription_ids.append(str(rx.id))
            doc.prescription_numbers.append(rx.number)

        checkout_docs.append(doc)

    # Enrich in-room patients with consent + invoice (for reception document handling)
    from app.models.consent import PatientConsent

    in_room_docs: list[InRoomDocuments] = []
    for p in in_room:
        if not p.prep_sent_at:
            continue
        doc = InRoomDocuments(patient_id=str(p.id))

        # Latest consent
        consent_res = await db.execute(
            select(PatientConsent).where(
                PatientConsent.clinic_id == clinic_id,
                PatientConsent.patient_id == p.id,
            ).order_by(PatientConsent.created_at.desc()).limit(1)
        )
        consent = consent_res.scalar_one_or_none()
        if consent:
            doc.consent_id = str(consent.id)
            doc.consent_status = consent.status.value

        # Latest invoice today
        today_start = datetime.combine(date_type.today(), time_type(0, 0), tzinfo=timezone.utc)
        inv_res2 = await db.execute(
            select(Invoice).where(
                Invoice.clinic_id == clinic_id,
                Invoice.patient_id == p.id,
                Invoice.created_at >= today_start,
            ).order_by(Invoice.created_at.desc()).limit(1)
        )
        inv2 = inv_res2.scalar_one_or_none()
        if inv2:
            doc.invoice_id = str(inv2.id)
            doc.invoice_number = inv2.number
            doc.invoice_total = float(inv2.total)
            doc.invoice_status = inv2.status.value

        # Prescriptions
        rx_res2 = await db.execute(
            select(Prescription).where(
                Prescription.clinic_id == clinic_id,
                Prescription.patient_id == p.id,
            ).order_by(Prescription.created_at.desc()).limit(3)
        )
        for rx in rx_res2.scalars().all():
            doc.prescription_ids.append(str(rx.id))
            doc.prescription_numbers.append(rx.number)

        in_room_docs.append(doc)

    return QueueBoard(
        intake_pending=[PatientResponse.model_validate(p) for p in pending],
        awaiting_doctor=[PatientResponse.model_validate(p) for p in awaiting],
        in_room=[PatientResponse.model_validate(p) for p in in_room],
        checkout_pending=[PatientResponse.model_validate(p) for p in checkout],
        checkout_documents=checkout_docs,
        in_room_documents=in_room_docs,
        counts={
            "intake_pending": len(pending),
            "awaiting_doctor": len(awaiting),
            "in_room": len(in_room),
            "checkout_pending": len(checkout),
        },
    )


@router.post("/{patient_id}/advance", response_model=PatientResponse)
async def advance_intake(
    patient_id: uuid.UUID,
    body: IntakeAdvanceRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move a patient through the intake state machine."""
    clinic_id = _get_clinic_id(user)

    # Resolve target status
    try:
        target = IntakeStatus(body.to_status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown intake status: {body.to_status}",
        )

    # Load patient (tenant-scoped, eager-load tags for the response)
    result = await db.execute(
        select(Patient)
        .options(selectinload(Patient.tags))
        .where(
            Patient.id == patient_id,
            Patient.clinic_id == clinic_id,
        )
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Enforce allowed transition
    current = patient.intake_status
    if target != current and target not in TRANSITIONS.get(current, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transition from {current.value} to {target.value}",
        )

    # Apply
    now = datetime.now(timezone.utc)
    patient.intake_status = target
    patient.intake_at = now
    # Clear the doctor-call ping when patient actually moves into the room
    # or out of the queue altogether — the ping is meaningless after that.
    if target in (IntakeStatus.IN_ROOM, IntakeStatus.ACTIVE, IntakeStatus.ARCHIVED):
        patient.doctor_called_at = None
    if target == IntakeStatus.ARCHIVED:
        patient.archived_at = now
        patient.is_active = False
    elif target != IntakeStatus.ARCHIVED and patient.archived_at is not None:
        patient.archived_at = None
        patient.is_active = True

    # ── Mark latest ISSUED invoice as paid + create Payment record ──
    if target == IntakeStatus.ACTIVE:
        from app.models.billing import Invoice, InvoiceStatus, Payment, PaymentMethod, PaymentKind
        today_start = datetime.combine(now.date(), time_type(0, 0), tzinfo=timezone.utc)
        inv_res = await db.execute(
            select(Invoice).where(
                Invoice.clinic_id == clinic_id,
                Invoice.patient_id == patient_id,
                Invoice.status == InvoiceStatus.ISSUED,
                Invoice.created_at >= today_start,
            ).order_by(Invoice.created_at.desc()).limit(1)
        )
        latest_inv = inv_res.scalar_one_or_none()
        if latest_inv:
            payment = Payment(
                clinic_id=clinic_id,
                invoice_id=latest_inv.id,
                received_by=user.id,
                amount=latest_inv.total,
                method=PaymentMethod.CASH,
                kind=PaymentKind.PAYMENT,
                received_at=now,
            )
            db.add(payment)
            latest_inv.total_paid = latest_inv.total
            latest_inv.status = InvoiceStatus.PAID

    # ── Sync today's appointment to match queue state ──────────────
    # This eliminates redundant "Arrivé" + "Commencer" clicks on the
    # calendar. The queue IS the source of truth for in-clinic flow;
    # the calendar appointment just reflects it.
    today = now.date()
    appt_res = await db.execute(
        select(Appointment).where(
            Appointment.clinic_id == clinic_id,
            Appointment.patient_id == patient_id,
            Appointment.appointment_date == today,
            Appointment.status.notin_([
                AppointmentStatus.COMPLETED,
                AppointmentStatus.CANCELLED,
                AppointmentStatus.NO_SHOW,
            ]),
        ).order_by(Appointment.created_at.desc()).limit(1)
    )
    linked_appt = appt_res.scalar_one_or_none()

    if linked_appt:
        if target == IntakeStatus.AWAITING_DOCTOR:
            linked_appt.status = AppointmentStatus.CHECKED_IN
            if not linked_appt.arrived_at:
                linked_appt.arrived_at = now
        elif target == IntakeStatus.IN_ROOM:
            linked_appt.status = AppointmentStatus.IN_PROGRESS
            if not linked_appt.arrived_at:
                linked_appt.arrived_at = now
            if not linked_appt.started_at:
                linked_appt.started_at = now

    await db.commit()
    await db.refresh(patient)
    return PatientResponse.model_validate(patient)


# ---------- Walk-in (existing patient arrives without appointment) -----

class WalkInRequest(BaseModel):
    requested_service: str | None = None
    note: str | None = None
    # When true (default): existing patient arrives → flip to AWAITING_DOCTOR.
    # When false: new patient just registered (still INTAKE_PENDING) — only
    # create the calendar entry, leave intake_status untouched. Used so the
    # new-patient walk-in flow can also surface on the calendar.
    flip_to_awaiting: bool = True
    is_first_visit: bool = False


@router.post("/{patient_id}/walk-in", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def walk_in_existing_patient(
    patient_id: uuid.UUID,
    body: WalkInRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Existing patient arrives without an appointment.

    Creates a placeholder Appointment with kind=walk_in, status=
    checked_in, doctor_id=null (assigned when called in), start at
    current rounded hour, end null. Calendar shows it under "today"
    with a dashed-border badge so reception sees true load.

    Patient.intake_status flips to AWAITING_DOCTOR so they appear in
    the queue board's En attente column immediately.
    """
    clinic_id = _get_clinic_id(user)

    res = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.clinic_id == clinic_id,
        )
    )
    patient = res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    now = datetime.now(timezone.utc)
    today = now.date()

    # Round start to the nearest 15 min so it sits cleanly on the grid
    rounded = now.replace(second=0, microsecond=0)
    minute = (rounded.minute // 15) * 15
    rounded = rounded.replace(minute=minute)

    # Status depends on whether reception is "checking them in" right
    # now (existing patient → CHECKED_IN) vs "they just walked through
    # the door, still filling form" (new patient → SCHEDULED).
    appt_status = AppointmentStatus.CHECKED_IN if body.flip_to_awaiting else AppointmentStatus.SCHEDULED

    appt = Appointment(
        clinic_id=clinic_id,
        patient_id=patient_id,
        doctor_id=None,
        appointment_date=today,
        start_time=rounded.timetz().replace(tzinfo=None),
        end_time=time_type(23, 59),  # placeholder — overwritten on Terminer
        duration_minutes=30,
        treatment=(body.requested_service or "Walk-in").strip(),
        kind=AppointmentKind.WALK_IN,
        status=appt_status,
        notes=body.note,
        is_first_visit=body.is_first_visit,
        arrived_at=now if body.flip_to_awaiting else None,
    )
    db.add(appt)
    await db.flush()

    # Only flip to AWAITING_DOCTOR if reception explicitly said the
    # patient is ready (existing-patient path). For new patients still
    # filling the dossier, keep them at INTAKE_PENDING.
    if body.flip_to_awaiting:
        patient.intake_status = IntakeStatus.AWAITING_DOCTOR
        patient.intake_at = now
    if body.requested_service:
        patient.requested_service = body.requested_service

    await db.commit()
    await db.refresh(appt)

    return AppointmentResponse.model_validate({
        **appt.__dict__,
        "patient_name": f"{patient.first_name} {patient.last_name}",
        "patient_phone": f"{patient.phone_country_code}{patient.phone}",
        "patient_initials": f"{patient.first_name[:1]}{patient.last_name[:1]}".upper(),
        "doctor_name": "",
        "doctor_color": "#6B7280",
    })


# ---------- Doctor → reception call signal -----------------------------

# ---------- End-of-visit checkout (from patient dossier) ---------------

class DossierCheckoutRequest(BaseModel):
    amount: float = 0.0
    follow_up_weeks: int | None = None
    notes: str | None = None


@router.post("/{patient_id}/checkout", response_model=PatientResponse)
async def checkout_from_dossier(
    patient_id: uuid.UUID,
    body: DossierCheckoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Doctor clicks 'Terminer la visite' on the patient dossier page.

    Finds today's in-progress appointment for this patient, closes it,
    creates invoice draft, schedules follow-up, flips patient to
    CHECKOUT_PENDING. Same logic as /calendar/:id/checkout but keyed
    by patient_id instead of appointment_id.
    """
    clinic_id = _get_clinic_id(user)

    res = await db.execute(
        select(Patient)
        .options(selectinload(Patient.tags))
        .where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    patient = res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient.intake_status != IntakeStatus.IN_ROOM:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Patient is not in consultation (status: {patient.intake_status.value})",
        )

    now = datetime.now(timezone.utc)
    today = now.date()

    # Find today's active appointment for this patient
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

    # Close the appointment
    if appt:
        appt.status = AppointmentStatus.COMPLETED
        appt.ended_at = now
        if not appt.started_at:
            appt.started_at = now
        if not appt.arrived_at:
            appt.arrived_at = now
        if not appt.doctor_id:
            appt.doctor_id = user.id

    # Move patient to checkout
    patient.intake_status = IntakeStatus.CHECKOUT_PENDING
    patient.intake_at = now
    patient.doctor_called_at = None
    patient.prep_sent_at = None

    # Find linked plan séance (if this appointment is part of a séance)
    from app.models.treatment_plan import TreatmentPlan, TreatmentSession, SessionStatus
    linked_plan_id = None
    linked_session = None
    if appt:
        sess_res = await db.execute(
            select(TreatmentSession).where(
                TreatmentSession.appointment_id == appt.id
            ).limit(1)
        )
        linked_session = sess_res.scalar_one_or_none()
        if linked_session:
            linked_plan_id = linked_session.plan_id

    # Auto-fill amount from session_price if doctor didn't specify
    effective_amount = float(body.amount) if body.amount else 0.0
    if effective_amount == 0.0 and linked_session and linked_session.session_price:
        effective_amount = float(linked_session.session_price)

    # Advance TreatmentSession to completed
    if linked_session and linked_session.status != SessionStatus.COMPLETED:
        linked_session.status = SessionStatus.COMPLETED
        linked_session.completed_at = now

    # Build richer checkout label for reception
    if linked_session and linked_plan_id:
        plan_res = await db.execute(
            select(TreatmentPlan).where(TreatmentPlan.id == linked_plan_id)
        )
        plan_obj = plan_res.scalar_one_or_none()
        plan_label = plan_obj.title if plan_obj else "Plan"
        checkout_label = (
            f"Séance {linked_session.session_number}"
            f" — {plan_label} · {int(effective_amount)} MAD"
        )
    else:
        checkout_label = f"{int(effective_amount)} MAD" if effective_amount else "Gratuit"
    if body.notes:
        checkout_label += f" · {body.notes}"
    patient.requested_service = checkout_label

    # Create or upgrade invoice
    from app.models.billing import Invoice, InvoiceStatus
    from app.api.v1.billing import _next_invoice_number

    # Check if invoice already exists (from Préparer flow — ISSUED or PAID)
    today_start = datetime.combine(date_type.today(), time_type(0, 0), tzinfo=timezone.utc)
    existing_issued_q = select(Invoice).where(
        Invoice.clinic_id == clinic_id,
        Invoice.patient_id == patient.id,
        Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PAID]),
        Invoice.created_at >= today_start,
    ).order_by(Invoice.created_at.desc()).limit(1)
    existing_issued_res = await db.execute(existing_issued_q)
    already_invoiced = existing_issued_res.scalar_one_or_none()

    if effective_amount > 0 and not already_invoiced:
        # Check for existing DRAFT invoice (created via séance step 5)
        draft_q = select(Invoice).where(
            Invoice.clinic_id == clinic_id,
            Invoice.patient_id == patient.id,
            Invoice.status == InvoiceStatus.DRAFT,
        )
        if linked_session:
            draft_q = draft_q.where(Invoice.session_id == linked_session.id)
        elif linked_plan_id:
            draft_q = draft_q.where(Invoice.plan_id == linked_plan_id)
        draft_q = draft_q.order_by(Invoice.created_at.desc()).limit(1)
        draft_res = await db.execute(draft_q)
        existing_draft = draft_res.scalar_one_or_none()

        treatment_label = appt.treatment if appt else "Consultation"
        inv_number = await _next_invoice_number(db, clinic_id, now.date().year)

        if existing_draft:
            # Upgrade draft → issued
            existing_draft.number = inv_number
            existing_draft.status = InvoiceStatus.ISSUED
            existing_draft.issued_at = now
            existing_draft.issued_by = user.id
            existing_draft.session_id = linked_session.id if linked_session else existing_draft.session_id
            # Update amount if doctor specified one, otherwise keep draft amount
            if body.amount and body.amount > 0:
                line_items = [{"label": treatment_label, "quantity": 1,
                               "unit_price": float(body.amount), "total": float(body.amount)}]
                existing_draft.line_items = line_items
                existing_draft.subtotal = float(body.amount)
                existing_draft.total = float(body.amount)
        else:
            # Create new ISSUED invoice
            line_items = [{"label": treatment_label, "quantity": 1,
                           "unit_price": effective_amount, "total": effective_amount}]
            inv = Invoice(
                clinic_id=clinic_id,
                patient_id=patient.id,
                plan_id=linked_plan_id,
                session_id=linked_session.id if linked_session else None,
                issued_by=user.id,
                number=inv_number,
                issue_date=now.date(),
                line_items=line_items,
                subtotal=effective_amount,
                discount=0.0,
                tva_rate=0.0,
                tva=0.0,
                total=effective_amount,
                currency="MAD",
                status=InvoiceStatus.ISSUED,
                issued_at=now,
                notes=body.notes,
            )
            db.add(inv)

    # Auto-schedule follow-up
    if body.follow_up_weeks and body.follow_up_weeks > 0:
        follow_date = (now + timedelta(weeks=body.follow_up_weeks)).date()
        follow = Appointment(
            clinic_id=clinic_id,
            patient_id=patient.id,
            doctor_id=appt.doctor_id if appt else user.id,
            appointment_date=follow_date,
            start_time=time_type(10, 0),
            end_time=time_type(10, 30),
            duration_minutes=30,
            treatment=appt.treatment if appt else "Suivi",
            kind=appt.kind if appt else AppointmentKind.CONSULTATION,
            status=AppointmentStatus.SCHEDULED,
            needs_confirmation=True,
            notes=body.notes,
        )
        db.add(follow)

    await db.commit()
    await db.refresh(patient)
    return PatientResponse.model_validate(patient)


@router.post("/{patient_id}/call", response_model=PatientResponse)
async def call_patient(
    patient_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Doctor pings reception that they want this patient next.

    Sets doctor_called_at = now(). Reception's queue board picks this
    up on the next poll (4 s) and pulses the card green + plays a chime.
    Patient stays in AWAITING_DOCTOR — reception still has to confirm
    the patient walked in via the standard "Entré en salle" advance.
    """
    clinic_id = _get_clinic_id(user)

    res = await db.execute(
        select(Patient)
        .options(selectinload(Patient.tags))
        .where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    patient = res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Only meaningful while the patient is awaiting the doctor
    if patient.intake_status != IntakeStatus.AWAITING_DOCTOR:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Patient is not awaiting the doctor (status: {patient.intake_status.value})",
        )

    now = datetime.now(timezone.utc)
    patient.doctor_called_at = now

    # Assign the calling doctor to today's unassigned walk-in appointment
    # so this patient surfaces on that doctor's calendar + dashboard.
    today = now.date()
    appt_res = await db.execute(
        select(Appointment).where(
            Appointment.clinic_id == clinic_id,
            Appointment.patient_id == patient_id,
            Appointment.appointment_date == today,
            Appointment.doctor_id.is_(None),
        )
    )
    for appt in appt_res.scalars().all():
        appt.doctor_id = user.id

    await db.commit()
    await db.refresh(patient)
    return PatientResponse.model_validate(patient)


@router.post("/{patient_id}/uncall", response_model=PatientResponse)
async def uncall_patient(
    patient_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Doctor cancels the call ping (changed mind, called wrong patient)."""
    clinic_id = _get_clinic_id(user)

    res = await db.execute(
        select(Patient)
        .options(selectinload(Patient.tags))
        .where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    patient = res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    patient.doctor_called_at = None
    await db.commit()
    await db.refresh(patient)
    return PatientResponse.model_validate(patient)


# ---------- Prepare session (mid-visit handoff to reception) -----------

class PrepareResponse(BaseModel):
    consent_id: str | None = None
    invoice_id: str | None = None
    message: str = "ok"


@router.post("/{patient_id}/prepare-session", response_model=PrepareResponse)
async def prepare_session(
    patient_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Doctor clicks 'Préparer' — creates consent + facture, sends to reception."""
    clinic_id = _get_clinic_id(user)

    res = await db.execute(
        select(Patient)
        .options(selectinload(Patient.tags))
        .where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    patient = res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.intake_status != IntakeStatus.IN_ROOM:
        raise HTTPException(status_code=409, detail="Patient is not in consultation")

    now = datetime.now(timezone.utc)
    today = now.date()

    # Find today's appointment
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
    treatment_name = appt.treatment if appt else "Consultation"

    # Find linked séance + plan
    from app.models.treatment_plan import TreatmentPlan, TreatmentSession
    linked_session = None
    linked_plan = None
    if appt:
        sess_res = await db.execute(
            select(TreatmentSession).where(
                TreatmentSession.appointment_id == appt.id
            ).limit(1)
        )
        linked_session = sess_res.scalar_one_or_none()
        if linked_session:
            plan_res = await db.execute(
                select(TreatmentPlan).where(TreatmentPlan.id == linked_session.plan_id)
            )
            linked_plan = plan_res.scalar_one_or_none()

    # 1. Create consent (PENDING) — skip if one already exists today
    from app.models.consent import PatientConsent, ConsentType, ConsentStatus
    existing_consent = await db.execute(
        select(PatientConsent).where(
            PatientConsent.clinic_id == clinic_id,
            PatientConsent.patient_id == patient_id,
            PatientConsent.status == ConsentStatus.PENDING,
        ).order_by(PatientConsent.created_at.desc()).limit(1)
    )
    consent = existing_consent.scalar_one_or_none()
    if not consent:
        consent = PatientConsent(
            clinic_id=clinic_id,
            patient_id=patient_id,
            doctor_id=user.id,
            consent_type=ConsentType.TREATMENT,
            title=f"Consentement — {treatment_name}",
            treatment_name=treatment_name,
            plan_id=linked_session.plan_id if linked_session else None,
            status=ConsentStatus.PENDING,
            body_text=(
                f"Je soussigné(e), autorise le Dr. à effectuer le traitement «{treatment_name}» "
                f"après avoir été informé(e) des risques, bénéfices et alternatives. "
                f"J'ai eu l'occasion de poser toutes mes questions."
            ),
        )
        db.add(consent)
        await db.flush()

    # 2. Create facture (ISSUED) — skip if one already exists
    from app.models.billing import Invoice, InvoiceStatus
    from app.api.v1.billing import _next_invoice_number
    session_price = linked_session.session_price if linked_session else 0
    existing_inv = await db.execute(
        select(Invoice).where(
            Invoice.clinic_id == clinic_id,
            Invoice.patient_id == patient_id,
            Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.DRAFT, InvoiceStatus.PAID]),
            Invoice.created_at >= datetime.combine(today, time_type(0, 0), tzinfo=timezone.utc),
        ).order_by(Invoice.created_at.desc()).limit(1)
    )
    invoice = existing_inv.scalar_one_or_none()
    if not invoice and session_price and session_price > 0:
        inv_number = await _next_invoice_number(db, clinic_id, today.year)
        invoice = Invoice(
            clinic_id=clinic_id,
            patient_id=patient_id,
            plan_id=linked_session.plan_id if linked_session else None,
            session_id=linked_session.id if linked_session else None,
            issued_by=user.id,
            number=inv_number,
            issue_date=today,
            line_items=[{
                "label": treatment_name,
                "quantity": 1,
                "unit_price": float(session_price),
                "total": float(session_price),
            }],
            subtotal=float(session_price),
            discount=0.0,
            tva_rate=0.0,
            tva=0.0,
            total=float(session_price),
            currency="MAD",
            status=InvoiceStatus.ISSUED,
            issued_at=now,
        )
        db.add(invoice)
        await db.flush()

    # 3. Set prep flag
    patient.prep_sent_at = now

    await db.commit()

    return PrepareResponse(
        consent_id=str(consent.id) if consent else None,
        invoice_id=str(invoice.id) if invoice else None,
        message="Consentement et facture envoyés à la réception",
    )
