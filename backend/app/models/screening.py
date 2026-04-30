"""
Patient pre-treatment medical screening (Refine — Dr. Meryem's 19-flag list).

One row per patient. Updated each time the doctor reviews the patient's
medical context. The 19 flags are deliberately fixed columns (not a
JSON blob) so we can:
  - index queries on individual contraindications
  - audit-trail the columns separately
  - constrain the UI to the canonical checklist

Reading A: doctor edits, everyone else reads.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class PatientScreening(Base, TimestampMixin, TenantMixin):
    """19 binary contraindication flags + per-patient note."""

    __tablename__ = "patient_screenings"
    __table_args__ = (
        Index("ix_patient_screenings_clinic_patient", "clinic_id", "patient_id", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    assessed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Flags 1–19 (NULL = unanswered, TRUE = flagged risk, FALSE = ruled out)
    pregnancy_or_breastfeeding: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    drug_allergies: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    blood_thinners: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    autoimmune_disease: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    uncontrolled_diabetes: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    active_cancer: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    local_skin_infection: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    active_herpes: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    bleeding_disorder: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    keloid_scarring: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    uncontrolled_hypertension: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    thyroid_disease: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    implants_or_devices: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    tattoo_or_pigment_in_zone: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    prior_injectables: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    recent_isotretinoin: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    recent_sun_exposure: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    herbal_supplements: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    body_dysmorphia_concern: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
