import uuid
from enum import Enum as PyEnum

from sqlalchemy import ForeignKey, String, Enum, Text, Integer, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, TenantMixin


class DealTemperature(str, PyEnum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"


class Deal(Base, TimestampMixin, TenantMixin):
    __tablename__ = "deals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    pipeline_stage: Mapped[str] = mapped_column(String(100), default="New Lead")
    stage_order: Mapped[int] = mapped_column(Integer, default=0)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), default="MAD")
    treatment: Mapped[str | None] = mapped_column(String(255), nullable=True)
    temperature: Mapped[DealTemperature] = mapped_column(Enum(DealTemperature), default=DealTemperature.WARM)

    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_won: Mapped[bool] = mapped_column(Boolean, default=False)
    is_lost: Mapped[bool] = mapped_column(Boolean, default=False)
    lost_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    activities = relationship("DealActivity", back_populates="deal", cascade="all, delete-orphan")


class DealActivity(Base, TimestampMixin, TenantMixin):
    __tablename__ = "deal_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    from_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    to_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)

    deal = relationship("Deal", back_populates="activities")
