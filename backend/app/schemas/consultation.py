"""Pydantic schemas for consultations."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class ConsultationCreate(BaseModel):
    patient_id: uuid.UUID
    appointment_id: uuid.UUID | None = None
    plan_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = None
    visit_date: date | None = None
    language: str = "fr"
    chief_complaint: str | None = Field(None, max_length=255)
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan_text: str | None = None
    notes: str | None = None


class ConsultationUpdate(BaseModel):
    chief_complaint: str | None = None
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan_text: str | None = None
    notes: str | None = None


class ConsultationResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: uuid.UUID
    appointment_id: uuid.UUID | None
    plan_id: uuid.UUID | None
    session_id: uuid.UUID | None
    doctor_id: uuid.UUID | None
    number: str
    visit_date: date
    language: str
    chief_complaint: str | None
    subjective: str | None
    objective: str | None
    assessment: str | None
    plan_text: str | None
    notes: str | None
    status: str
    signed_at: datetime | None
    cancelled_at: datetime | None
    cancel_reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConsultationListResponse(BaseModel):
    consultations: list[ConsultationResponse]
    total: int


class CancelRequest(BaseModel):
    reason: str | None = None
