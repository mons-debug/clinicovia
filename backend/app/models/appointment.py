import uuid
from enum import Enum as PyEnum
from datetime import date, time, datetime

from sqlalchemy import ForeignKey, String, Enum, Text, Date, Time, DateTime, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, TenantMixin


class AppointmentStatus(str, PyEnum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class AppointmentKind(str, PyEnum):
    """Type of visit — drives default duration, billing rules, and
    visual treatment on the calendar."""
    CONSULTATION = "consultation"   # first visit / new-indication evaluation
    SESSION = "session"             # treatment session inside a plan
    CONTROL = "control"             # follow-up / check-in
    WALK_IN = "walk_in"             # same-day arrival without prior booking
    OTHER = "other"


class Appointment(Base, TimestampMixin, TenantMixin):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointments_clinic_date_doctor", "clinic_id", "appointment_date", "doctor_id"),
        Index("ix_appointments_clinic_date_status", "clinic_id", "appointment_date", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    doctor_service_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doctor_services.id", ondelete="SET NULL"), nullable=True
    )

    appointment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(default=30)

    treatment: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[AppointmentKind] = mapped_column(
        Enum(AppointmentKind), default=AppointmentKind.CONSULTATION, nullable=False
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus), default=AppointmentStatus.SCHEDULED
    )
    room: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_first_visit: Mapped[bool] = mapped_column(Boolean, default=False)

    # Actual journey timestamps (vs scheduled time)
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Tentative bookings — reception hasn't called the patient back to
    # lock the time. Surfaces in the "À-confirmer" panel.
    needs_confirmation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Reminders
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmation_sent: Mapped[bool] = mapped_column(Boolean, default=False)


class Treatment(Base, TimestampMixin, TenantMixin):
    __tablename__ = "treatments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(default=30)
    price: Mapped[float] = mapped_column(default=0.0)
    currency: Mapped[str] = mapped_column(String(10), default="MAD")
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Specialty gate — only doctors with this specialty can perform this
    # treatment. Free-form (NULL = any doctor). Refine values:
    # "aesthetic_medicine" | "plastic_surgery".
    specialty: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
