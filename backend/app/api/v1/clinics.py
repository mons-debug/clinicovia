"""
Clinic settings — read + update the current user's active clinic.

Only members of the clinic can read; only owner / manager can update.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.clinic import Clinic, Role
from app.models.user import User
from app.schemas.clinic import ClinicResponse, ClinicUpdate


router = APIRouter()


def _active_membership(user: User):
    return next((m for m in user.memberships if m.is_active), None)


@router.get("/me", response_model=ClinicResponse)
async def get_my_clinic(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Read the current user's active clinic."""
    membership = _active_membership(user)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")

    res = await db.execute(select(Clinic).where(Clinic.id == membership.clinic_id))
    clinic = res.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return ClinicResponse.model_validate(clinic)


@router.patch("/me", response_model=ClinicResponse)
async def update_my_clinic(
    body: ClinicUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's clinic. Owner / manager only."""
    membership = _active_membership(user)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    if membership.role not in (Role.CLINIC_OWNER, Role.MANAGER, Role.SUPER_ADMIN):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    res = await db.execute(select(Clinic).where(Clinic.id == membership.clinic_id))
    clinic = res.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(clinic, key, value)

    await db.commit()
    await db.refresh(clinic)
    return ClinicResponse.model_validate(clinic)
