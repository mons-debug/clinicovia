import uuid
from datetime import date, time, datetime
from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────

class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID | None = None
    appointment_date: date
    start_time: time
    end_time: time
    duration_minutes: int = 30
    treatment: str = Field(min_length=1, max_length=255)
    kind: str | None = "consultation"
    room: str | None = Field(None, max_length=64)
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    doctor_id: uuid.UUID | None = None
    appointment_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    duration_minutes: int | None = None
    treatment: str | None = None
    notes: str | None = None


class AppointmentStatusUpdate(BaseModel):
    status: str = Field(min_length=1)


# ── Response schemas ─────────────────────────────────────────────

class AppointmentResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str = ""
    patient_phone: str = ""
    patient_initials: str = ""
    doctor_id: uuid.UUID | None
    doctor_name: str = ""
    doctor_color: str = "#6B7280"
    appointment_date: date
    start_time: time
    end_time: time
    duration_minutes: int
    treatment: str
    status: str
    notes: str | None
    is_first_visit: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AppointmentStats(BaseModel):
    total: int
    scheduled: int = 0
    confirmed: int = 0
    checked_in: int = 0
    in_progress: int = 0
    completed: int = 0
    cancelled: int = 0
    no_show: int = 0


class AppointmentListResponse(BaseModel):
    appointments: list[AppointmentResponse]
    total: int
    stats: AppointmentStats


class TreatmentResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    duration_minutes: int
    price: float
    currency: str
    category: str | None
    model_config = {"from_attributes": True}


class TreatmentListResponse(BaseModel):
    treatments: list[TreatmentResponse]
