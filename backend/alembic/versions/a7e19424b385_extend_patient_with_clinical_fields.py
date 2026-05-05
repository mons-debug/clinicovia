"""extend_patient_with_clinical_fields

Adds the Refine OS clinical extensions onto Clinicovia's Patient model:
  - CNIE (Moroccan national ID)
  - language_pref + channel_pref (per-patient comms preferences)
  - fitzpatrick / weight_kg / height_cm / bmi / smoker (clinical metadata)
  - source_campaign / source_medium / first_touch_at (extended attribution)
  - intake_status state machine + intake_at + requested_service
    (drives the reception <-> doctor salle d'attente workflow)
  - archived_at (soft-delete companion to is_active)
  - new indexes for queue board (clinic_id, intake_status) and ID lookup

Revision ID: a7e19424b385
Revises: f4b8c0d2e5f7
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7e19424b385"
down_revision: Union[str, None] = "f4b8c0d2e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Postgres enum types created here, used by columns below
channel_pref = sa.Enum("WHATSAPP", "PHONE", "EMAIL", "SMS", name="channelpref")
intake_status = sa.Enum(
    "INTAKE_PENDING", "AWAITING_DOCTOR", "IN_ROOM", "ACTIVE", "ARCHIVED",
    name="intakestatus",
)
fitzpatrick_type = sa.Enum("I", "II", "III", "IV", "V", "VI", name="fitzpatricktype")


def upgrade() -> None:
    bind = op.get_bind()
    channel_pref.create(bind, checkfirst=True)
    intake_status.create(bind, checkfirst=True)
    fitzpatrick_type.create(bind, checkfirst=True)

    # Identity
    op.add_column("patients", sa.Column("cnie", sa.String(length=32), nullable=True))

    # Preferences (NOT NULL with safe defaults so existing rows fill in)
    op.add_column(
        "patients",
        sa.Column("language_pref", sa.String(length=8), nullable=False, server_default="fr"),
    )
    op.add_column(
        "patients",
        sa.Column("channel_pref", channel_pref, nullable=False, server_default="WHATSAPP"),
    )

    # Clinical metadata
    op.add_column("patients", sa.Column("fitzpatrick", fitzpatrick_type, nullable=True))
    op.add_column("patients", sa.Column("weight_kg", sa.Float(), nullable=True))
    op.add_column("patients", sa.Column("height_cm", sa.Float(), nullable=True))
    op.add_column("patients", sa.Column("bmi", sa.Float(), nullable=True))
    op.add_column("patients", sa.Column("smoker", sa.Boolean(), nullable=True))

    # Extended marketing attribution
    op.add_column("patients", sa.Column("source_campaign", sa.String(length=128), nullable=True))
    op.add_column("patients", sa.Column("source_medium", sa.String(length=64), nullable=True))
    op.add_column("patients", sa.Column("first_touch_at", sa.DateTime(timezone=True), nullable=True))

    # Reception <-> Doctor workflow
    op.add_column(
        "patients",
        sa.Column("intake_status", intake_status, nullable=False, server_default="ACTIVE"),
    )
    op.add_column("patients", sa.Column("intake_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("patients", sa.Column("requested_service", sa.String(length=256), nullable=True))

    # Lifecycle
    op.add_column("patients", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))

    # Indexes for the queue board + CNIE lookup
    op.create_index(
        "ix_patients_clinic_cnie", "patients", ["clinic_id", "cnie"], unique=False
    )
    op.create_index(
        "ix_patients_clinic_intake_status",
        "patients",
        ["clinic_id", "intake_status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_patients_clinic_intake_status", table_name="patients")
    op.drop_index("ix_patients_clinic_cnie", table_name="patients")

    for col in (
        "archived_at",
        "requested_service",
        "intake_at",
        "intake_status",
        "first_touch_at",
        "source_medium",
        "source_campaign",
        "smoker",
        "bmi",
        "height_cm",
        "weight_kg",
        "fitzpatrick",
        "channel_pref",
        "language_pref",
        "cnie",
    ):
        op.drop_column("patients", col)

    bind = op.get_bind()
    fitzpatrick_type.drop(bind, checkfirst=True)
    intake_status.drop(bind, checkfirst=True)
    channel_pref.drop(bind, checkfirst=True)
