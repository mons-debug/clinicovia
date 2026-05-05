import uuid
import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.patient import Patient, PatientNote, PatientActivity, PatientTag, PatientStatus, IntakeStatus
from app.schemas.patient import (
    PatientCreate,
    PatientUpdate,
    PatientResponse,
    PatientListResponse,
    NoteCreate,
    PatientNoteResponse,
    PatientActivityResponse,
)
from app.middleware.auth import get_current_user

router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


def _compute_bmi(weight_kg: float | None, height_cm: float | None) -> float | None:
    """Standard BMI = weight(kg) / height(m)^2. Returns None if either input is missing."""
    if not weight_kg or not height_cm or height_cm <= 0:
        return None
    h_m = height_cm / 100.0
    return round(weight_kg / (h_m * h_m), 1)


@router.get("", response_model=PatientListResponse)
async def list_patients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    source: str | None = None,
    # Lifecycle tab — "leads" / "patients" / "active" / "all"
    # leads     = intake_status = LEAD (not yet visited)
    # patients  = intake_status != LEAD AND != ARCHIVED (visited at least once)
    # active    = patient.status = ACTIVE
    # all       = no lifecycle filter
    tab: str | None = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    query = select(Patient).options(selectinload(Patient.tags)).where(
        Patient.clinic_id == clinic_id,
        Patient.is_active == True,  # noqa: E712
    )

    # Search
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.email.ilike(term),
                Patient.phone.ilike(term),
            )
        )

    # Lifecycle tab
    if tab == "leads":
        query = query.where(Patient.intake_status == IntakeStatus.LEAD)
    elif tab == "patients":
        query = query.where(
            Patient.intake_status.notin_([IntakeStatus.LEAD, IntakeStatus.ARCHIVED])
        )
    elif tab == "active":
        query = query.where(Patient.status == PatientStatus.ACTIVE)

    # Filters
    if status_filter:
        query = query.where(Patient.status == status_filter)
    if source:
        query = query.where(Patient.lead_source == source)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Sort
    sort_col = getattr(Patient, sort_by, Patient.created_at)
    query = query.order_by(sort_col.desc() if sort_dir == "desc" else sort_col.asc())

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    patients = result.scalars().all()

    return PatientListResponse(
        patients=[PatientResponse.model_validate(p) for p in patients],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    body: PatientCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    # Check for duplicate phone within clinic
    existing = await db.execute(
        select(Patient).where(
            Patient.clinic_id == clinic_id,
            Patient.phone == body.phone,
            Patient.is_active == True,  # noqa: E712
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A patient with this phone number already exists in your clinic",
        )

    bmi = _compute_bmi(body.weight_kg, body.height_cm)

    patient = Patient(
        clinic_id=clinic_id,
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        phone=body.phone,
        phone_country_code=body.phone_country_code,
        gender=body.gender,
        date_of_birth=body.date_of_birth,
        cnie=body.cnie,
        city=body.city,
        country=body.country,
        address=body.address,
        language_pref=(body.language_pref or "fr"),
        channel_pref=(body.channel_pref or "whatsapp"),
        fitzpatrick=body.fitzpatrick,
        weight_kg=body.weight_kg,
        height_cm=body.height_cm,
        bmi=bmi,
        smoker=body.smoker,
        lead_source=body.lead_source,
        treatment_interests=body.treatment_interests,
        source_campaign=body.source_campaign,
        source_medium=body.source_medium,
        first_touch_at=body.first_touch_at,
        intake_status=(body.intake_status or "active"),
        requested_service=body.requested_service,
        assigned_to=body.assigned_to,
        internal_notes=body.internal_notes,
    )
    db.add(patient)
    await db.flush()

    # Add tags
    if body.tags:
        for tag_name in body.tags:
            tag = PatientTag(clinic_id=clinic_id, patient_id=patient.id, tag=tag_name)
            db.add(tag)

    # Activity log
    activity = PatientActivity(
        clinic_id=clinic_id,
        patient_id=patient.id,
        actor_id=user.id,
        action="patient_created",
        description=f"Patient {patient.full_name} was created",
    )
    db.add(activity)

    await db.commit()

    result = await db.execute(
        select(Patient).options(selectinload(Patient.tags)).where(Patient.id == patient.id)
    )
    return PatientResponse.model_validate(result.scalar_one())


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Patient)
        .options(selectinload(Patient.tags))
        .where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return PatientResponse.model_validate(patient)


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: uuid.UUID,
    body: PatientUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Patient)
        .options(selectinload(Patient.tags))
        .where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    update_data = body.model_dump(exclude_unset=True)
    tags_data = update_data.pop("tags", None)
    changes = []
    for key, value in update_data.items():
        old = getattr(patient, key, None)
        if old != value:
            changes.append(f"{key}: {old} -> {value}")
            setattr(patient, key, value)

    # Update tags if provided
    if tags_data is not None:
        # Remove existing tags
        await db.execute(
            select(PatientTag).where(PatientTag.patient_id == patient.id)
        )
        for existing_tag in list(patient.tags):
            await db.delete(existing_tag)
        # Add new tags
        for tag_name in tags_data:
            tag = PatientTag(clinic_id=clinic_id, patient_id=patient.id, tag=tag_name)
            db.add(tag)
        changes.append("tags updated")

    if changes:
        activity = PatientActivity(
            clinic_id=clinic_id,
            patient_id=patient.id,
            actor_id=user.id,
            action="patient_updated",
            description=f"Updated: {', '.join(changes[:5])}",
        )
        db.add(activity)

    await db.commit()
    await db.refresh(patient)
    return PatientResponse.model_validate(patient)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    activity = PatientActivity(
        clinic_id=clinic_id,
        patient_id=patient.id,
        actor_id=user.id,
        action="patient_deleted",
        description=f"Patient {patient.first_name} {patient.last_name} was deleted",
    )
    db.add(activity)

    patient.is_active = False  # soft delete
    await db.commit()


# ── Notes ────────────────────────────────────────────────────────

@router.get("/{patient_id}/notes", response_model=list[PatientNoteResponse])
async def list_notes(
    patient_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(PatientNote)
        .where(PatientNote.patient_id == patient_id, PatientNote.clinic_id == clinic_id)
        .order_by(PatientNote.is_pinned.desc(), PatientNote.created_at.desc())
    )
    return [PatientNoteResponse.model_validate(n) for n in result.scalars().all()]


@router.post("/{patient_id}/notes", response_model=PatientNoteResponse, status_code=201)
async def add_note(
    patient_id: uuid.UUID,
    body: NoteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    note = PatientNote(
        clinic_id=clinic_id,
        patient_id=patient_id,
        author_id=user.id,
        content=body.content,
        is_pinned=body.is_pinned,
    )
    db.add(note)

    activity = PatientActivity(
        clinic_id=clinic_id,
        patient_id=patient_id,
        actor_id=user.id,
        action="note_added",
        description="Added a note",
    )
    db.add(activity)

    await db.commit()
    await db.refresh(note)
    return PatientNoteResponse.model_validate(note)


# ── Activity Log ─────────────────────────────────────────────────

@router.get("/{patient_id}/activities", response_model=list[PatientActivityResponse])
async def list_activities(
    patient_id: uuid.UUID,
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(PatientActivity)
        .where(PatientActivity.patient_id == patient_id, PatientActivity.clinic_id == clinic_id)
        .order_by(PatientActivity.created_at.desc())
        .limit(limit)
    )
    return [PatientActivityResponse.model_validate(a) for a in result.scalars().all()]
