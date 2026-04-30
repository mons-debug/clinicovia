"""Pydantic schemas for the current clinic profile."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ClinicResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    clinic_type: str | None
    description: str | None
    logo_url: str | None
    phone: str | None
    email: str | None
    website: str | None
    address: str | None
    city: str | None
    country: str | None
    timezone: str
    currency: str
    language: str

    # Moroccan legal IDs
    ice: str | None
    if_number: str | None
    rc_number: str | None
    cnss: str | None

    # Branding
    primary_color: str
    accent_color: str

    # Status
    plan: str
    status: str
    is_active: bool

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClinicUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    clinic_type: str | None = None
    description: str | None = None
    logo_url: str | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    timezone: str | None = None
    currency: str | None = None
    language: str | None = None

    ice: str | None = Field(None, max_length=32)
    if_number: str | None = Field(None, max_length=32)
    rc_number: str | None = Field(None, max_length=32)
    cnss: str | None = Field(None, max_length=32)

    primary_color: str | None = Field(None, max_length=20)
    accent_color: str | None = Field(None, max_length=20)
