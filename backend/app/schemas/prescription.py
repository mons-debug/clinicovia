"""Pydantic schemas for prescriptions + drug catalog."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# ---------- Drug catalog -----------------------------------------------

class DrugResponse(BaseModel):
    id: uuid.UUID
    dci: str
    brand: str | None
    form: str
    strength: str | None
    drug_class: str | None
    default_posology: str | None
    default_duration: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class DrugCreate(BaseModel):
    dci: str = Field(min_length=1, max_length=128)
    brand: str | None = Field(None, max_length=128)
    form: str
    strength: str | None = Field(None, max_length=64)
    drug_class: str | None = Field(None, max_length=64)
    default_posology: str | None = Field(None, max_length=255)
    default_duration: str | None = Field(None, max_length=64)


class DrugListResponse(BaseModel):
    drugs: list[DrugResponse]
    total: int


# ---------- Prescription -----------------------------------------------

class PrescriptionLine(BaseModel):
    dci: str = Field(min_length=1)
    brand: str | None = None
    form: str | None = None
    strength: str | None = None
    posology: str = Field(min_length=1)
    duration: str | None = None
    note: str | None = None


class PrescriptionCreate(BaseModel):
    patient_id: uuid.UUID
    plan_id: uuid.UUID | None = None
    appointment_id: uuid.UUID | None = None
    issue_date: date | None = None
    language: str = "fr"
    diagnosis: str | None = None
    notes: str | None = None
    renewable: bool = False
    lines: list[PrescriptionLine]


class PrescriptionResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: uuid.UUID
    plan_id: uuid.UUID | None
    appointment_id: uuid.UUID | None
    doctor_id: uuid.UUID | None
    number: str
    issue_date: date
    language: str
    lines: list
    diagnosis: str | None
    notes: str | None
    renewable: bool
    status: str
    signed_at: datetime | None
    cancelled_at: datetime | None
    cancel_reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PrescriptionListResponse(BaseModel):
    prescriptions: list[PrescriptionResponse]
    total: int


class CancelRequest(BaseModel):
    reason: str | None = None
