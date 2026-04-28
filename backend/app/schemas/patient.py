import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────

class PatientCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str | None = None
    phone: str = Field(min_length=1, max_length=50)
    phone_country_code: str = "+971"
    gender: str | None = None
    date_of_birth: date | None = None
    city: str | None = None
    country: str | None = None
    address: str | None = None
    lead_source: str | None = None
    treatment_interests: str | None = None
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
    city: str | None = None
    country: str | None = None
    address: str | None = None
    status: str | None = None
    lead_source: str | None = None
    lead_score: int | None = Field(None, ge=0, le=100)
    treatment_interests: str | None = None
    assigned_to: uuid.UUID | None = None
    internal_notes: str | None = None
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
    first_name: str
    last_name: str
    email: str | None
    phone: str
    phone_country_code: str
    gender: str | None
    date_of_birth: date | None
    avatar_url: str | None
    city: str | None
    country: str | None
    status: str
    lead_source: str | None
    lead_score: int
    treatment_interests: str | None
    assigned_to: uuid.UUID | None
    total_spent: float
    lifetime_value: float
    whatsapp_id: str | None
    internal_notes: str | None
    is_active: bool
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
