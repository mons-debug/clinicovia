"""add patient_screenings table (19-flag medical screening)

Revision ID: m9f5b8d4e6a2
Revises: l8e4a7c3f5d9
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "m9f5b8d4e6a2"
down_revision: Union[str, None] = "l8e4a7c3f5d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FLAG_COLUMNS = [
    "pregnancy_or_breastfeeding",
    "drug_allergies",
    "blood_thinners",
    "autoimmune_disease",
    "uncontrolled_diabetes",
    "active_cancer",
    "local_skin_infection",
    "active_herpes",
    "bleeding_disorder",
    "keloid_scarring",
    "uncontrolled_hypertension",
    "thyroid_disease",
    "implants_or_devices",
    "tattoo_or_pigment_in_zone",
    "prior_injectables",
    "recent_isotretinoin",
    "recent_sun_exposure",
    "herbal_supplements",
    "body_dysmorphia_concern",
]


def upgrade() -> None:
    op.create_table(
        "patient_screenings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("clinic_id", sa.UUID(), nullable=False),
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("assessed_by", sa.UUID(), nullable=True),
        sa.Column("assessed_at", sa.DateTime(timezone=True), nullable=True),
        *[sa.Column(c, sa.Boolean(), nullable=True) for c in FLAG_COLUMNS],
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assessed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_patient_screenings_clinic_patient",
        "patient_screenings",
        ["clinic_id", "patient_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_patient_screenings_clinic_patient", table_name="patient_screenings")
    op.drop_table("patient_screenings")
