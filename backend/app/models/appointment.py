import uuid
from enum import Enum as PyEnum
from datetime import date, time

from sqlalchemy import ForeignKey, String, Enum, Text, Date, Time, Boolean
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


class Appointment(Base, TimestampMixin, TenantMixin):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    appointment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(default=30)

    treatment: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus), default=AppointmentStatus.SCHEDULED
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_first_visit: Mapped[bool] = mapped_column(Boolean, default=False)

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
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
