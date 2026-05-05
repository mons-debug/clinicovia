"""add_invoices_and_payments

Adds the Maroc-conforme billing tables:
  - clinics.ice / if_number / rc_number / cnss (legal IDs printed on
    invoices and prescriptions)
  - invoices: sequential FAC-YYYY-NNNN per clinic per year, status
    state machine (draft / issued / partial / paid / cancelled /
    refunded), JSONB line items, TVA fields (default 0% — actes
    médicaux exonérés)
  - invoice_payments: many-to-one against invoices, supports
    payment + refund kinds, multiple methods (cash/card/transfer/
    cheque/other)
  - invoice_counters: per-clinic per-year sequential counter table
    used to issue gap-free numbers

Revision ID: e1a5b9d3c4f8
Revises: d9b4f8c1e2a3
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e1a5b9d3c4f8"
down_revision: Union[str, None] = "d9b4f8c1e2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


invoice_status = sa.Enum(
    "DRAFT", "ISSUED", "PARTIAL", "PAID", "CANCELLED", "REFUNDED",
    name="invoicestatus",
)
payment_method = sa.Enum(
    "CASH", "CARD", "TRANSFER", "CHEQUE", "OTHER",
    name="paymentmethod",
)
payment_kind = sa.Enum("PAYMENT", "REFUND", name="paymentkind")


def upgrade() -> None:
    # 1. Clinic legal IDs
    op.add_column("clinics", sa.Column("ice", sa.String(length=32), nullable=True))
    op.add_column("clinics", sa.Column("if_number", sa.String(length=32), nullable=True))
    op.add_column("clinics", sa.Column("rc_number", sa.String(length=32), nullable=True))
    op.add_column("clinics", sa.Column("cnss", sa.String(length=32), nullable=True))

    # 2. Invoices
    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("treatment_plans.id", ondelete="SET NULL"), nullable=True),
        sa.Column("issued_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("number", sa.String(length=32), nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("line_items", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("subtotal", sa.Float(), nullable=False, server_default="0"),
        sa.Column("discount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("tva_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("tva", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_paid", sa.Float(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="MAD"),
        sa.Column("status", invoice_status, nullable=False, server_default="DRAFT"),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("clinic_id", "number", name="uq_invoices_clinic_number"),
    )
    op.create_index("ix_invoices_clinic_patient", "invoices", ["clinic_id", "patient_id"])
    op.create_index("ix_invoices_clinic_status", "invoices", ["clinic_id", "status"])
    op.create_index("ix_invoices_clinic_date", "invoices", ["clinic_id", "issue_date"])

    # 3. Payments
    op.create_table(
        "invoice_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("received_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("method", payment_method, nullable=False, server_default="CASH"),
        sa.Column("kind", payment_kind, nullable=False, server_default="PAYMENT"),
        sa.Column("reference", sa.String(length=128), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_invoice_payments_invoice", "invoice_payments", ["invoice_id"])
    op.create_index("ix_invoice_payments_clinic_date", "invoice_payments", ["clinic_id", "received_at"])

    # 4. Counter table for sequential numbering
    op.create_table(
        "invoice_counters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("last_number", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("clinic_id", "year", name="uq_invoice_counters_clinic_year"),
    )


def downgrade() -> None:
    op.drop_table("invoice_counters")
    op.drop_index("ix_invoice_payments_clinic_date", table_name="invoice_payments")
    op.drop_index("ix_invoice_payments_invoice", table_name="invoice_payments")
    op.drop_table("invoice_payments")
    op.drop_index("ix_invoices_clinic_date", table_name="invoices")
    op.drop_index("ix_invoices_clinic_status", table_name="invoices")
    op.drop_index("ix_invoices_clinic_patient", table_name="invoices")
    op.drop_table("invoices")

    for col in ("cnss", "rc_number", "if_number", "ice"):
        op.drop_column("clinics", col)

    bind = op.get_bind()
    sa.Enum(name="paymentkind").drop(bind, checkfirst=True)
    sa.Enum(name="paymentmethod").drop(bind, checkfirst=True)
    sa.Enum(name="invoicestatus").drop(bind, checkfirst=True)
