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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.patient import Patient
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
    for i in range(1, body.total_sessions + 1):
        s = TreatmentSession(
            clinic_id=clinic_id,
            plan_id=plan.id,
            session_number=i,
            planned_for=start + delta * (i - 1),
            status=SessionStatus.PLANNED,
        )
        db.add(s)

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
