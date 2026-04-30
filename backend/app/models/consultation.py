"""
Consultation (SOAP) note.

Linked to a patient + optional appointment + plan/session + doctor.
Sequential per-clinic per-year numbering: CONS-YYYY-NNNN.
Status state machine: draft → signed → cancelled (terminal).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class ConsultationStatus(str, PyEnum):
    DRAFT = "draft"
    SIGNED = "signed"
    CANCELLED = "cancelled"


class Consultation(Base, TimestampMixin, TenantMixin):
    __tablename__ = "consultations"
    __table_args__ = (
        UniqueConstraint("clinic_id", "number", name="uq_consultations_clinic_number"),
        Index("ix_consultations_clinic_patient", "clinic_id", "patient_id"),
        Index("ix_consultations_clinic_status", "clinic_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_plans.id", ondelete="SET NULL"), nullable=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_sessions.id", ondelete="SET NULL"), nullable=True
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    number: Mapped[str] = mapped_column(String(32), nullable=False)
    visit_date: Mapped[date] = mapped_column(Date, nullable=False)
    language: Mapped[str] = mapped_column(String(8), default="fr", nullable=False)

    # SOAP — Subjective, Objective, Assessment, Plan
    subjective: Mapped[str | None] = mapped_column(Text, nullable=True)
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessment: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    chief_complaint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[ConsultationStatus] = mapped_column(
        Enum(ConsultationStatus), default=ConsultationStatus.DRAFT, nullable=False
    )
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class ConsultationCounter(Base, TenantMixin):
    __tablename__ = "consultation_counters"
    __table_args__ = (
        UniqueConstraint("clinic_id", "year", name="uq_consultation_counters_clinic_year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    last_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
