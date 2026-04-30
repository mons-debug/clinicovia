import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.clinic import ClinicMembership, Role
from app.middleware.auth import get_current_user
from app.utils.security import hash_password
from pydantic import BaseModel, Field

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────

class DoctorResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None = None
    avatar_url: str | None = None
    specialty: str = ""
    is_active: bool = True
    created_at: str

    model_config = {"from_attributes": True}


class DoctorListResponse(BaseModel):
    doctors: list[DoctorResponse]
    total: int


class DoctorCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=1)
    phone: str | None = None
    specialty: str = ""
    password: str = Field(min_length=6)


class DoctorUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    specialty: str | None = None


# ── Helpers ──────────────────────────────────────────────────────

def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


def _doctor_to_response(user: User, membership: ClinicMembership | None = None) -> DoctorResponse:
    return DoctorResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        avatar_url=user.avatar_url,
        specialty=user.specialty or "",
        is_active=membership.is_active if membership else user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


# ── Routes ───────────────────────────────────────────────────────

@router.get("", response_model=DoctorListResponse)
async def list_doctors(
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    query = (
        select(ClinicMembership)
        .options(selectinload(ClinicMembership.user))
        .where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.role == Role.DOCTOR,
            ClinicMembership.is_active == True,  # noqa: E712
        )
    )

    result = await db.execute(query)
    memberships = list(result.scalars().all())

    # Search filter
    if search:
        term = search.lower()
        memberships = [
            m for m in memberships
            if term in m.user.first_name.lower()
            or term in m.user.last_name.lower()
            or term in m.user.email.lower()
            or (m.user.phone and term in m.user.phone)
        ]

    total = len(memberships)
    offset = (page - 1) * page_size
    page_items = memberships[offset:offset + page_size]

    doctors = [_doctor_to_response(m.user, m) for m in page_items]
    return DoctorListResponse(doctors=doctors, total=total)


@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor(
    body: DoctorCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == body.email))
    existing_user = existing.scalar_one_or_none()

    if existing_user:
        # Check if already a doctor in this clinic
        mem_check = await db.execute(
            select(ClinicMembership).where(
                ClinicMembership.user_id == existing_user.id,
                ClinicMembership.clinic_id == clinic_id,
            )
        )
        if mem_check.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="This user is already a member of this clinic")

        # Add existing user as doctor to this clinic
        membership = ClinicMembership(
            user_id=existing_user.id,
            clinic_id=clinic_id,
            role=Role.DOCTOR,
        )
        db.add(membership)
        await db.commit()
        return _doctor_to_response(existing_user, membership)

    # Create new user + membership
    new_user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        specialty=body.specialty or None,
        is_verified=True,
    )
    db.add(new_user)
    await db.flush()

    membership = ClinicMembership(
        user_id=new_user.id,
        clinic_id=clinic_id,
        role=Role.DOCTOR,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(new_user)

    return _doctor_to_response(new_user, membership)


@router.get("/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(
    doctor_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    result = await db.execute(
        select(ClinicMembership)
        .options(selectinload(ClinicMembership.user))
        .where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.user_id == doctor_id,
            ClinicMembership.role == Role.DOCTOR,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Doctor not found")

    return _doctor_to_response(membership.user, membership)


@router.put("/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(
    doctor_id: uuid.UUID,
    body: DoctorUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    result = await db.execute(
        select(ClinicMembership)
        .options(selectinload(ClinicMembership.user))
        .where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.user_id == doctor_id,
            ClinicMembership.role == Role.DOCTOR,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Doctor not found")

    doctor = membership.user
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(doctor, key, value)

    await db.commit()
    await db.refresh(doctor)
    return _doctor_to_response(doctor, membership)


@router.delete("/{doctor_id}", status_code=204)
async def delete_doctor(
    doctor_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    result = await db.execute(
        select(ClinicMembership).where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.user_id == doctor_id,
            ClinicMembership.role == Role.DOCTOR,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Doctor not found")

    membership.is_active = False
    await db.commit()
