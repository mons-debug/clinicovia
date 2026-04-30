import uuid
from enum import Enum as PyEnum
from datetime import date, datetime

from sqlalchemy import ForeignKey, String, Enum, Boolean, Text, Date, DateTime, Integer, Float, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, TenantMixin


class PatientStatus(str, PyEnum):
    NEW = "new"
    ACTIVE = "active"
    INACTIVE = "inactive"
    VIP = "vip"
    BLOCKED = "blocked"


class Gender(str, PyEnum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class LeadSource(str, PyEnum):
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    GOOGLE_ADS = "google_ads"
    TIKTOK = "tiktok"
    SNAPCHAT = "snapchat"
    WEBSITE = "website"
    REFERRAL = "referral"
    WALK_IN = "walk_in"
    PHONE = "phone"
    OTHER = "other"


class ChannelPref(str, PyEnum):
    """Preferred contact channel — drives outreach routing."""
    WHATSAPP = "whatsapp"
    PHONE = "phone"
    EMAIL = "email"
    SMS = "sms"


class IntakeStatus(str, PyEnum):
    """Patient lifecycle.

    LEAD is the marketing-funnel state: an inbound (WhatsApp / website
    form) that hasn't physically arrived yet. Leads are excluded from
    the queue board + calendar — they live only in the patients
    "Leads" tab and the WhatsApp inbox until they walk in or book.

    The four "in-clinic" states drive the salle d'attente flow.
    ACTIVE = registered patient currently outside the clinic.
    """
    LEAD = "lead"                        # WA / form lead, no visit yet
    INTAKE_PENDING = "intake_pending"   # reception filled the short form, patient waiting
    AWAITING_DOCTOR = "awaiting_doctor"  # queued for doctor review
    IN_ROOM = "in_room"                  # doctor called the patient in
    ACTIVE = "active"                    # dossier complete, normal patient
    ARCHIVED = "archived"


class FitzpatrickType(str, PyEnum):
    """Skin phototype I–VI (clinical baseline for laser/peeling decisions)."""
    I = "I"
    II = "II"
    III = "III"
    IV = "IV"
    V = "V"
    VI = "VI"


class Patient(Base, TimestampMixin, TenantMixin):
    __tablename__ = "patients"
    __table_args__ = (
        UniqueConstraint("clinic_id", "phone", name="uq_patients_clinic_phone"),
        Index("ix_patients_clinic_active_status", "clinic_id", "is_active", "status"),
        Index("ix_patients_clinic_active_created", "clinic_id", "is_active", "created_at"),
        Index("ix_patients_clinic_intake_status", "clinic_id", "intake_status"),
        Index("ix_patients_clinic_cnie", "clinic_id", "cnie"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ----- Identity -----------------------------------------------------
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    phone_country_code: Mapped[str] = mapped_column(String(10), default="+212")
    gender: Mapped[Gender | None] = mapped_column(Enum(Gender), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    cnie: Mapped[str | None] = mapped_column(String(32), nullable=True)  # Carte Nationale Identité Électronique
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ----- Address ------------------------------------------------------
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ----- Preferences --------------------------------------------------
    language_pref: Mapped[str] = mapped_column(String(8), default="fr", nullable=False)
    channel_pref: Mapped[ChannelPref] = mapped_column(
        Enum(ChannelPref), default=ChannelPref.WHATSAPP, nullable=False
    )

    # ----- Clinical metadata --------------------------------------------
    fitzpatrick: Mapped[FitzpatrickType | None] = mapped_column(Enum(FitzpatrickType), nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    bmi: Mapped[float | None] = mapped_column(Float, nullable=True)  # computed at write time
    smoker: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # ----- Lead / Marketing attribution ---------------------------------
    status: Mapped[PatientStatus] = mapped_column(Enum(PatientStatus), default=PatientStatus.NEW)
    lead_source: Mapped[LeadSource | None] = mapped_column(Enum(LeadSource), nullable=True)
    lead_score: Mapped[int] = mapped_column(Integer, default=0)
    treatment_interests: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array stored as text
    source_campaign: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_medium: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_touch_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ----- Reception ↔ Doctor workflow ---------------------------------
    intake_status: Mapped[IntakeStatus] = mapped_column(
        Enum(IntakeStatus), default=IntakeStatus.ACTIVE, nullable=False
    )
    intake_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Doctor → reception ping. Set when doctor clicks "Appeler" on a
    # patient in AWAITING_DOCTOR. Reception's queue board pulses green
    # + chimes. Cleared automatically when state advances to IN_ROOM.
    doctor_called_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requested_service: Mapped[str | None] = mapped_column(String(256), nullable=True)

    # ----- Assignment ---------------------------------------------------
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # ----- Financial ----------------------------------------------------
    total_spent: Mapped[float] = mapped_column(Float, default=0.0)
    lifetime_value: Mapped[float] = mapped_column(Float, default=0.0)

    # ----- WhatsApp -----------------------------------------------------
    whatsapp_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    last_contacted_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ----- Notes --------------------------------------------------------
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ----- AI orchestration ---------------------------------------------
    ai_opt_out: Mapped[bool] = mapped_column(Boolean, default=False)
    last_ai_contact_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ai_message_count_today: Mapped[int] = mapped_column(Integer, default=0)

    # ----- Lifecycle ----------------------------------------------------
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    notes = relationship("PatientNote", back_populates="patient", cascade="all, delete-orphan")
    activities = relationship("PatientActivity", back_populates="patient", cascade="all, delete-orphan")
    tags = relationship("PatientTag", back_populates="patient", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class PatientNote(Base, TimestampMixin, TenantMixin):
    __tablename__ = "patient_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)

    patient = relationship("Patient", back_populates="notes")


class PatientActivity(Base, TimestampMixin, TenantMixin):
    __tablename__ = "patient_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "status_changed", "note_added"
    description: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON for extra context

    patient = relationship("Patient", back_populates="activities")


class PatientTag(Base, TimestampMixin, TenantMixin):
    __tablename__ = "patient_tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    tag: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#6B7280")

    patient = relationship("Patient", back_populates="tags")
