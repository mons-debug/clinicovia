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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.patient import IntakeStatus, Patient
from app.models.user import User
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
    IntakeStatus.IN_ROOM: {IntakeStatus.ACTIVE, IntakeStatus.AWAITING_DOCTOR, IntakeStatus.ARCHIVED},
    IntakeStatus.ACTIVE: {IntakeStatus.AWAITING_DOCTOR, IntakeStatus.ARCHIVED},
    IntakeStatus.ARCHIVED: set(),  # terminal
}


# ---------- Schemas -----------------------------------------------------

class QueueBoard(BaseModel):
    intake_pending: list[PatientResponse]
    awaiting_doctor: list[PatientResponse]
    in_room: list[PatientResponse]
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

    return QueueBoard(
        intake_pending=[PatientResponse.model_validate(p) for p in pending],
        awaiting_doctor=[PatientResponse.model_validate(p) for p in awaiting],
        in_room=[PatientResponse.model_validate(p) for p in in_room],
        counts={
            "intake_pending": len(pending),
            "awaiting_doctor": len(awaiting),
            "in_room": len(in_room),
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
