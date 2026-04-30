import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.appointment import Appointment, AppointmentStatus
from app.models.billing import Invoice, InvoiceStatus
from app.models.patient import IntakeStatus, Patient, PatientStatus
from app.models.treatment_plan import PlanStatus, TreatmentPlan
from app.models.user import User

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


@router.get("/summary")
async def dashboard_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """One-shot dashboard payload with the metrics the home page actually shows."""
    clinic_id = _get_clinic_id(user)
    today = date.today()
    week_ago = today - timedelta(days=7)
    month_start = today.replace(day=1)

    # Today's appointments (any status except cancelled / no_show)
    today_appts = (await db.execute(
        select(func.count(Appointment.id)).where(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date == today,
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
        )
    )).scalar_one()

    # Yesterday's appointments — for delta
    yest_appts = (await db.execute(
        select(func.count(Appointment.id)).where(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date == today - timedelta(days=1),
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
        )
    )).scalar_one()

    # Patients in queue (intake_pending + awaiting_doctor + in_room)
    in_queue = (await db.execute(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == clinic_id,
            Patient.intake_status.in_([
                IntakeStatus.INTAKE_PENDING,
                IntakeStatus.AWAITING_DOCTOR,
                IntakeStatus.IN_ROOM,
            ]),
            Patient.archived_at.is_(None),
        )
    )).scalar_one()

    # New patients this week (excluding leads — leads tracked separately)
    new_week = (await db.execute(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == clinic_id,
            Patient.is_active == True,  # noqa: E712
            Patient.intake_status != IntakeStatus.LEAD,
            func.date(Patient.created_at) >= week_ago,
        )
    )).scalar_one()

    # WhatsApp leads this week (still in LEAD state)
    leads_week = (await db.execute(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == clinic_id,
            Patient.is_active == True,  # noqa: E712
            Patient.intake_status == IntakeStatus.LEAD,
            func.date(Patient.created_at) >= week_ago,
        )
    )).scalar_one()

    # Total active leads (not yet visited)
    leads_total = (await db.execute(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == clinic_id,
            Patient.is_active == True,  # noqa: E712
            Patient.intake_status == IntakeStatus.LEAD,
        )
    )).scalar_one()

    # Active treatment plans
    active_plans = (await db.execute(
        select(func.count(TreatmentPlan.id)).where(
            TreatmentPlan.clinic_id == clinic_id,
            TreatmentPlan.status == PlanStatus.ACTIVE,
        )
    )).scalar_one()

    # Revenue MTD — sum total_paid on issued/partial/paid invoices this month
    revenue_mtd = (await db.execute(
        select(func.coalesce(func.sum(Invoice.total_paid), 0.0)).where(
            Invoice.clinic_id == clinic_id,
            Invoice.issue_date >= month_start,
            Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.PAID]),
        )
    )).scalar_one()

    # Revenue last month (for delta)
    last_month_end = month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    revenue_last_month = (await db.execute(
        select(func.coalesce(func.sum(Invoice.total_paid), 0.0)).where(
            Invoice.clinic_id == clinic_id,
            Invoice.issue_date >= last_month_start,
            Invoice.issue_date <= last_month_end,
            Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.PAID]),
        )
    )).scalar_one()

    # Today's appointments — full list with patient info for the side panel
    today_list_res = await db.execute(
        select(Appointment, Patient)
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date == today,
        )
        .order_by(Appointment.start_time.asc())
        .limit(10)
    )
    today_appointments = [
        {
            "id": str(appt.id),
            "patient_name": f"{p.first_name} {p.last_name}",
            "patient_id": str(p.id),
            "start_time": appt.start_time.strftime("%H:%M") if appt.start_time else "",
            "treatment": appt.treatment,
            "status": appt.status.value,
            "room": appt.room,
        }
        for appt, p in today_list_res.all()
    ]

    # Recent patients
    rp_res = await db.execute(
        select(Patient)
        .where(Patient.clinic_id == clinic_id, Patient.is_active == True)  # noqa: E712
        .order_by(Patient.created_at.desc())
        .limit(5)
    )
    recent_patients_list = [
        {
            "id": str(p.id),
            "name": f"{p.first_name} {p.last_name}",
            "phone": f"{p.phone_country_code}{p.phone}" if p.phone else "",
            "intake_status": p.intake_status.value if p.intake_status else None,
            "lead_source": p.lead_source.value if p.lead_source else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in rp_res.scalars().all()
    ]

    return {
        "user": {
            "first_name": user.first_name,
            "last_name": user.last_name,
        },
        "metrics": {
            "today_appointments": today_appts,
            "today_appointments_delta": today_appts - yest_appts,
            "in_queue": in_queue,
            "new_patients_week": new_week,
            "leads_week": leads_week,
            "leads_total": leads_total,
            "active_plans": active_plans,
            "revenue_mtd": float(revenue_mtd),
            "revenue_last_month": float(revenue_last_month),
            "currency": "MAD",
        },
        "today_appointments": today_appointments,
        "recent_patients": recent_patients_list,
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
