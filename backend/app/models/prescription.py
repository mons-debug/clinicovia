"""
Prescriptions (ordonnances) + drug catalog.

Sequential per-clinic per-year numbering: ORD-YYYY-NNNN.
Status state machine: draft → signed → cancelled (terminal).

Drug catalog seeds 30+ common Maroc DCI; new drugs can be added per
clinic. drug_class drives the allergy cross-check (planned for W4.3.b).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
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
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class PrescriptionStatus(str, PyEnum):
    DRAFT = "draft"
    SIGNED = "signed"
    CANCELLED = "cancelled"


class DrugForm(str, PyEnum):
    TABLET = "tablet"
    CAPSULE = "capsule"
    SYRUP = "syrup"
    INJECTION = "injection"
    CREAM = "cream"
    OINTMENT = "ointment"
    DROPS = "drops"
    SPRAY = "spray"
    OTHER = "other"


class Drug(Base, TimestampMixin, TenantMixin):
    """Per-clinic prescribable drug. DCI = Dénomination Commune Internationale."""
    __tablename__ = "drugs"
    __table_args__ = (
        UniqueConstraint("clinic_id", "dci", "strength", "form", name="uq_drugs_clinic_key"),
        Index("ix_drugs_clinic_dci", "clinic_id", "dci"),
        Index("ix_drugs_clinic_class", "clinic_id", "drug_class"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    dci: Mapped[str] = mapped_column(String(128), nullable=False)              # paracétamol
    brand: Mapped[str | None] = mapped_column(String(128), nullable=True)      # Doliprane
    form: Mapped[DrugForm] = mapped_column(Enum(DrugForm), nullable=False)
    strength: Mapped[str | None] = mapped_column(String(64), nullable=True)    # 500 mg
    drug_class: Mapped[str | None] = mapped_column(String(64), nullable=True)  # antalgique
    default_posology: Mapped[str | None] = mapped_column(String(255), nullable=True)
    default_duration: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Prescription(Base, TimestampMixin, TenantMixin):
    __tablename__ = "prescriptions"
    __table_args__ = (
        UniqueConstraint("clinic_id", "number", name="uq_prescriptions_clinic_number"),
        Index("ix_prescriptions_clinic_patient", "clinic_id", "patient_id"),
        Index("ix_prescriptions_clinic_status", "clinic_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_plans.id", ondelete="SET NULL"), nullable=True
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    number: Mapped[str] = mapped_column(String(32), nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    language: Mapped[str] = mapped_column(String(8), default="fr", nullable=False)

    # Drug lines: [{ dci, brand?, form, strength, posology, duration, note? }]
    lines: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    renewable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    status: Mapped[PrescriptionStatus] = mapped_column(
        Enum(PrescriptionStatus), default=PrescriptionStatus.DRAFT, nullable=False
    )
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class PrescriptionCounter(Base, TenantMixin):
    """Per-clinic per-year sequential prescription counter."""
    __tablename__ = "prescription_counters"
    __table_args__ = (
        UniqueConstraint("clinic_id", "year", name="uq_prescription_counters_clinic_year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    last_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
