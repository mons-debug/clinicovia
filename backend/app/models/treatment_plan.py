"""
Treatment plans + sessions (séances).

A plan groups N sessions of the same treatment, scheduled at a fixed
interval (e.g. Botox course of 4 séances, every 4 weeks). The plan
tracks aggregate progress; each session tracks the individual visit's
outcome.

Ported from Refine OS schema, adapted to Clinicovia's clinic_id-based
multi-tenancy.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin


class IntervalUnit(str, PyEnum):
    DAYS = "days"
    WEEKS = "weeks"
    MONTHS = "months"


class PlanStatus(str, PyEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SessionStatus(str, PyEnum):
    PLANNED = "planned"          # placeholder, no date yet
    SCHEDULED = "scheduled"      # appointment booked
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class TreatmentPlan(Base, TimestampMixin, TenantMixin):
    __tablename__ = "treatment_plans"
    __table_args__ = (
        Index("ix_treatment_plans_clinic_patient", "clinic_id", "patient_id"),
        Index("ix_treatment_plans_clinic_status", "clinic_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    primary_service: Mapped[str | None] = mapped_column(String(128), nullable=True)
    indication_slugs: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # ["lignes-frontales", ...]
    zone_slugs: Mapped[list | None] = mapped_column(JSONB, nullable=True)        # ["glabelle", ...]

    total_sessions: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    interval_value: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    interval_unit: Mapped[IntervalUnit] = mapped_column(
        Enum(IntervalUnit), default=IntervalUnit.WEEKS, nullable=False
    )

    estimated_total: Mapped[float | None] = mapped_column(Float, nullable=True)  # MAD
    currency: Mapped[str] = mapped_column(String(10), default="MAD")

    status: Mapped[PlanStatus] = mapped_column(Enum(PlanStatus), default=PlanStatus.ACTIVE)
    version: Mapped[str] = mapped_column(String(16), default="v1")

    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    sessions = relationship(
        "TreatmentSession",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="TreatmentSession.session_number.asc()",
    )


class TreatmentSession(Base, TimestampMixin, TenantMixin):
    __tablename__ = "treatment_sessions"
    __table_args__ = (
        Index("ix_treatment_sessions_plan", "plan_id"),
        Index("ix_treatment_sessions_clinic_status", "clinic_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_plans.id", ondelete="CASCADE"), nullable=False
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )

    session_number: Mapped[int] = mapped_column(Integer, nullable=False)
    planned_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus), default=SessionStatus.PLANNED, nullable=False
    )

    products_used: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # JSON array: [{ product_name, units, lot? }, ...]

    outcome_score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-10
    outcome_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    session_price: Mapped[float | None] = mapped_column(Float, nullable=True)  # MAD per séance

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    skipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    plan = relationship("TreatmentPlan", back_populates="sessions")
