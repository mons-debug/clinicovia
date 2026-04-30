"""add_prescriptions_and_drugs

Adds the ordonnances system from Refine OS:
  - drugs: per-clinic prescribable catalog (DCI, brand, form, strength,
    drug_class for allergy cross-check, default posology + duration)
  - prescriptions: linked to patient + optional plan/appointment/doctor,
    JSONB drug lines, sequential ORD-YYYY-NNNN numbering, status state
    machine (draft → signed → cancelled), renewable flag
  - prescription_counters: per-clinic per-year sequential counter

Revision ID: f2c7e9b1d3a4
Revises: e1a5b9d3c4f8
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f2c7e9b1d3a4"
down_revision: Union[str, None] = "e1a5b9d3c4f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


prescription_status = sa.Enum(
    "DRAFT", "SIGNED", "CANCELLED",
    name="prescriptionstatus",
)
drug_form = sa.Enum(
    "TABLET", "CAPSULE", "SYRUP", "INJECTION", "CREAM",
    "OINTMENT", "DROPS", "SPRAY", "OTHER",
    name="drugform",
)


def upgrade() -> None:
    # drugs catalog
    op.create_table(
        "drugs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dci", sa.String(length=128), nullable=False),
        sa.Column("brand", sa.String(length=128), nullable=True),
        sa.Column("form", drug_form, nullable=False),
        sa.Column("strength", sa.String(length=64), nullable=True),
        sa.Column("drug_class", sa.String(length=64), nullable=True),
        sa.Column("default_posology", sa.String(length=255), nullable=True),
        sa.Column("default_duration", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("clinic_id", "dci", "strength", "form", name="uq_drugs_clinic_key"),
    )
    op.create_index("ix_drugs_clinic_dci", "drugs", ["clinic_id", "dci"])
    op.create_index("ix_drugs_clinic_class", "drugs", ["clinic_id", "drug_class"])

    # prescriptions
    op.create_table(
        "prescriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("treatment_plans.id", ondelete="SET NULL"), nullable=True),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("number", sa.String(length=32), nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("language", sa.String(length=8), nullable=False, server_default="fr"),
        sa.Column("lines", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("diagnosis", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("renewable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("status", prescription_status, nullable=False, server_default="DRAFT"),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("clinic_id", "number", name="uq_prescriptions_clinic_number"),
    )
    op.create_index("ix_prescriptions_clinic_patient", "prescriptions", ["clinic_id", "patient_id"])
    op.create_index("ix_prescriptions_clinic_status", "prescriptions", ["clinic_id", "status"])

    # counter
    op.create_table(
        "prescription_counters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("last_number", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("clinic_id", "year", name="uq_prescription_counters_clinic_year"),
    )


def downgrade() -> None:
    op.drop_table("prescription_counters")
    op.drop_index("ix_prescriptions_clinic_status", table_name="prescriptions")
    op.drop_index("ix_prescriptions_clinic_patient", table_name="prescriptions")
    op.drop_table("prescriptions")
    op.drop_index("ix_drugs_clinic_class", table_name="drugs")
    op.drop_index("ix_drugs_clinic_dci", table_name="drugs")
    op.drop_table("drugs")

    bind = op.get_bind()
    sa.Enum(name="drugform").drop(bind, checkfirst=True)
    sa.Enum(name="prescriptionstatus").drop(bind, checkfirst=True)
