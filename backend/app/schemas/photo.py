"""Pydantic schemas for body zones + patient photos."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------- Zones -------------------------------------------------------

class BodyZoneResponse(BaseModel):
    id: uuid.UUID
    slug: str
    name_fr: str
    name_ar: str | None
    name_en: str | None
    category: str
    sort_order: int
    is_active: bool

    model_config = {"from_attributes": True}


class BodyZoneCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=64)
    name_fr: str = Field(min_length=1, max_length=128)
    name_ar: str | None = None
    name_en: str | None = None
    category: str  # face | body | hair | extremities
    sort_order: int = 0


class BodyZoneListResponse(BaseModel):
    zones: list[BodyZoneResponse]
    total: int


# ---------- Photos ------------------------------------------------------

class PhotoResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    plan_id: uuid.UUID | None
    appointment_id: uuid.UUID | None
    session_id: uuid.UUID | None = None
    captured_by: uuid.UUID | None
    storage: str
    storage_key: str
    content_type: str
    width: int | None
    height: int | None
    size_bytes: int | None
    zone_slug: str
    stage: str
    angle: str | None
    consent_scope: str
    captured_at: datetime
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PhotoListResponse(BaseModel):
    photos: list[PhotoResponse]
    total: int
