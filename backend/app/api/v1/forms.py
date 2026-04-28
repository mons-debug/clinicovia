import uuid
import re
import math

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.patient import Patient, PatientStatus
from app.models.form import Form, FormSubmission, FormStatus
from app.schemas.form import (
    FormCreate, FormUpdate, FormResponse, FormListItem, FormListResponse, FormStats,
    FormSubmissionResponse, FormSubmissionListResponse,
    PublicFormResponse, PublicFormSubmitRequest,
)
from app.middleware.auth import get_current_user

router = APIRouter()
public_router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


def _slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return f"{slug}-{uuid.uuid4().hex[:6]}"


# ── Authenticated Endpoints ─────────────────────────────────────

@router.get("", response_model=FormListResponse)
async def list_forms(
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    query = select(Form).where(Form.clinic_id == clinic_id)

    if status_filter:
        query = query.where(Form.status == status_filter)
    if search:
        query = query.where(Form.title.ilike(f"%{search}%"))

    query = query.order_by(Form.created_at.desc())
    result = await db.execute(query)
    forms = result.scalars().all()

    # Stats
    all_q = await db.execute(select(Form).where(Form.clinic_id == clinic_id))
    all_forms = all_q.scalars().all()
    stats = FormStats(
        total=len(all_forms),
        active=sum(1 for f in all_forms if f.status == FormStatus.ACTIVE),
        total_submissions=sum(f.submission_count for f in all_forms),
    )

    return FormListResponse(
        forms=[FormListItem.model_validate(f) for f in forms],
        total=len(forms),
        stats=stats,
    )


@router.post("", response_model=FormResponse, status_code=status.HTTP_201_CREATED)
async def create_form(
    body: FormCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    form = Form(
        clinic_id=clinic_id,
        title=body.title,
        description=body.description,
        slug=_slugify(body.title),
        schema=body.schema,
        created_by=user.id,
    )
    db.add(form)
    await db.commit()
    await db.refresh(form)
    return FormResponse.model_validate(form)


@router.get("/{form_id}", response_model=FormResponse)
async def get_form(
    form_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Form).where(Form.id == form_id, Form.clinic_id == clinic_id)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return FormResponse.model_validate(form)


@router.put("/{form_id}", response_model=FormResponse)
async def update_form(
    form_id: uuid.UUID,
    body: FormUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Form).where(Form.id == form_id, Form.clinic_id == clinic_id)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(form, key, value)

    await db.commit()
    await db.refresh(form)
    return FormResponse.model_validate(form)


@router.get("/{form_id}/submissions", response_model=FormSubmissionListResponse)
async def list_submissions(
    form_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    # Verify form belongs to clinic
    form_check = await db.execute(
        select(Form).where(Form.id == form_id, Form.clinic_id == clinic_id)
    )
    if not form_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Form not found")

    count_q = select(func.count()).select_from(FormSubmission).where(
        FormSubmission.form_id == form_id
    )
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(
        select(FormSubmission)
        .where(FormSubmission.form_id == form_id)
        .order_by(FormSubmission.created_at.desc())
        .offset(offset).limit(page_size)
    )
    submissions = result.scalars().all()

    return FormSubmissionListResponse(
        submissions=[FormSubmissionResponse.model_validate(s) for s in submissions],
        total=total,
        page=page,
        page_size=page_size,
    )


# ── Public Endpoints (No Auth) ──────────────────────────────────

@public_router.get("/{slug}", response_model=PublicFormResponse)
async def get_public_form(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Form).where(Form.slug == slug, Form.status == FormStatus.ACTIVE)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not available")
    return PublicFormResponse.model_validate(form)


@public_router.post("/{slug}/submit", status_code=status.HTTP_201_CREATED)
async def submit_public_form(
    slug: str,
    body: PublicFormSubmitRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Form).where(Form.slug == slug, Form.status == FormStatus.ACTIVE)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not available")

    # Validate required fields
    schema = form.schema or {}
    fields = schema.get("fields", [])
    errors = []
    for field in fields:
        if field.get("required") and not body.data.get(field["id"]):
            errors.append({"field": field["id"], "message": f"{field.get('label', 'Field')} is required"})

    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors})

    # Try to create patient lead
    patient_id = None
    phone_value = None
    email_value = None
    for field in fields:
        fid = field["id"]
        ftype = field.get("type", "")
        val = body.data.get(fid)
        if val:
            if ftype in ("phone", "whatsapp"):
                phone_value = str(val)
            elif ftype == "email":
                email_value = str(val)

    if phone_value:
        existing = await db.execute(
            select(Patient).where(
                Patient.clinic_id == form.clinic_id,
                Patient.phone == phone_value,
                Patient.is_active == True,  # noqa: E712
            )
        )
        patient = existing.scalar_one_or_none()
        if not patient:
            # Extract name from form data
            name_parts = ["Lead", ""]
            for field in fields:
                val = body.data.get(field["id"])
                if val and field.get("type") == "text" and "name" in field.get("label", "").lower():
                    parts = str(val).split(" ", 1)
                    name_parts = [parts[0], parts[1] if len(parts) > 1 else ""]
                    break

            patient = Patient(
                clinic_id=form.clinic_id,
                first_name=name_parts[0],
                last_name=name_parts[1],
                phone=phone_value,
                email=email_value,
                status=PatientStatus.NEW,
                lead_source="website",
            )
            db.add(patient)
            await db.flush()
        patient_id = patient.id

    # Get client IP
    ip = request.client.host if request.client else None

    submission = FormSubmission(
        clinic_id=form.clinic_id,
        form_id=form.id,
        data=body.data,
        patient_id=patient_id,
        ip_address=ip,
    )
    db.add(submission)

    # Increment counter
    form.submission_count += 1

    await db.commit()

    # Dispatch AI orchestration for the new lead (best effort)
    try:
        from app.services.ai_hooks import on_form_submission_ai
        await on_form_submission_ai(
            db,
            clinic_id=form.clinic_id,
            form_id=form.id,
            submission_id=submission.id,
            submission_data=body.data,
            patient_id=patient_id,
        )
    except Exception:
        pass

    return {"message": "Submission received", "id": str(submission.id)}
