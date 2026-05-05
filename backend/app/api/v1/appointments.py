import uuid
import hashlib
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment, Treatment, AppointmentStatus
from app.models.pipeline import Deal, DealActivity
from app.models.clinic import ClinicMembership, Role
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentStatusUpdate,
    AppointmentResponse,
    AppointmentListResponse,
    AppointmentStats,
    TreatmentResponse,
    TreatmentListResponse,
)
from app.middleware.auth import get_current_user
from app.services.whatsapp_notifications import (
    notify_appointment_created,
    notify_appointment_status,
    notify_appointment_reminder,
    send_appointment_whatsapp,
)

router = APIRouter()

# Valid status transitions
VALID_TRANSITIONS: dict[str, set[str]] = {
    "scheduled": {"confirmed", "cancelled"},
    "confirmed": {"checked_in", "cancelled"},
    "checked_in": {"in_progress", "no_show"},
    "in_progress": {"completed", "cancelled"},
}

TERMINAL_STATUSES = {"completed", "cancelled", "no_show"}

# Doctor colors derived from a stable hash
DOCTOR_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#EC4899", "#06B6D4", "#84CC16"]


def _get_clinic_id(user: User) -> uuid.UUID:
    membership = next((m for m in user.memberships if m.is_active), None)
    if not membership:
        raise HTTPException(status_code=403, detail="No active clinic membership")
    return membership.clinic_id


def _doctor_color(doctor_id: uuid.UUID | None, index: int = 0) -> str:
    if not doctor_id:
        return "#6B7280"
    h = int(hashlib.md5(str(doctor_id).encode()).hexdigest()[:8], 16)
    return DOCTOR_COLORS[h % len(DOCTOR_COLORS)]


async def _enrich_appointment(
    apt: Appointment,
    patients_map: dict[uuid.UUID, Patient],
    doctors_map: dict[uuid.UUID, User],
) -> AppointmentResponse:
    patient = patients_map.get(apt.patient_id)
    doctor = doctors_map.get(apt.doctor_id) if apt.doctor_id else None

    p_name = f"{patient.first_name} {patient.last_name}" if patient else ""
    p_initials = f"{patient.first_name[0]}{patient.last_name[0]}" if patient else ""
    d_name = f"Dr. {doctor.first_name}" if doctor else ""

    return AppointmentResponse(
        id=apt.id,
        patient_id=apt.patient_id,
        patient_name=p_name,
        patient_phone=patient.phone if patient else "",
        patient_initials=p_initials,
        doctor_id=apt.doctor_id,
        doctor_service_id=apt.doctor_service_id,
        doctor_name=d_name,
        doctor_color=_doctor_color(apt.doctor_id),
        appointment_date=apt.appointment_date,
        start_time=apt.start_time,
        end_time=apt.end_time,
        duration_minutes=apt.duration_minutes,
        treatment=apt.treatment,
        kind=apt.kind.value if hasattr(apt.kind, 'value') else str(apt.kind),
        status=apt.status.value if hasattr(apt.status, 'value') else str(apt.status),
        room=apt.room,
        notes=apt.notes,
        is_first_visit=apt.is_first_visit,
        needs_confirmation=apt.needs_confirmation,
        created_at=apt.created_at,
        updated_at=apt.updated_at,
    )


@router.get("", response_model=AppointmentListResponse)
async def list_appointments(
    date_from: date | None = None,
    date_to: date | None = None,
    doctor_id: uuid.UUID | None = None,
    status_filter: str | None = Query(None, alias="status"),
    patient_search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    today = date.today()

    d_from = date_from or today
    d_to = date_to or d_from

    query = select(Appointment).where(
        Appointment.clinic_id == clinic_id,
        Appointment.appointment_date >= d_from,
        Appointment.appointment_date <= d_to,
    )

    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    if status_filter:
        query = query.where(Appointment.status == status_filter)

    query = query.order_by(Appointment.appointment_date, Appointment.start_time)

    result = await db.execute(query)
    appointments = list(result.scalars().all())

    # Load patients
    patient_ids = list({a.patient_id for a in appointments})
    patients_map: dict[uuid.UUID, Patient] = {}
    if patient_ids:
        p_result = await db.execute(select(Patient).where(Patient.id.in_(patient_ids)))
        for p in p_result.scalars().all():
            patients_map[p.id] = p

    # Patient search filter (post-query)
    if patient_search:
        term = patient_search.lower()
        appointments = [
            a for a in appointments
            if patients_map.get(a.patient_id) and (
                term in patients_map[a.patient_id].full_name.lower()
                or term in (patients_map[a.patient_id].phone or "")
            )
        ]

    # Load doctors
    doctor_ids = list({a.doctor_id for a in appointments if a.doctor_id})
    doctors_map: dict[uuid.UUID, User] = {}
    if doctor_ids:
        d_result = await db.execute(select(User).where(User.id.in_(doctor_ids)))
        for d in d_result.scalars().all():
            doctors_map[d.id] = d

    # Paginate
    total = len(appointments)
    offset = (page - 1) * page_size
    page_apts = appointments[offset:offset + page_size]

    responses = [await _enrich_appointment(a, patients_map, doctors_map) for a in page_apts]

    # Stats
    stats = AppointmentStats(total=total)
    for a in appointments:
        s = a.status.value if hasattr(a.status, 'value') else str(a.status)
        if hasattr(stats, s):
            setattr(stats, s, getattr(stats, s) + 1)

    return AppointmentListResponse(appointments=responses, total=total, stats=stats)


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    body: AppointmentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)

    # Verify patient
    p_result = await db.execute(
        select(Patient).where(Patient.id == body.patient_id, Patient.clinic_id == clinic_id)
    )
    patient = p_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # First-visit detection
    count_result = await db.execute(
        select(func.count()).select_from(Appointment).where(
            Appointment.patient_id == body.patient_id,
            Appointment.clinic_id == clinic_id,
        )
    )
    is_first = count_result.scalar_one() == 0

    apt = Appointment(
        clinic_id=clinic_id,
        patient_id=body.patient_id,
        doctor_id=body.doctor_id,
        doctor_service_id=body.doctor_service_id,
        appointment_date=body.appointment_date,
        start_time=body.start_time,
        end_time=body.end_time,
        duration_minutes=body.duration_minutes,
        treatment=body.treatment,
        kind=(body.kind or "consultation"),
        room=body.room,
        notes=body.notes,
        is_first_visit=is_first,
    )
    db.add(apt)
    await db.flush()

    # Pipeline sync — create DealActivity if patient has active deals
    deal_result = await db.execute(
        select(Deal).where(
            Deal.patient_id == body.patient_id,
            Deal.clinic_id == clinic_id,
            Deal.is_won == False,  # noqa: E712
            Deal.is_lost == False,  # noqa: E712
        ).order_by(Deal.created_at.desc()).limit(1)
    )
    active_deal = deal_result.scalar_one_or_none()
    if active_deal:
        deal_activity = DealActivity(
            clinic_id=clinic_id,
            deal_id=active_deal.id,
            actor_id=user.id,
            action="appointment_booked",
            description=f"Appointment booked: {body.treatment} on {body.appointment_date}",
        )
        db.add(deal_activity)

    await db.commit()

    # Load doctor for response
    doctors_map: dict[uuid.UUID, User] = {}
    doctor_name = ""
    if apt.doctor_id:
        d_result = await db.execute(select(User).where(User.id == apt.doctor_id))
        doc = d_result.scalar_one_or_none()
        if doc:
            doctors_map[doc.id] = doc
            doctor_name = f"Dr. {doc.first_name}"

    # Send WhatsApp confirmation (best effort, don't fail the request)
    try:
        await notify_appointment_created(
            db, clinic_id, patient.id,
            f"{patient.first_name} {patient.last_name}",
            body.treatment, body.appointment_date, body.start_time, doctor_name,
        )
    except Exception:
        pass

    return await _enrich_appointment(apt, {patient.id: patient}, doctors_map)


@router.get("/treatments", response_model=TreatmentListResponse)
async def list_treatments(
    specialty: str | None = Query(None, description="Filter by doctor specialty (aesthetic_medicine | plastic_surgery)"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    query = select(Treatment).where(
        Treatment.clinic_id == clinic_id,
        Treatment.is_active == True,  # noqa: E712
    )
    if specialty:
        # Surface treatments matching the specialty + treatments with no
        # specialty constraint (NULL = available to any doctor).
        query = query.where(
            (Treatment.specialty == specialty) | (Treatment.specialty.is_(None))
        )
    query = query.order_by(Treatment.category.asc().nullslast(), Treatment.name)
    result = await db.execute(query)
    treatments = result.scalars().all()
    return TreatmentListResponse(
        treatments=[TreatmentResponse.model_validate(t) for t in treatments]
    )


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id, Appointment.clinic_id == clinic_id
        )
    )
    apt = result.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Load patient and doctor
    patients_map: dict[uuid.UUID, Patient] = {}
    p_result = await db.execute(select(Patient).where(Patient.id == apt.patient_id))
    p = p_result.scalar_one_or_none()
    if p:
        patients_map[p.id] = p

    doctors_map: dict[uuid.UUID, User] = {}
    if apt.doctor_id:
        d_result = await db.execute(select(User).where(User.id == apt.doctor_id))
        d = d_result.scalar_one_or_none()
        if d:
            doctors_map[d.id] = d

    return await _enrich_appointment(apt, patients_map, doctors_map)


@router.put("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id, Appointment.clinic_id == clinic_id
        )
    )
    apt = result.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(apt, key, value)

    await db.commit()
    await db.refresh(apt)

    patients_map: dict[uuid.UUID, Patient] = {}
    p_result = await db.execute(select(Patient).where(Patient.id == apt.patient_id))
    p = p_result.scalar_one_or_none()
    if p:
        patients_map[p.id] = p

    doctors_map: dict[uuid.UUID, User] = {}
    if apt.doctor_id:
        d_result = await db.execute(select(User).where(User.id == apt.doctor_id))
        d = d_result.scalar_one_or_none()
        if d:
            doctors_map[d.id] = d

    return await _enrich_appointment(apt, patients_map, doctors_map)


@router.patch("/{appointment_id}/status", response_model=AppointmentResponse)
async def update_appointment_status(
    appointment_id: uuid.UUID,
    body: AppointmentStatusUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id, Appointment.clinic_id == clinic_id
        )
    )
    apt = result.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    current = apt.status.value if hasattr(apt.status, 'value') else str(apt.status)
    new_status = body.status

    # Validate transition
    if current in TERMINAL_STATUSES:
        raise HTTPException(status_code=400, detail=f"Cannot change status from terminal state '{current}'")

    allowed = VALID_TRANSITIONS.get(current, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition from '{current}' to '{new_status}'. Allowed: {', '.join(sorted(allowed))}"
        )

    apt.status = new_status
    await db.commit()
    await db.refresh(apt)

    patients_map: dict[uuid.UUID, Patient] = {}
    p_result = await db.execute(select(Patient).where(Patient.id == apt.patient_id))
    p = p_result.scalar_one_or_none()
    if p:
        patients_map[p.id] = p

    doctors_map: dict[uuid.UUID, User] = {}
    if apt.doctor_id:
        d_result = await db.execute(select(User).where(User.id == apt.doctor_id))
        d = d_result.scalar_one_or_none()
        if d:
            doctors_map[d.id] = d

    # Send WhatsApp status notification (best effort)
    if p and new_status in ("confirmed", "cancelled", "checked_in", "completed"):
        try:
            await notify_appointment_status(
                db, clinic_id, p.id,
                f"{p.first_name} {p.last_name}",
                apt.treatment, new_status, apt.appointment_date,
            )
        except Exception:
            pass

    # Fire conversion tracking event (best effort)
    if new_status in ("confirmed", "completed"):
        try:
            from app.services.tracking_hooks import on_appointment_status_change
            await on_appointment_status_change(
                db, clinic_id, apt.id, new_status,
                patient_id=apt.patient_id,
            )
        except Exception:
            pass

    return await _enrich_appointment(apt, patients_map, doctors_map)


@router.post("/{appointment_id}/send-whatsapp")
async def send_appointment_whatsapp_message(
    appointment_id: uuid.UUID,
    request_body: dict | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a WhatsApp message for an appointment (confirmation, reminder, or custom)."""
    clinic_id = _get_clinic_id(user)
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id, Appointment.clinic_id == clinic_id
        )
    )
    apt = result.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    p_result = await db.execute(select(Patient).where(Patient.id == apt.patient_id))
    patient = p_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor_name = ""
    if apt.doctor_id:
        d_result = await db.execute(select(User).where(User.id == apt.doctor_id))
        doc = d_result.scalar_one_or_none()
        if doc:
            doctor_name = f"Dr. {doc.first_name}"

    msg_type = (request_body or {}).get("type", "confirmation")
    patient_name = f"{patient.first_name} {patient.last_name}"

    if msg_type == "reminder":
        sent = await notify_appointment_reminder(
            db, clinic_id, patient.id, patient_name,
            apt.treatment, apt.appointment_date, apt.start_time, doctor_name,
        )
    elif msg_type == "custom":
        custom_msg = (request_body or {}).get("message", "")
        if not custom_msg:
            raise HTTPException(status_code=400, detail="message is required for custom type")
        sent = await send_appointment_whatsapp(db, clinic_id, patient.id, custom_msg)
    else:
        sent = await notify_appointment_created(
            db, clinic_id, patient.id, patient_name,
            apt.treatment, apt.appointment_date, apt.start_time, doctor_name,
        )

    if not sent:
        raise HTTPException(status_code=400, detail="Could not send WhatsApp — no connected session or patient has no phone")

    return {"status": "sent", "type": msg_type}
