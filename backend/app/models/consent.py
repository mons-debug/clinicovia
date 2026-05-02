"""
Patient consent forms — legal requirement before any aesthetic procedure.

Each consent ties to a patient + optionally a treatment/plan. The form
content is stored as a JSON template, the patient's signature as a
base64 data-URI (captured via canvas on the frontend).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class ConsentType(str, PyEnum):
    GENERAL = "general"           # general clinic consent
    TREATMENT = "treatment"       # specific procedure consent
    PHOTO = "photo"               # consent for clinical photography
    MARKETING = "marketing"       # consent for marketing use of photos
    ANESTHESIA = "anesthesia"     # local anesthesia consent


class ConsentStatus(str, PyEnum):
    PENDING = "pending"
    SIGNED = "signed"
    DECLINED = "declined"
    REVOKED = "revoked"


class PatientConsent(Base, TimestampMixin, TenantMixin):
    __tablename__ = "patient_consents"
    __table_args__ = (
        Index("ix_patient_consents_clinic_patient", "clinic_id", "patient_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    consent_type: Mapped[ConsentType] = mapped_column(
        Enum(ConsentType, values_callable=lambda e: [x.value for x in e]),
        default=ConsentType.TREATMENT, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # The consent body — rendered to the patient before signing.
    # Can be a static text block or a structured JSON template.
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_template: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Treatment context
    treatment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_plans.id", ondelete="SET NULL"), nullable=True
    )

    status: Mapped[ConsentStatus] = mapped_column(
        Enum(ConsentStatus, values_callable=lambda e: [x.value for x in e]),
        default=ConsentStatus.PENDING, nullable=False
    )

    # Signature — base64 data URI from a canvas capture on the frontend
    signature_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)

    declined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
