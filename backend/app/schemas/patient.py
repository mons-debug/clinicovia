import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────

class PatientCreate(BaseModel):
    # Identity
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str | None = None
    phone: str = Field(min_length=1, max_length=50)
    phone_country_code: str = "+212"
    gender: str | None = None
    date_of_birth: date | None = None
    cnie: str | None = Field(None, max_length=32)
    # Address
    city: str | None = None
    country: str | None = None
    address: str | None = None
    # Preferences
    language_pref: str | None = Field("fr", max_length=8)
    channel_pref: str | None = "whatsapp"
    # Clinical
    fitzpatrick: str | None = None  # "I" .. "VI"
    weight_kg: float | None = Field(None, gt=0, le=500)
    height_cm: float | None = Field(None, gt=0, le=300)
    smoker: bool | None = None
    # Lead / attribution
    lead_source: str | None = None
    treatment_interests: str | None = None
    source_campaign: str | None = None
    source_medium: str | None = None
    first_touch_at: datetime | None = None
    # Reception <-> doctor workflow
    intake_status: str | None = "active"
    requested_service: str | None = Field(None, max_length=256)
    # Misc
    assigned_to: uuid.UUID | None = None
    internal_notes: str | None = None
    tags: list[str] | None = None


class PatientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    phone_country_code: str | None = None
    gender: str | None = None
    date_of_birth: date | None = None
    cnie: str | None = None
    city: str | None = None
    country: str | None = None
    address: str | None = None
    language_pref: str | None = None
    channel_pref: str | None = None
    fitzpatrick: str | None = None
    weight_kg: float | None = Field(None, gt=0, le=500)
    height_cm: float | None = Field(None, gt=0, le=300)
    smoker: bool | None = None
    status: str | None = None
    lead_source: str | None = None
    lead_score: int | None = Field(None, ge=0, le=100)
    treatment_interests: str | None = None
    source_campaign: str | None = None
    source_medium: str | None = None
    intake_status: str | None = None
    requested_service: str | None = None
    assigned_to: uuid.UUID | None = None
    internal_notes: str | None = None
    archived: bool | None = None  # set true to archive
    tags: list[str] | None = None


class NoteCreate(BaseModel):
    content: str = Field(min_length=1)
    is_pinned: bool = False


# ── Response schemas ─────────────────────────────────────────────

class PatientTagResponse(BaseModel):
    id: uuid.UUID
    tag: str
    color: str
    model_config = {"from_attributes": True}


class PatientNoteResponse(BaseModel):
    id: uuid.UUID
    content: str
    is_pinned: bool
    author_id: uuid.UUID | None
    created_at: datetime
    model_config = {"from_attributes": True}


class PatientActivityResponse(BaseModel):
    id: uuid.UUID
    action: str
    description: str
    actor_id: uuid.UUID | None
    created_at: datetime
    model_config = {"from_attributes": True}


class PatientResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    # Identity
    first_name: str
    last_name: str
    email: str | None
    phone: str
    phone_country_code: str
    gender: str | None
    date_of_birth: date | None
    cnie: str | None
    avatar_url: str | None
    # Address
    city: str | None
    country: str | None
    # Preferences
    language_pref: str
    channel_pref: str
    # Clinical
    fitzpatrick: str | None
    weight_kg: float | None
    height_cm: float | None
    bmi: float | None
    smoker: bool | None
    # Lead / attribution
    status: str
    lead_source: str | None
    lead_score: int
    treatment_interests: str | None
    source_campaign: str | None
    source_medium: str | None
    first_touch_at: datetime | None
    # Workflow
    intake_status: str
    intake_at: datetime | None
    doctor_called_at: datetime | None = None
    requested_service: str | None
    # Assignment + financial
    assigned_to: uuid.UUID | None
    total_spent: float
    lifetime_value: float
    # WhatsApp
    whatsapp_id: str | None
    # Notes + lifecycle
    internal_notes: str | None
    is_active: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
    tags: list[PatientTagResponse] = []

    model_config = {"from_attributes": True}


class PatientListResponse(BaseModel):
    patients: list[PatientResponse]
    total: int
    page: int
    page_size: int
    pages: int
