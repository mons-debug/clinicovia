"""extend_appointment_calendar_fields

Adds Refine OS calendar extensions to Appointment:
  - kind enum (consultation/session/control/other)
  - room varchar — physical room assignment
  - arrived_at / started_at / ended_at — actual journey timestamps
  - composite indexes for the day view (clinic+date+doctor and
    clinic+date+status)

Revision ID: c8a3e1d4f5b2
Revises: a7e19424b385
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8a3e1d4f5b2"
down_revision: Union[str, None] = "a7e19424b385"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


appointment_kind = sa.Enum(
    "CONSULTATION", "SESSION", "CONTROL", "OTHER",
    name="appointmentkind",
)


def upgrade() -> None:
    bind = op.get_bind()
    appointment_kind.create(bind, checkfirst=True)

    op.add_column(
        "appointments",
        sa.Column("kind", appointment_kind, nullable=False, server_default="CONSULTATION"),
    )
    op.add_column("appointments", sa.Column("room", sa.String(length=64), nullable=True))
    op.add_column("appointments", sa.Column("arrived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("appointments", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("appointments", sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index(
        "ix_appointments_clinic_date_doctor",
        "appointments",
        ["clinic_id", "appointment_date", "doctor_id"],
        unique=False,
    )
    op.create_index(
        "ix_appointments_clinic_date_status",
        "appointments",
        ["clinic_id", "appointment_date", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_appointments_clinic_date_status", table_name="appointments")
    op.drop_index("ix_appointments_clinic_date_doctor", table_name="appointments")
    for col in ("ended_at", "started_at", "arrived_at", "room", "kind"):
        op.drop_column("appointments", col)
    appointment_kind.drop(op.get_bind(), checkfirst=True)
