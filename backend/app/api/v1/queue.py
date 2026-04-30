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
from datetime import date as date_type, datetime, time as time_type, timezone

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

class QueueBoard(BaseModel):
    intake_pending: list[PatientResponse]
    awaiting_doctor: list[PatientResponse]
    in_room: list[PatientResponse]
    checkout_pending: list[PatientResponse]
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

    return QueueBoard(
        intake_pending=[PatientResponse.model_validate(p) for p in pending],
        awaiting_doctor=[PatientResponse.model_validate(p) for p in awaiting],
        in_room=[PatientResponse.model_validate(p) for p in in_room],
        checkout_pending=[PatientResponse.model_validate(p) for p in checkout],
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
        # Un-archive if moving back into the queue
        patient.archived_at = None
        patient.is_active = True

    await db.commit()
    await db.refresh(patient)
    return PatientResponse.model_validate(patient)


# ---------- Walk-in (existing patient arrives without appointment) -----

class WalkInRequest(BaseModel):
    requested_service: str | None = None
    note: str | None = None


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
        status=AppointmentStatus.CHECKED_IN,
        notes=body.note,
        is_first_visit=False,
        arrived_at=now,
    )
    db.add(appt)
    await db.flush()

    # Sync the patient into the queue board
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

    patient.doctor_called_at = datetime.now(timezone.utc)
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
