import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.patient import Patient
from app.models.pipeline import Deal, DealActivity
from app.schemas.deal import (
    DealCreate,
    DealUpdate,
    DealStageMove,
    DealLostRequest,
    DealResponse,
    DealDetailResponse,
    DealListResponse,
    DealActivityResponse,
    DealSummary,
    StageSummary,
)
from app.middleware.auth import get_current_user

router = APIRouter()

VALID_STAGES = [
    "New Lead", "Contacted", "Qualified", "Consultation Booked",
    "Consultation Done", "Treatment Proposed", "Treatment Accepted",
    "Payment", "Completed", "Follow-up",
]

STAGE_ORDER = {s: i for i, s in enumerate(VALID_STAGES)}


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


def _deal_to_response(deal: Deal, patient: Patient | None = None) -> DealResponse:
    now = datetime.now(timezone.utc)
    days = (now - deal.updated_at.replace(tzinfo=timezone.utc)).days if deal.updated_at else 0
    return DealResponse(
        id=deal.id,
        patient_id=deal.patient_id,
        patient_name=f"{patient.first_name} {patient.last_name}" if patient else "",
        patient_phone=patient.phone if patient else "",
        pipeline_stage=deal.pipeline_stage,
        stage_order=deal.stage_order,
        title=deal.title,
        value=deal.value,
        currency=deal.currency,
        treatment=deal.treatment,
        temperature=deal.temperature.value if hasattr(deal.temperature, 'value') else str(deal.temperature),
        assigned_to=deal.assigned_to,
        notes=deal.notes,
        is_won=deal.is_won,
        is_lost=deal.is_lost,
        lost_reason=deal.lost_reason,
        days_in_stage=days,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
    )


@router.get("", response_model=DealListResponse)
async def list_deals(
    search: str | None = None,
    stage: str | None = None,
    temperature: str | None = None,
    assigned_to: uuid.UUID | None = None,
    patient_id: uuid.UUID | None = None,
    include_closed: bool = False,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    query = select(Deal).where(Deal.clinic_id == clinic_id)

    if not include_closed:
        query = query.where(Deal.is_won == False, Deal.is_lost == False)  # noqa: E712

    if stage:
        query = query.where(Deal.pipeline_stage == stage)
    if temperature:
        query = query.where(Deal.temperature == temperature)
    if assigned_to:
        query = query.where(Deal.assigned_to == assigned_to)
    if patient_id:
        query = query.where(Deal.patient_id == patient_id)

    # Sort
    sort_col = getattr(Deal, sort_by, Deal.created_at)
    query = query.order_by(sort_col.desc() if sort_dir == "desc" else sort_col.asc())

    result = await db.execute(query)
    deals = result.scalars().all()

    # Load patients for names
    patient_ids = list({d.patient_id for d in deals})
    patients_map: dict[uuid.UUID, Patient] = {}
    if patient_ids:
        p_result = await db.execute(select(Patient).where(Patient.id.in_(patient_ids)))
        for p in p_result.scalars().all():
            patients_map[p.id] = p

    # Search filter (post-query for simplicity with patient name)
    if search:
        term = search.lower()
        deals = [
            d for d in deals
            if term in d.title.lower()
            or (patients_map.get(d.patient_id) and term in patients_map[d.patient_id].full_name.lower())
        ]

    # Build response
    deal_responses = [_deal_to_response(d, patients_map.get(d.patient_id)) for d in deals]

    # Summary
    by_stage: dict[str, StageSummary] = {}
    for d in deal_responses:
        if d.pipeline_stage not in by_stage:
            by_stage[d.pipeline_stage] = StageSummary(count=0, value=0.0)
        by_stage[d.pipeline_stage].count += 1
        by_stage[d.pipeline_stage].value += d.value

    summary = DealSummary(
        total_value=sum(d.value for d in deal_responses),
        total_deals=len(deal_responses),
        by_stage=by_stage,
    )

    return DealListResponse(deals=deal_responses, summary=summary)


@router.post("", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    body: DealCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    # Verify patient exists in same clinic
    p_result = await db.execute(
        select(Patient).where(Patient.id == body.patient_id, Patient.clinic_id == clinic_id)
    )
    patient = p_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    deal = Deal(
        clinic_id=clinic_id,
        patient_id=body.patient_id,
        title=body.title,
        value=body.value,
        currency=body.currency,
        treatment=body.treatment,
        temperature=body.temperature,
        assigned_to=body.assigned_to,
        notes=body.notes,
        pipeline_stage="New Lead",
        stage_order=0,
    )
    db.add(deal)
    await db.flush()

    activity = DealActivity(
        clinic_id=clinic_id,
        deal_id=deal.id,
        actor_id=user.id,
        action="deal_created",
        description=f"Deal '{deal.title}' created for {patient.full_name}",
    )
    db.add(activity)
    await db.commit()

    return _deal_to_response(deal, patient)


@router.get("/{deal_id}", response_model=DealDetailResponse)
async def get_deal(
    deal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Deal)
        .options(selectinload(Deal.activities))
        .where(Deal.id == deal_id, Deal.clinic_id == clinic_id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    p_result = await db.execute(select(Patient).where(Patient.id == deal.patient_id))
    patient = p_result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    days = (now - deal.updated_at.replace(tzinfo=timezone.utc)).days if deal.updated_at else 0

    activities = sorted(deal.activities, key=lambda a: a.created_at, reverse=True)

    return DealDetailResponse(
        id=deal.id,
        patient_id=deal.patient_id,
        patient_name=patient.full_name if patient else "",
        patient_phone=patient.phone if patient else "",
        patient_email=patient.email if patient else None,
        pipeline_stage=deal.pipeline_stage,
        stage_order=deal.stage_order,
        title=deal.title,
        value=deal.value,
        currency=deal.currency,
        treatment=deal.treatment,
        temperature=deal.temperature.value if hasattr(deal.temperature, 'value') else str(deal.temperature),
        assigned_to=deal.assigned_to,
        notes=deal.notes,
        is_won=deal.is_won,
        is_lost=deal.is_lost,
        lost_reason=deal.lost_reason,
        days_in_stage=days,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
        activities=[DealActivityResponse.model_validate(a) for a in activities],
    )


@router.put("/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: uuid.UUID,
    body: DealUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.clinic_id == clinic_id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    update_data = body.model_dump(exclude_unset=True)
    changes = []
    for key, value in update_data.items():
        old = getattr(deal, key, None)
        if old != value:
            changes.append(f"{key}: {old} -> {value}")
            setattr(deal, key, value)

    if changes:
        activity = DealActivity(
            clinic_id=clinic_id,
            deal_id=deal.id,
            actor_id=user.id,
            action="updated",
            description=f"Updated: {', '.join(changes[:5])}",
        )
        db.add(activity)

    await db.commit()
    await db.refresh(deal)

    p_result = await db.execute(select(Patient).where(Patient.id == deal.patient_id))
    patient = p_result.scalar_one_or_none()
    return _deal_to_response(deal, patient)


@router.patch("/{deal_id}/stage", response_model=DealResponse)
async def move_deal_stage(
    deal_id: uuid.UUID,
    body: DealStageMove,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.stage not in VALID_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {', '.join(VALID_STAGES)}")

    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.clinic_id == clinic_id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # No-op if same stage
    if deal.pipeline_stage == body.stage:
        p_result = await db.execute(select(Patient).where(Patient.id == deal.patient_id))
        patient = p_result.scalar_one_or_none()
        return _deal_to_response(deal, patient)

    from_stage = deal.pipeline_stage
    deal.pipeline_stage = body.stage
    deal.stage_order = STAGE_ORDER.get(body.stage, 0)

    activity = DealActivity(
        clinic_id=clinic_id,
        deal_id=deal.id,
        actor_id=user.id,
        action="stage_changed",
        description=f"Moved from {from_stage} to {body.stage}",
        from_stage=from_stage,
        to_stage=body.stage,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(deal)

    # Fire conversion tracking event (best effort)
    try:
        from app.services.tracking_hooks import on_deal_stage_change
        await on_deal_stage_change(
            db, clinic_id, deal.id, body.stage,
            patient_id=deal.patient_id,
            deal_value=deal.value,
            currency=deal.currency or "MAD",
        )
    except Exception:
        pass

    p_result = await db.execute(select(Patient).where(Patient.id == deal.patient_id))
    patient = p_result.scalar_one_or_none()
    return _deal_to_response(deal, patient)


@router.post("/{deal_id}/won", response_model=DealResponse)
async def mark_deal_won(
    deal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.clinic_id == clinic_id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    if deal.is_won or deal.is_lost:
        raise HTTPException(status_code=400, detail="Deal is already closed (won or lost)")

    deal.is_won = True

    # Sync patient financials
    p_result = await db.execute(select(Patient).where(Patient.id == deal.patient_id))
    patient = p_result.scalar_one_or_none()
    if patient:
        patient.total_spent += deal.value
        patient.lifetime_value += deal.value

    activity = DealActivity(
        clinic_id=clinic_id,
        deal_id=deal.id,
        actor_id=user.id,
        action="won",
        description=f"Deal '{deal.title}' marked as won (MAD {deal.value:,.0f})",
    )
    db.add(activity)
    await db.commit()
    await db.refresh(deal)

    # Fire "Purchase" conversion event for won deals (best effort)
    try:
        from app.services.tracking_hooks import on_deal_stage_change
        await on_deal_stage_change(
            db, clinic_id, deal.id, "Payment",
            patient_id=deal.patient_id,
            deal_value=deal.value,
            currency=deal.currency or "MAD",
        )
    except Exception:
        pass

    return _deal_to_response(deal, patient)


@router.post("/{deal_id}/lost", response_model=DealResponse)
async def mark_deal_lost(
    deal_id: uuid.UUID,
    body: DealLostRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id, Deal.clinic_id == clinic_id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    if deal.is_won or deal.is_lost:
        raise HTTPException(status_code=400, detail="Deal is already closed (won or lost)")

    deal.is_lost = True
    deal.lost_reason = body.reason

    p_result = await db.execute(select(Patient).where(Patient.id == deal.patient_id))
    patient = p_result.scalar_one_or_none()

    activity = DealActivity(
        clinic_id=clinic_id,
        deal_id=deal.id,
        actor_id=user.id,
        action="lost",
        description=f"Deal '{deal.title}' marked as lost: {body.reason}",
    )
    db.add(activity)
    await db.commit()
    await db.refresh(deal)

    return _deal_to_response(deal, patient)
