"""add_consultations

Adds consultation SOAP notes from Refine OS:
  - consultations: per-patient with optional appointment + plan + session
    + doctor FKs, sequential CONS-YYYY-NNNN, status state machine
    (draft → signed → cancelled), SOAP fields (subjective/objective/
    assessment/plan_text), chief complaint
  - consultation_counters: per-clinic per-year counter

Revision ID: h4e7a2c9d8f1
Revises: g3d9f1c5e7b8
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "h4e7a2c9d8f1"
down_revision: Union[str, None] = "g3d9f1c5e7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


consultation_status = sa.Enum("DRAFT", "SIGNED", "CANCELLED", name="consultationstatus")


def upgrade() -> None:
    op.create_table(
        "consultations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("treatment_plans.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("treatment_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("number", sa.String(length=32), nullable=False),
        sa.Column("visit_date", sa.Date(), nullable=False),
        sa.Column("language", sa.String(length=8), nullable=False, server_default="fr"),
        sa.Column("subjective", sa.Text(), nullable=True),
        sa.Column("objective", sa.Text(), nullable=True),
        sa.Column("assessment", sa.Text(), nullable=True),
        sa.Column("plan_text", sa.Text(), nullable=True),
        sa.Column("chief_complaint", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", consultation_status, nullable=False, server_default="DRAFT"),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("clinic_id", "number", name="uq_consultations_clinic_number"),
    )
    op.create_index("ix_consultations_clinic_patient", "consultations", ["clinic_id", "patient_id"])
    op.create_index("ix_consultations_clinic_status", "consultations", ["clinic_id", "status"])

    op.create_table(
        "consultation_counters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("last_number", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("clinic_id", "year", name="uq_consultation_counters_clinic_year"),
    )


def downgrade() -> None:
    op.drop_table("consultation_counters")
    op.drop_index("ix_consultations_clinic_status", table_name="consultations")
    op.drop_index("ix_consultations_clinic_patient", table_name="consultations")
    op.drop_table("consultations")
    sa.Enum(name="consultationstatus").drop(op.get_bind(), checkfirst=True)
