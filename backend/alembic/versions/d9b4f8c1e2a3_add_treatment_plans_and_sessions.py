"""add_treatment_plans_and_sessions

Adds the multi-séance treatment system from Refine OS:
  - treatment_plans: per-patient plan grouping N sessions at a fixed
    interval (e.g. Botox course of 4 séances every 4 weeks). Status
    machine: draft / active / completed / cancelled. Versioned.
  - treatment_sessions: individual visits within a plan. Status
    machine: planned / scheduled / in_progress / completed / skipped.
    Optional FK back to appointments so the calendar slot ↔ session
    link is preserved.

Revision ID: d9b4f8c1e2a3
Revises: c8a3e1d4f5b2
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d9b4f8c1e2a3"
down_revision: Union[str, None] = "c8a3e1d4f5b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Each enum is created exactly once — first column referencing it
# triggers the CREATE TYPE; subsequent references use create_type=False.
interval_unit = sa.Enum("DAYS", "WEEKS", "MONTHS", name="intervalunit")
plan_status = sa.Enum("DRAFT", "ACTIVE", "COMPLETED", "CANCELLED", name="planstatus")
session_status = sa.Enum(
    "PLANNED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "SKIPPED",
    name="sessionstatus",
)


def upgrade() -> None:
    op.create_table(
        "treatment_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("primary_service", sa.String(length=128), nullable=True),
        sa.Column("indication_slugs", postgresql.JSONB, nullable=True),
        sa.Column("zone_slugs", postgresql.JSONB, nullable=True),
        sa.Column("total_sessions", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("interval_value", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("interval_unit", interval_unit, nullable=False, server_default="WEEKS"),
        sa.Column("estimated_total", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="MAD"),
        sa.Column("status", plan_status, nullable=False, server_default="ACTIVE"),
        sa.Column("version", sa.String(length=16), nullable=False, server_default="v1"),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_reason", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index(
        "ix_treatment_plans_clinic_patient",
        "treatment_plans",
        ["clinic_id", "patient_id"],
    )
    op.create_index(
        "ix_treatment_plans_clinic_status",
        "treatment_plans",
        ["clinic_id", "status"],
    )

    op.create_table(
        "treatment_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("treatment_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_number", sa.Integer(), nullable=False),
        sa.Column("planned_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", session_status, nullable=False, server_default="PLANNED"),
        sa.Column("products_used", postgresql.JSONB, nullable=True),
        sa.Column("outcome_score", sa.Integer(), nullable=True),
        sa.Column("outcome_note", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("skipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index(
        "ix_treatment_sessions_plan",
        "treatment_sessions",
        ["plan_id"],
    )
    op.create_index(
        "ix_treatment_sessions_clinic_status",
        "treatment_sessions",
        ["clinic_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_treatment_sessions_clinic_status", table_name="treatment_sessions")
    op.drop_index("ix_treatment_sessions_plan", table_name="treatment_sessions")
    op.drop_table("treatment_sessions")

    op.drop_index("ix_treatment_plans_clinic_status", table_name="treatment_plans")
    op.drop_index("ix_treatment_plans_clinic_patient", table_name="treatment_plans")
    op.drop_table("treatment_plans")

    bind = op.get_bind()
    sa.Enum(name="sessionstatus").drop(bind, checkfirst=True)
    sa.Enum(name="planstatus").drop(bind, checkfirst=True)
    sa.Enum(name="intervalunit").drop(bind, checkfirst=True)
