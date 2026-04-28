import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────

class DealCreate(BaseModel):
    patient_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    value: float = Field(ge=0, default=0.0)
    currency: str = "AED"
    treatment: str | None = None
    temperature: str = "warm"
    assigned_to: uuid.UUID | None = None
    notes: str | None = None


class DealUpdate(BaseModel):
    title: str | None = None
    value: float | None = Field(None, ge=0)
    treatment: str | None = None
    temperature: str | None = None
    assigned_to: uuid.UUID | None = None
    notes: str | None = None


class DealStageMove(BaseModel):
    stage: str = Field(min_length=1, max_length=100)


class DealLostRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


# ── Response schemas ─────────────────────────────────────────────

class DealActivityResponse(BaseModel):
    id: uuid.UUID
    action: str
    description: str
    from_stage: str | None
    to_stage: str | None
    actor_id: uuid.UUID | None
    created_at: datetime
    model_config = {"from_attributes": True}


class DealResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str = ""
    patient_phone: str = ""
    pipeline_stage: str
    stage_order: int
    title: str
    value: float
    currency: str
    treatment: str | None
    temperature: str
    assigned_to: uuid.UUID | None
    notes: str | None
    is_won: bool
    is_lost: bool
    lost_reason: str | None
    days_in_stage: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class DealDetailResponse(DealResponse):
    patient_email: str | None = None
    activities: list[DealActivityResponse] = []


class StageSummary(BaseModel):
    count: int
    value: float


class DealSummary(BaseModel):
    total_value: float
    total_deals: int
    by_stage: dict[str, StageSummary]


class DealListResponse(BaseModel):
    deals: list[DealResponse]
    summary: DealSummary
