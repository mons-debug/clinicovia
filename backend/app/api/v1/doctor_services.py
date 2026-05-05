"""Doctor-owned services CRUD.

- Doctors see/manage their own services (GET /, POST, PUT, DELETE)
- Reception sees all doctors' services (GET /all — grouped by doctor)
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.doctor_service import DoctorService
from app.models.user import User

router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


# ── Schemas ──────────────────────────────────────────────────────

class ServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: str | None = None
    description: str | None = None
    duration_minutes: int = 30
    default_price: float = 0.0
    consent_template: str | None = None
    is_active: bool = True
    sort_order: int = 0


class ServiceUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    duration_minutes: int | None = None
    default_price: float | None = None
    consent_template: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class ServiceResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    doctor_id: uuid.UUID
    name: str
    category: str | None
    description: str | None
    duration_minutes: int
    default_price: float
    consent_template: str | None
    is_active: bool
    sort_order: int
    model_config = {"from_attributes": True}


class DoctorServiceGroup(BaseModel):
    doctor_id: uuid.UUID
    doctor_name: str
    specialty: str | None
    services: list[ServiceResponse]


# ── Doctor's own services ────────────────────────────────────────

@router.get("", response_model=list[ServiceResponse])
async def list_my_services(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the logged-in doctor's services."""
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(DoctorService)
        .where(DoctorService.clinic_id == clinic_id, DoctorService.doctor_id == user.id)
        .order_by(DoctorService.sort_order, DoctorService.name)
    )
    return [ServiceResponse.model_validate(s) for s in result.scalars().all()]


@router.post("", response_model=ServiceResponse, status_code=201)
async def create_service(
    body: ServiceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Doctor adds a new service to their portfolio."""
    clinic_id = _get_clinic_id(user)
    svc = DoctorService(
        clinic_id=clinic_id,
        doctor_id=user.id,
        name=body.name,
        category=body.category,
        description=body.description,
        duration_minutes=body.duration_minutes,
        default_price=body.default_price,
        consent_template=body.consent_template,
        is_active=body.is_active,
        sort_order=body.sort_order,
    )
    db.add(svc)
    await db.commit()
    await db.refresh(svc)
    return ServiceResponse.model_validate(svc)


@router.put("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: uuid.UUID,
    body: ServiceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Doctor updates one of their services."""
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(DoctorService).where(
            DoctorService.id == service_id,
            DoctorService.clinic_id == clinic_id,
            DoctorService.doctor_id == user.id,
        )
    )
    svc = result.scalar_one_or_none()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(svc, field, value)

    await db.commit()
    await db.refresh(svc)
    return ServiceResponse.model_validate(svc)


@router.delete("/{service_id}", status_code=204)
async def delete_service(
    service_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Doctor removes a service (soft: deactivate, or hard delete if no references)."""
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(DoctorService).where(
            DoctorService.id == service_id,
            DoctorService.clinic_id == clinic_id,
            DoctorService.doctor_id == user.id,
        )
    )
    svc = result.scalar_one_or_none()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    svc.is_active = False
    await db.commit()


# ── Reception view: all doctors' services ────────────────────────

@router.get("/all", response_model=list[DoctorServiceGroup])
async def list_all_services(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reception view: all active services grouped by doctor."""
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(DoctorService)
        .options(selectinload(DoctorService.doctor))
        .where(DoctorService.clinic_id == clinic_id, DoctorService.is_active == True)  # noqa: E712
        .order_by(DoctorService.doctor_id, DoctorService.sort_order, DoctorService.name)
    )
    services = result.scalars().all()

    groups: dict[uuid.UUID, DoctorServiceGroup] = {}
    for svc in services:
        doc_id = svc.doctor_id
        if doc_id not in groups:
            doctor = svc.doctor
            groups[doc_id] = DoctorServiceGroup(
                doctor_id=doc_id,
                doctor_name=f"Dr. {doctor.first_name} {doctor.last_name}" if doctor else "—",
                specialty=doctor.specialty if doctor else None,
                services=[],
            )
        groups[doc_id].services.append(ServiceResponse.model_validate(svc))

    return list(groups.values())


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single service by ID."""
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(DoctorService).where(
            DoctorService.id == service_id,
            DoctorService.clinic_id == clinic_id,
        )
    )
    svc = result.scalar_one_or_none()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    return ServiceResponse.model_validate(svc)
