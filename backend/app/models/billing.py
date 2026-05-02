"""
Billing — Invoice (facture) + Payment.

Sequential per-clinic per-year numbering: FAC-2026-0001, FAC-2026-0002…
TVA defaults to 0 because actes médicaux are exonérés in Morocco.

Status state machine:
  draft → issued → partial → paid          (happy path)
                  ↘ cancelled
                  ↘ refunded

Payments accumulate against an invoice; status flips to PARTIAL once
total_paid > 0 < total, and to PAID once total_paid >= total.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin


class InvoiceStatus(str, PyEnum):
    DRAFT = "draft"
    ISSUED = "issued"
    PARTIAL = "partial"
    PAID = "paid"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(str, PyEnum):
    CASH = "cash"
    CARD = "card"
    TRANSFER = "transfer"
    CHEQUE = "cheque"
    OTHER = "other"


class PaymentKind(str, PyEnum):
    PAYMENT = "payment"
    REFUND = "refund"


class Invoice(Base, TimestampMixin, TenantMixin):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("clinic_id", "number", name="uq_invoices_clinic_number"),
        Index("ix_invoices_clinic_patient", "clinic_id", "patient_id"),
        Index("ix_invoices_clinic_status", "clinic_id", "status"),
        Index("ix_invoices_clinic_date", "clinic_id", "issue_date"),
        Index("ix_invoices_session", "session_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_plans.id", ondelete="SET NULL"), nullable=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_sessions.id", ondelete="SET NULL"), nullable=True
    )
    issued_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    number: Mapped[str] = mapped_column(String(32), nullable=False)  # FAC-2026-0001
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Line items: [{ label, quantity, unit_price, total }]
    line_items: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tva_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # actes médicaux exonérés
    tva: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_paid: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="MAD", nullable=False)

    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False
    )
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    payments = relationship(
        "Payment",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="Payment.received_at.asc()",
    )


class Payment(Base, TimestampMixin, TenantMixin):
    __tablename__ = "invoice_payments"
    __table_args__ = (
        Index("ix_invoice_payments_invoice", "invoice_id"),
        Index("ix_invoice_payments_clinic_date", "clinic_id", "received_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    received_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    amount: Mapped[float] = mapped_column(Float, nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod), default=PaymentMethod.CASH, nullable=False
    )
    kind: Mapped[PaymentKind] = mapped_column(
        Enum(PaymentKind), default=PaymentKind.PAYMENT, nullable=False
    )
    reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    invoice = relationship("Invoice", back_populates="payments")


class InvoiceCounter(Base, TenantMixin):
    """Per-clinic per-year sequential invoice counter.

    Atomic increment via the existing async session — relies on a
    UNIQUE(clinic_id, year) constraint and SELECT ... FOR UPDATE on
    issuance to prevent gaps.
    """
    __tablename__ = "invoice_counters"
    __table_args__ = (
        UniqueConstraint("clinic_id", "year", name="uq_invoice_counters_clinic_year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    last_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
