import uuid
from enum import Enum as PyEnum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Enum, Boolean, DateTime, Text, Integer, Numeric, Index, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TenantMixin


class TrackingPlatform(str, PyEnum):
    META = "meta"
    GOOGLE_ADS = "google_ads"
    GA4 = "ga4"
    GTM = "gtm"
    SNAPCHAT = "snapchat"
    TIKTOK = "tiktok"


class TriggerType(str, PyEnum):
    WHATSAPP_MESSAGE = "whatsapp_message"
    DEAL_STAGE_CHANGE = "deal_stage_change"
    APPOINTMENT_STATUS = "appointment_status"
    FORM_SUBMISSION = "form_submission"


class EventStatus(str, PyEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    RETRYING = "retrying"


class TrackingIntegration(Base, TimestampMixin, TenantMixin):
    __tablename__ = "tracking_integrations"
    __table_args__ = (
        UniqueConstraint("clinic_id", "platform", name="uq_tracking_clinic_platform"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform: Mapped[TrackingPlatform] = mapped_column(Enum(TrackingPlatform), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    encrypted_credentials: Mapped[str] = mapped_column(Text, nullable=False, default="")


class EventMapping(Base, TimestampMixin, TenantMixin):
    __tablename__ = "event_mappings"
    __table_args__ = (
        UniqueConstraint("clinic_id", "pipeline_stage", name="uq_mapping_clinic_stage"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_stage: Mapped[str] = mapped_column(String(100), nullable=False)
    event_name: Mapped[str] = mapped_column(String(100), nullable=False)
    include_value: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ConversionEvent(Base, TenantMixin):
    __tablename__ = "conversion_events"
    __table_args__ = (
        Index("ix_conv_event_clinic_created", "clinic_id", "created_at"),
        Index("ix_conv_event_clinic_platform_status", "clinic_id", "platform", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform: Mapped[TrackingPlatform] = mapped_column(Enum(TrackingPlatform), nullable=False)
    event_name: Mapped[str] = mapped_column(String(100), nullable=False)
    event_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    trigger_type: Mapped[TriggerType] = mapped_column(Enum(TriggerType), nullable=False)
    trigger_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="SET NULL"), nullable=True
    )
    value: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="AED")
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus), default=EventStatus.PENDING)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)
