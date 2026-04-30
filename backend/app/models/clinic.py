import uuid
from enum import Enum as PyEnum

from sqlalchemy import ForeignKey, String, Enum, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class SubscriptionPlan(str, PyEnum):
    TRIAL = "trial"
    GROWTH = "growth"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class ClinicStatus(str, PyEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    CHURNED = "churned"


class Role(str, PyEnum):
    SUPER_ADMIN = "super_admin"
    CLINIC_OWNER = "clinic_owner"
    MANAGER = "manager"
    RECEPTIONIST = "receptionist"
    SALES_AGENT = "sales_agent"
    MARKETING_MANAGER = "marketing_manager"
    DOCTOR = "doctor"


class Clinic(Base, TimestampMixin):
    __tablename__ = "clinics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    clinic_type: Mapped[str] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="Africa/Casablanca")
    currency: Mapped[str] = mapped_column(String(10), default="MAD")
    language: Mapped[str] = mapped_column(String(10), default="fr")

    # Moroccan legal IDs (printed on factures + ordonnances)
    ice: Mapped[str | None] = mapped_column(String(32), nullable=True)  # Identifiant Commun de l'Entreprise
    if_number: Mapped[str | None] = mapped_column(String(32), nullable=True)  # Identifiant Fiscal
    rc_number: Mapped[str | None] = mapped_column(String(32), nullable=True)  # Registre du Commerce
    cnss: Mapped[str | None] = mapped_column(String(32), nullable=True)  # Caisse Nationale de Sécurité Sociale

    # Subscription
    plan: Mapped[SubscriptionPlan] = mapped_column(
        Enum(SubscriptionPlan), default=SubscriptionPlan.TRIAL
    )
    status: Mapped[ClinicStatus] = mapped_column(
        Enum(ClinicStatus), default=ClinicStatus.TRIAL
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Branding
    primary_color: Mapped[str] = mapped_column(String(20), default="#0D4F6C")
    accent_color: Mapped[str] = mapped_column(String(20), default="#3EC8A0")

    # Relationships
    members = relationship("ClinicMembership", back_populates="clinic", cascade="all, delete-orphan")


class ClinicMembership(Base, TimestampMixin):
    """Junction table: User <-> Clinic with role."""
    __tablename__ = "clinic_memberships"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    user = relationship("User", back_populates="memberships")
    clinic = relationship("Clinic", back_populates="members")
