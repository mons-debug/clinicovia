import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class FormCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    schema: dict = Field(default_factory=lambda: {"fields": [], "settings": {}})


class FormUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    schema: dict | None = None


class FormResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    slug: str
    status: str
    schema: dict
    submission_count: int
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class FormListItem(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    slug: str
    status: str
    submission_count: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class FormStats(BaseModel):
    total: int
    active: int
    total_submissions: int


class FormListResponse(BaseModel):
    forms: list[FormListItem]
    total: int
    stats: FormStats


class FormSubmissionResponse(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    data: dict
    patient_id: uuid.UUID | None
    ip_address: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class FormSubmissionListResponse(BaseModel):
    submissions: list[FormSubmissionResponse]
    total: int
    page: int
    page_size: int


class PublicFormResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    title: str
    description: str | None
    schema: dict
    model_config = {"from_attributes": True}


class PublicFormSubmitRequest(BaseModel):
    data: dict
