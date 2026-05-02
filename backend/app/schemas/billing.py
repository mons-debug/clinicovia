"""Pydantic schemas for invoices + payments."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# ---------- Line items --------------------------------------------------

class LineItem(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    quantity: float = Field(1, gt=0)
    unit_price: float = Field(0, ge=0)


# ---------- Invoice -----------------------------------------------------

class InvoiceCreate(BaseModel):
    patient_id: uuid.UUID
    plan_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = None
    issue_date: date | None = None  # defaults to today
    line_items: list[LineItem]
    discount: float = 0.0
    tva_rate: float = 0.0
    currency: str = "MAD"
    notes: str | None = None


class InvoiceUpdate(BaseModel):
    line_items: list[LineItem] | None = None
    discount: float | None = None
    tva_rate: float | None = None
    notes: str | None = None


class PaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    method: str = "cash"
    kind: str = "payment"
    reference: str | None = None
    note: str | None = None
    received_at: datetime | None = None  # defaults to now


class PaymentResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    received_by: uuid.UUID | None
    amount: float
    method: str
    kind: str
    reference: str | None
    note: str | None
    received_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: uuid.UUID
    plan_id: uuid.UUID | None
    session_id: uuid.UUID | None = None
    issued_by: uuid.UUID | None
    number: str
    issue_date: date
    line_items: list
    subtotal: float
    discount: float
    tva_rate: float
    tva: float
    total: float
    total_paid: float
    currency: str
    status: str
    issued_at: datetime | None
    cancelled_at: datetime | None
    cancel_reason: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    payments: list[PaymentResponse] = []

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    invoices: list[InvoiceResponse]
    total: int


class CancelRequest(BaseModel):
    reason: str | None = None
