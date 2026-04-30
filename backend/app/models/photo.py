"""
Patient photos + anatomical body zones.

Storage: local filesystem under app/uploads/<clinic_id>/<patient_id>/<uuid>.<ext>
during dev. Production swaps to S3 by changing the storage backend in
services/photo_storage.py without touching this module.

A photo is always (patient × zone × stage × angle): one consult-room
session can produce 5 angles per zone × multiple zones × multiple
stages over time. The gallery groups by zone then stage to enable
true before/after comparisons.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
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


class ZoneCategory(str, PyEnum):
    FACE = "face"
    BODY = "body"
    HAIR = "hair"
    EXTREMITIES = "extremities"


class PhotoStage(str, PyEnum):
    BEFORE = "before"
    DURING = "during"
    AFTER = "after"
    FOLLOW_UP = "follow_up"
    CONTROL = "control"


class PhotoAngle(str, PyEnum):
    FRONT = "front"
    LEFT_45 = "left_45"
    RIGHT_45 = "right_45"
    LEFT_PROFILE = "left_profile"
    RIGHT_PROFILE = "right_profile"
    BACK = "back"
    DETAIL = "detail"
    OTHER = "other"


class PhotoConsentScope(str, PyEnum):
    MEDICAL = "medical"           # internal clinical use only
    BEFORE_AFTER = "before_after"  # patient agreed to before/after gallery
    MARKETING = "marketing"        # patient agreed to social/website use


class BodyZone(Base, TimestampMixin, TenantMixin):
    """Per-clinic anatomical zone catalog."""
    __tablename__ = "body_zones"
    __table_args__ = (
        UniqueConstraint("clinic_id", "slug", name="uq_body_zones_clinic_slug"),
        Index("ix_body_zones_clinic_category", "clinic_id", "category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    name_fr: Mapped[str] = mapped_column(String(128), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(128), nullable=True)
    name_en: Mapped[str | None] = mapped_column(String(128), nullable=True)
    category: Mapped[ZoneCategory] = mapped_column(Enum(ZoneCategory), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PatientPhoto(Base, TimestampMixin, TenantMixin):
    __tablename__ = "patient_photos"
    __table_args__ = (
        Index("ix_patient_photos_clinic_patient", "clinic_id", "patient_id"),
        Index("ix_patient_photos_patient_zone_stage", "patient_id", "zone_slug", "stage"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_plans.id", ondelete="SET NULL"), nullable=True
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    # Direct session link — disambiguates when a photo belongs to a
    # specific séance even before the appointment is booked. Falls back
    # to appointment_id for older rows.
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_sessions.id", ondelete="SET NULL"), nullable=True
    )
    captured_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Where it lives
    storage: Mapped[str] = mapped_column(String(16), default="local", nullable=False)  # local | s3 | r2
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(64), default="image/jpeg")
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # What it shows
    zone_slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    stage: Mapped[PhotoStage] = mapped_column(Enum(PhotoStage), default=PhotoStage.BEFORE, nullable=False)
    angle: Mapped[PhotoAngle | None] = mapped_column(Enum(PhotoAngle), nullable=True)
    consent_scope: Mapped[PhotoConsentScope] = mapped_column(
        Enum(PhotoConsentScope), default=PhotoConsentScope.MEDICAL, nullable=False
    )

    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
