"""Pydantic schemas for treatment plans + sessions."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------- Sessions ----------------------------------------------------

class SessionResponse(BaseModel):
    id: uuid.UUID
    plan_id: uuid.UUID
    appointment_id: uuid.UUID | None
    session_number: int
    planned_for: datetime | None
    status: str
    products_used: list | None
    outcome_score: int | None
    outcome_note: str | None
    session_price: float | None = None
    completed_at: datetime | None
    skipped_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Plans -------------------------------------------------------

class PlanCreate(BaseModel):
    patient_id: uuid.UUID
    programme_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=255)
    primary_service: str | None = None
    indication_slugs: list[str] | None = None
    zone_slugs: list[str] | None = None
    total_sessions: int = Field(1, ge=1, le=24)
    interval_value: int = Field(4, ge=1, le=52)
    interval_unit: str = "weeks"     # days | weeks | months
    estimated_total: float | None = None
    currency: str = "MAD"
    doctor_id: uuid.UUID | None = None
    notes: str | None = None
    start_at: datetime | None = None  # if omitted, defaults to now
    session_price: float | None = None  # MAD per séance
    auto_schedule: bool = False
    default_hour: int = Field(10, ge=7, le=20)
    default_minute: int = Field(0, ge=0, le=59)
    default_duration_minutes: int = Field(30, ge=15, le=240)


class PlanUpdate(BaseModel):
    title: str | None = None
    primary_service: str | None = None
    indication_slugs: list[str] | None = None
    zone_slugs: list[str] | None = None
    total_sessions: int | None = Field(None, ge=1, le=24)
    interval_value: int | None = Field(None, ge=1, le=52)
    interval_unit: str | None = None
    estimated_total: float | None = None
    doctor_id: uuid.UUID | None = None
    notes: str | None = None
    status: str | None = None
    cancelled_reason: str | None = None


class PlanResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: uuid.UUID
    programme_id: uuid.UUID | None = None
    created_by: uuid.UUID | None
    doctor_id: uuid.UUID | None
    title: str
    primary_service: str | None
    indication_slugs: list | None
    zone_slugs: list | None
    total_sessions: int
    interval_value: int
    interval_unit: str
    estimated_total: float | None
    currency: str
    status: str
    version: str
    start_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    cancelled_reason: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    sessions: list[SessionResponse] = []

    model_config = {"from_attributes": True}


class PlanListResponse(BaseModel):
    plans: list[PlanResponse]
    total: int


# ---------- Session events ---------------------------------------------

class SessionAdvanceRequest(BaseModel):
    to_status: str  # scheduled | in_progress | completed | skipped | planned
    outcome_score: int | None = Field(None, ge=1, le=10)
    outcome_note: str | None = None


class SessionUpdateRequest(BaseModel):
    outcome_score: int | None = Field(None, ge=1, le=10)
    outcome_note: str | None = None
    products_used: list | None = None
