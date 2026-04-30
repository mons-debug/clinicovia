"""
Treatment plans + sessions API.

Plan creation auto-generates `total_sessions` placeholder TreatmentSession
rows with sequential numbers and projected planned_for dates based on
the interval. Each session can later be linked to an appointment and
walked through the status state machine.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.appointment import Appointment
from app.models.billing import Invoice
from app.models.patient import Patient
from app.models.photo import PatientPhoto
from app.models.prescription import Prescription
from app.models.treatment_plan import (
    IntervalUnit,
    PlanStatus,
    SessionStatus,
    TreatmentPlan,
    TreatmentSession,
)
from app.models.user import User
from app.schemas.treatment_plan import (
    PlanCreate,
    PlanListResponse,
    PlanResponse,
    PlanUpdate,
    SessionAdvanceRequest,
    SessionResponse,
    SessionUpdateRequest,
)


router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


def _interval_to_timedelta(value: int, unit: IntervalUnit) -> timedelta:
    if unit == IntervalUnit.DAYS:
        return timedelta(days=value)
    if unit == IntervalUnit.WEEKS:
        return timedelta(weeks=value)
    if unit == IntervalUnit.MONTHS:
        return timedelta(days=30 * value)  # approximation
    return timedelta(weeks=value)


# Allowed session-status transitions
SESSION_TRANSITIONS: dict[SessionStatus, set[SessionStatus]] = {
    SessionStatus.PLANNED: {SessionStatus.SCHEDULED, SessionStatus.SKIPPED},
    SessionStatus.SCHEDULED: {SessionStatus.IN_PROGRESS, SessionStatus.PLANNED, SessionStatus.SKIPPED},
    SessionStatus.IN_PROGRESS: {SessionStatus.COMPLETED, SessionStatus.SCHEDULED},
    SessionStatus.COMPLETED: set(),
    SessionStatus.SKIPPED: {SessionStatus.PLANNED},
}


# ---------- List / create plans -----------------------------------------

@router.get("", response_model=PlanListResponse)
async def list_plans(
    patient_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    stmt = (
        select(TreatmentPlan)
        .options(selectinload(TreatmentPlan.sessions))
        .where(TreatmentPlan.clinic_id == clinic_id)
        .order_by(TreatmentPlan.created_at.desc())
    )
    if patient_id is not None:
        stmt = stmt.where(TreatmentPlan.patient_id == patient_id)

    result = await db.execute(stmt)
    plans = list(result.scalars().all())
    return PlanListResponse(
        plans=[PlanResponse.model_validate(p) for p in plans],
        total=len(plans),
    )


@router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    body: PlanCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    # Validate the patient belongs to this clinic
    pres = await db.execute(
        select(Patient).where(
            Patient.id == body.patient_id,
            Patient.clinic_id == clinic_id,
        )
    )
    if not pres.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    # Resolve enum
    try:
        unit = IntervalUnit(body.interval_unit)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown interval_unit: {body.interval_unit}")

    start = body.start_at or datetime.now(timezone.utc)

    plan = TreatmentPlan(
        clinic_id=clinic_id,
        patient_id=body.patient_id,
        created_by=user.id,
        doctor_id=body.doctor_id,
        title=body.title,
        primary_service=body.primary_service,
        indication_slugs=body.indication_slugs,
        zone_slugs=body.zone_slugs,
        total_sessions=body.total_sessions,
        interval_value=body.interval_value,
        interval_unit=unit,
        estimated_total=body.estimated_total,
        currency=body.currency or "MAD",
        notes=body.notes,
        start_at=start,
    )
    db.add(plan)
    await db.flush()

    # Auto-generate session placeholders
    delta = _interval_to_timedelta(body.interval_value, unit)
    sessions_created: list[TreatmentSession] = []
    for i in range(1, body.total_sessions + 1):
        s = TreatmentSession(
            clinic_id=clinic_id,
            plan_id=plan.id,
            session_number=i,
            planned_for=start + delta * (i - 1),
            status=SessionStatus.PLANNED,
        )
        db.add(s)
        sessions_created.append(s)
    await db.flush()

    # Smart-calendar: auto-create one appointment per session at the
    # configured default hour. Each session.appointment_id is back-linked
    # so the calendar / plan-timeline view ties them together.
    if body.auto_schedule:
        from datetime import time as _time
        from app.models.appointment import Appointment, AppointmentKind, AppointmentStatus
        start_t = _time(body.default_hour, body.default_minute)
        # end_time = start + duration (clamped within the same day)
        total_min = body.default_hour * 60 + body.default_minute + body.default_duration_minutes
        end_h = min(23, total_min // 60)
        end_m = min(59, total_min % 60)
        end_t = _time(end_h, end_m)
        treatment_label = body.primary_service or body.title
        for s in sessions_created:
            appt = Appointment(
                clinic_id=clinic_id,
                patient_id=body.patient_id,
                doctor_id=body.doctor_id,
                appointment_date=s.planned_for.date() if s.planned_for else start.date(),
                start_time=start_t,
                end_time=end_t,
                duration_minutes=body.default_duration_minutes,
                treatment=treatment_label,
                kind=AppointmentKind.SESSION,
                status=AppointmentStatus.SCHEDULED,
                needs_confirmation=True,  # reception confirms hour with patient
                notes=f"Plan « {plan.title} » — séance {s.session_number}/{body.total_sessions}",
            )
            db.add(appt)
            await db.flush()
            s.appointment_id = appt.id
            # Mark séance as scheduled (not just planned) since calendar slot exists
            s.status = SessionStatus.SCHEDULED

    await db.commit()

    # Reload with sessions
    res = await db.execute(
        select(TreatmentPlan)
        .options(selectinload(TreatmentPlan.sessions))
        .where(TreatmentPlan.id == plan.id)
    )
    plan = res.scalar_one()
    return PlanResponse.model_validate(plan)


# ---------- Detail / update --------------------------------------------

@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(
    plan_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(TreatmentPlan)
        .options(selectinload(TreatmentPlan.sessions))
        .where(
            TreatmentPlan.id == plan_id,
            TreatmentPlan.clinic_id == clinic_id,
        )
    )
    plan = res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return PlanResponse.model_validate(plan)


@router.patch("/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: uuid.UUID,
    body: PlanUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    res = await db.execute(
        select(TreatmentPlan)
        .options(selectinload(TreatmentPlan.sessions))
        .where(TreatmentPlan.id == plan_id, TreatmentPlan.clinic_id == clinic_id)
    )
    plan = res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    data = body.model_dump(exclude_unset=True)
    if "interval_unit" in data:
        try:
            data["interval_unit"] = IntervalUnit(data["interval_unit"])
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown interval_unit: {data['interval_unit']}")
    if "status" in data:
        try:
            new_status = PlanStatus(data["status"])
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown status: {data['status']}")
        data["status"] = new_status
        now = datetime.now(timezone.utc)
        if new_status == PlanStatus.COMPLETED:
            data.setdefault("completed_at", now)
        elif new_status == PlanStatus.CANCELLED:
            data.setdefault("cancelled_at", now)

    for k, v in data.items():
        setattr(plan, k, v)

    await db.commit()
    await db.refresh(plan)
    return PlanResponse.model_validate(plan)


# ---------- Session state advance --------------------------------------

@router.post("/sessions/{session_id}/advance", response_model=SessionResponse)
async def advance_session(
    session_id: uuid.UUID,
    body: SessionAdvanceRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    res = await db.execute(
        select(TreatmentSession).where(
            TreatmentSession.id == session_id,
            TreatmentSession.clinic_id == clinic_id,
        )
    )
    session_row = res.scalar_one_or_none()
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        target = SessionStatus(body.to_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown status: {body.to_status}")

    current = session_row.status
    if target != current and target not in SESSION_TRANSITIONS.get(current, set()):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot transition from {current.value} to {target.value}",
        )

    now = datetime.now(timezone.utc)
    session_row.status = target
    if target == SessionStatus.COMPLETED:
        session_row.completed_at = now
        if body.outcome_score is not None:
            session_row.outcome_score = body.outcome_score
        if body.outcome_note:
            session_row.outcome_note = body.outcome_note
    elif target == SessionStatus.SKIPPED:
        session_row.skipped_at = now

    await db.commit()
    await db.refresh(session_row)

    # Auto-complete plan if every session is terminal (completed or skipped)
    plan_res = await db.execute(
        select(TreatmentPlan)
        .options(selectinload(TreatmentPlan.sessions))
        .where(TreatmentPlan.id == session_row.plan_id)
    )
    plan = plan_res.scalar_one()
    if plan.status == PlanStatus.ACTIVE and all(
        s.status in (SessionStatus.COMPLETED, SessionStatus.SKIPPED) for s in plan.sessions
    ):
        plan.status = PlanStatus.COMPLETED
        plan.completed_at = now
        await db.commit()
        await db.refresh(session_row)

    return SessionResponse.model_validate(session_row)


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: uuid.UUID,
    body: SessionUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update séance content (notes, products, score) without changing status."""
    clinic_id = _get_clinic_id(user)

    res = await db.execute(
        select(TreatmentSession).where(
            TreatmentSession.id == session_id,
            TreatmentSession.clinic_id == clinic_id,
        )
    )
    session_row = res.scalar_one_or_none()
    if not session_row:
        raise HTTPException(status_code=404, detail="Session not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(session_row, key, value)

    await db.commit()
    await db.refresh(session_row)
    return SessionResponse.model_validate(session_row)


# ---------- Plan timeline (séance-centric view) ------------------------

class TimelineAppointment(BaseModel):
    id: uuid.UUID
    appointment_date: str  # YYYY-MM-DD
    start_time: str        # HH:MM
    status: str
    treatment: str
    room: str | None = None


class TimelinePhoto(BaseModel):
    id: uuid.UUID
    zone_slug: str
    stage: str
    storage_key: str


class TimelinePrescription(BaseModel):
    id: uuid.UUID
    number: str
    status: str
    created_at: str


class TimelineInvoice(BaseModel):
    id: uuid.UUID
    number: str
    status: str
    total: float
    currency: str


class SessionTimelineEntry(BaseModel):
    session: SessionResponse
    appointment: TimelineAppointment | None = None
    photos: list[TimelinePhoto] = []
    prescriptions: list[TimelinePrescription] = []


class PlanTimelineResponse(BaseModel):
    plan: PlanResponse
    sessions: list[SessionTimelineEntry]
    invoices: list[TimelineInvoice]   # plan-level (no per-session link yet)


@router.get("/{plan_id}/timeline", response_model=PlanTimelineResponse)
async def get_plan_timeline(
    plan_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Plan + séance-by-séance bundle with linked appointment, photos,
    prescriptions, and plan-level invoices. Drives the patient-detail
    plan card."""
    clinic_id = _get_clinic_id(user)

    # Load plan + sessions
    plan_res = await db.execute(
        select(TreatmentPlan)
        .options(selectinload(TreatmentPlan.sessions))
        .where(
            TreatmentPlan.id == plan_id,
            TreatmentPlan.clinic_id == clinic_id,
        )
    )
    plan = plan_res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    sessions = sorted(plan.sessions, key=lambda s: s.session_number)
    appt_ids = [s.appointment_id for s in sessions if s.appointment_id]

    # Resolve appointments
    appts_by_id: dict[uuid.UUID, Appointment] = {}
    if appt_ids:
        a_res = await db.execute(
            select(Appointment).where(
                Appointment.clinic_id == clinic_id,
                Appointment.id.in_(appt_ids),
            )
        )
        appts_by_id = {a.id: a for a in a_res.scalars().all()}

    # Photos linked to any of these sessions OR their appointments.
    # Prefer session_id (W9.5); fall back to appointment_id for older rows.
    session_ids = [s.id for s in sessions]
    photos_by_session: dict[uuid.UUID, list[PatientPhoto]] = {}
    photos_by_appt: dict[uuid.UUID, list[PatientPhoto]] = {}
    if session_ids or appt_ids:
        from sqlalchemy import or_
        clauses = []
        if session_ids:
            clauses.append(PatientPhoto.session_id.in_(session_ids))
        if appt_ids:
            clauses.append(PatientPhoto.appointment_id.in_(appt_ids))
        ph_res = await db.execute(
            select(PatientPhoto).where(
                PatientPhoto.clinic_id == clinic_id,
                or_(*clauses),
                PatientPhoto.deleted_at.is_(None),
            )
        )
        for ph in ph_res.scalars().all():
            if ph.session_id:
                photos_by_session.setdefault(ph.session_id, []).append(ph)
            elif ph.appointment_id:
                photos_by_appt.setdefault(ph.appointment_id, []).append(ph)

    # Prescriptions per appointment
    rx_by_appt: dict[uuid.UUID, list[Prescription]] = {}
    if appt_ids:
        rx_res = await db.execute(
            select(Prescription).where(
                Prescription.clinic_id == clinic_id,
                Prescription.appointment_id.in_(appt_ids),
            )
        )
        for rx in rx_res.scalars().all():
            rx_by_appt.setdefault(rx.appointment_id, []).append(rx)

    # Plan-level invoices
    inv_res = await db.execute(
        select(Invoice).where(
            Invoice.clinic_id == clinic_id,
            Invoice.plan_id == plan_id,
        )
    )
    invoices = list(inv_res.scalars().all())

    entries: list[SessionTimelineEntry] = []
    for s in sessions:
        appt = appts_by_id.get(s.appointment_id) if s.appointment_id else None
        photos = list(photos_by_session.get(s.id, []))
        if s.appointment_id and not photos:
            # Fall back to legacy appointment_id-only links
            photos.extend(photos_by_appt.get(s.appointment_id, []))
        rxs = rx_by_appt.get(s.appointment_id, []) if s.appointment_id else []

        entries.append(SessionTimelineEntry(
            session=SessionResponse.model_validate(s),
            appointment=(
                TimelineAppointment(
                    id=appt.id,
                    appointment_date=appt.appointment_date.isoformat(),
                    start_time=appt.start_time.strftime("%H:%M"),
                    status=appt.status.value,
                    treatment=appt.treatment,
                    room=appt.room,
                ) if appt else None
            ),
            photos=[
                TimelinePhoto(
                    id=p.id,
                    zone_slug=p.zone_slug,
                    stage=p.stage.value,
                    storage_key=p.storage_key,
                ) for p in photos
            ],
            prescriptions=[
                TimelinePrescription(
                    id=r.id,
                    number=r.number,
                    status=r.status.value,
                    created_at=r.created_at.isoformat() if r.created_at else "",
                ) for r in rxs
            ],
        ))

    return PlanTimelineResponse(
        plan=PlanResponse.model_validate(plan),
        sessions=entries,
        invoices=[
            TimelineInvoice(
                id=inv.id,
                number=inv.number,
                status=inv.status.value,
                total=float(inv.total),
                currency=inv.currency,
            ) for inv in invoices
        ],
    )
