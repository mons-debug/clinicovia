import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


# ── Integration schemas ──────────────────────────────────────────

class IntegrationResponse(BaseModel):
    id: uuid.UUID
    platform: str
    is_enabled: bool
    has_credentials: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IntegrationDetailResponse(BaseModel):
    id: uuid.UUID
    platform: str
    is_enabled: bool
    credential_fields: dict = {}
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IntegrationListResponse(BaseModel):
    integrations: list[IntegrationResponse]


class IntegrationUpsert(BaseModel):
    is_enabled: bool = True
    credentials: dict = {}


# ── Event Mapping schemas ────────────────────────────────────────

class EventMappingResponse(BaseModel):
    id: uuid.UUID
    pipeline_stage: str
    event_name: str
    include_value: bool
    is_active: bool

    model_config = {"from_attributes": True}


class EventMappingListResponse(BaseModel):
    mappings: list[EventMappingResponse]


class EventMappingItem(BaseModel):
    pipeline_stage: str
    event_name: str
    include_value: bool = False
    is_active: bool = True


class EventMappingBulkUpdate(BaseModel):
    mappings: list[EventMappingItem]


# ── Conversion Event schemas ─────────────────────────────────────

class ConversionEventResponse(BaseModel):
    id: uuid.UUID
    platform: str
    event_name: str
    event_id: str
    trigger_type: str
    trigger_id: uuid.UUID | None = None
    patient_id: uuid.UUID | None = None
    value: Decimal | None = None
    currency: str = "AED"
    status: str
    error_message: str | None = None
    attempts: int = 0
    sent_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversionEventListResponse(BaseModel):
    events: list[ConversionEventResponse]
    total: int
    page: int
    page_size: int


class ConversionStatsResponse(BaseModel):
    total_events: int = 0
    by_platform: dict = {}
    by_event_name: dict = {}
    by_status: dict = {}
    total_value: Decimal = Decimal("0")
    currency: str = "AED"
