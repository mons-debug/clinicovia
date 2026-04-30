"""
Calendar — day view of appointments grouped by doctor, plus
journey-event endpoints (mark arrived / mark started / mark ended).

Used by the front-desk + doctor day-view UI.
"""

from __future__ import annotations

import uuid
from datetime import date as date_type, datetime, time as time_type, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.appointment import Appointment, AppointmentStatus
from app.models.patient import IntakeStatus, Patient
from app.models.user import User
from app.schemas.appointment import AppointmentResponse


router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


# ---------- Response shapes --------------------------------------------

class DoctorBucket(BaseModel):
    doctor_id: str | None
    doctor_name: str
    doctor_color: str
    appointments: list[AppointmentResponse]


class CalendarDayResponse(BaseModel):
    date: date_type
    counts: dict[str, int]   # by status
    doctors: list[DoctorBucket]
    unassigned: list[AppointmentResponse]


class JourneyEventRequest(BaseModel):
    event: str  # one of: arrived | started | ended | cancel | no_show


class RescheduleRequest(BaseModel):
    appointment_date: date_type
    start_time: time_type
    duration_minutes: int = 30
    doctor_id: uuid.UUID | None = None
    room: str | None = None


# ---------- Endpoints ---------------------------------------------------

@router.get("/day", response_model=CalendarDayResponse)
async def get_day(
    date: date_type = Query(..., description="ISO date, e.g. 2026-04-30"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all appointments for `date`, grouped by doctor."""
    clinic_id = _get_clinic_id(user)

    result = await db.execute(
        select(Appointment, Patient)
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date == date,
        )
        .order_by(Appointment.start_time.asc())
    )
    rows = list(result.all())

    # Group by doctor
    buckets: dict[uuid.UUID | None, DoctorBucket] = {}
    counts: dict[str, int] = {s.value: 0 for s in AppointmentStatus}

    for appt, patient in rows:
        counts[appt.status.value] = counts.get(appt.status.value, 0) + 1

        appt_resp = AppointmentResponse.model_validate({
            **appt.__dict__,
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "patient_phone": f"{patient.phone_country_code}{patient.phone}",
            "patient_initials": f"{patient.first_name[:1]}{patient.last_name[:1]}".upper(),
            "doctor_name": "",
            "doctor_color": "#6B7280",
        })

        key = appt.doctor_id
        if key not in buckets:
            buckets[key] = DoctorBucket(
                doctor_id=str(key) if key else None,
                doctor_name="",  # filled below
                doctor_color="#6B7280",
                appointments=[],
            )
        buckets[key].appointments.append(appt_resp)

    # Resolve doctor names + colors
    doctor_ids = [k for k in buckets.keys() if k is not None]
    if doctor_ids:
        doc_rows = await db.execute(
            select(User).where(User.id.in_(doctor_ids))
        )
        doctors = {d.id: d for d in doc_rows.scalars().all()}
        # Colors: simple deterministic palette indexed by alphabetical order
        palette = ["#0D4F6C", "#3EC8A0", "#A65D46", "#3F5A6B", "#B8915A", "#8B5CF6"]
        for idx, did in enumerate(sorted(doctor_ids, key=lambda x: str(x))):
            d = doctors.get(did)
            if d and did in buckets:
                buckets[did].doctor_name = f"Dr. {d.first_name} {d.last_name}".strip()
                buckets[did].doctor_color = palette[idx % len(palette)]

    unassigned = buckets.pop(None, DoctorBucket(
        doctor_id=None, doctor_name="Non assigné", doctor_color="#6B7280", appointments=[],
    ))

    return CalendarDayResponse(
        date=date,
        counts=counts,
        doctors=list(buckets.values()),
        unassigned=unassigned.appointments,
    )


@router.post("/{appointment_id}/event", response_model=AppointmentResponse)
async def journey_event(
    appointment_id: uuid.UUID,
    body: JourneyEventRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a journey transition: arrived | started | ended | cancel | no_show.

    Sets the corresponding timestamp + status. Idempotent: re-emitting
    a past event resets the timestamp.
    """
    clinic_id = _get_clinic_id(user)

    result = await db.execute(
        select(Appointment, Patient)
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.id == appointment_id,
            Appointment.clinic_id == clinic_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    appt, patient = row

    now = datetime.now(timezone.utc)
    event = body.event

    if event == "arrived":
        appt.arrived_at = now
        appt.status = AppointmentStatus.CHECKED_IN
        # Sync patient into the queue board
        patient.intake_status = IntakeStatus.AWAITING_DOCTOR
        patient.intake_at = now
    elif event == "started":
        appt.started_at = now
        if not appt.arrived_at:
            appt.arrived_at = now
        appt.status = AppointmentStatus.IN_PROGRESS
        patient.intake_status = IntakeStatus.IN_ROOM
        patient.intake_at = now
    elif event == "ended":
        appt.ended_at = now
        if not appt.started_at:
            appt.started_at = now
        appt.status = AppointmentStatus.COMPLETED
        # Patient leaves the queue — back to ACTIVE (out of board buckets)
        patient.intake_status = IntakeStatus.ACTIVE
        patient.intake_at = now
    elif event == "cancel":
        appt.status = AppointmentStatus.CANCELLED
        patient.intake_status = IntakeStatus.ACTIVE
    elif event == "no_show":
        appt.status = AppointmentStatus.NO_SHOW
        patient.intake_status = IntakeStatus.ACTIVE
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown event: {event}",
        )

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


@router.post("/{appointment_id}/reschedule", response_model=AppointmentResponse)
async def reschedule(
    appointment_id: uuid.UUID,
    body: RescheduleRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move an appointment to a new slot (date + time + duration).

    Recomputes end_time. Doctor + room are optional re-assignments.
    """
    clinic_id = _get_clinic_id(user)

    result = await db.execute(
        select(Appointment, Patient)
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.id == appointment_id,
            Appointment.clinic_id == clinic_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    appt, patient = row

    # Compute end_time from start + duration
    start_dt = datetime.combine(body.appointment_date, body.start_time)
    end_dt = start_dt + timedelta(minutes=body.duration_minutes)

    appt.appointment_date = body.appointment_date
    appt.start_time = body.start_time
    appt.end_time = end_dt.time()
    appt.duration_minutes = body.duration_minutes
    if body.doctor_id is not None:
        appt.doctor_id = body.doctor_id
    if body.room is not None:
        appt.room = body.room

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


@router.post("/{appointment_id}/confirm", response_model=AppointmentResponse)
async def confirm_appointment(
    appointment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm a tentative booking — clears needs_confirmation, bumps
    status from SCHEDULED → CONFIRMED if applicable."""
    clinic_id = _get_clinic_id(user)

    result = await db.execute(
        select(Appointment, Patient)
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.id == appointment_id,
            Appointment.clinic_id == clinic_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    appt, patient = row

    appt.needs_confirmation = False
    if appt.status == AppointmentStatus.SCHEDULED:
        appt.status = AppointmentStatus.CONFIRMED
    appt.confirmation_sent = True

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
