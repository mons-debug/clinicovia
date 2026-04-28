import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.patient import Patient, PatientStatus
from app.middleware.auth import get_current_user

router = APIRouter()


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        return uuid.uuid4()  # fallback - won't match anything
    return membership.clinic_id


@router.get("/stats")
async def dashboard_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Main dashboard KPI stats."""
    clinic_id = _get_clinic_id(user)
    today = date.today()

    # Total patients
    total_patients = (await db.execute(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == clinic_id, Patient.is_active == True  # noqa: E712
        )
    )).scalar_one()

    # New patients today
    new_today = (await db.execute(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == clinic_id,
            Patient.is_active == True,  # noqa: E712
            func.date(Patient.created_at) == today,
        )
    )).scalar_one()

    # New patients this month
    month_start = today.replace(day=1)
    new_this_month = (await db.execute(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == clinic_id,
            Patient.is_active == True,  # noqa: E712
            func.date(Patient.created_at) >= month_start,
        )
    )).scalar_one()

    # Status breakdown
    status_counts = {}
    for s in PatientStatus:
        count = (await db.execute(
            select(func.count(Patient.id)).where(
                Patient.clinic_id == clinic_id,
                Patient.is_active == True,  # noqa: E712
                Patient.status == s,
            )
        )).scalar_one()
        status_counts[s.value] = count

    return {
        "total_patients": total_patients,
        "new_today": new_today,
        "new_this_month": new_this_month,
        "status_breakdown": status_counts,
        # Placeholders for future modules
        "appointments_today": 0,
        "revenue_mtd": 0,
        "avg_response_time": 0,
        "active_conversations": 0,
    }


@router.get("/recent-patients")
async def recent_patients(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Last 10 patients added."""
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Patient)
        .where(Patient.clinic_id == clinic_id, Patient.is_active == True)  # noqa: E712
        .order_by(Patient.created_at.desc())
        .limit(10)
    )
    patients = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.full_name,
            "phone": p.phone,
            "status": p.status.value if p.status else "new",
            "lead_source": p.lead_source.value if p.lead_source else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in patients
    ]
