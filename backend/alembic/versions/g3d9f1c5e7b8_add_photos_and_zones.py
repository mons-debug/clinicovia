"""add_photos_and_zones

Adds the body-zone catalog + per-patient photo gallery from Refine OS.

Revision ID: g3d9f1c5e7b8
Revises: f2c7e9b1d3a4
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "g3d9f1c5e7b8"
down_revision: Union[str, None] = "f2c7e9b1d3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


zone_category = sa.Enum("FACE", "BODY", "HAIR", "EXTREMITIES", name="zonecategory")
photo_stage = sa.Enum(
    "BEFORE", "DURING", "AFTER", "FOLLOW_UP", "CONTROL",
    name="photostage",
)
photo_angle = sa.Enum(
    "FRONT", "LEFT_45", "RIGHT_45", "LEFT_PROFILE", "RIGHT_PROFILE",
    "BACK", "DETAIL", "OTHER",
    name="photoangle",
)
photo_consent = sa.Enum(
    "MEDICAL", "BEFORE_AFTER", "MARKETING",
    name="photoconsentscope",
)


def upgrade() -> None:
    # body_zones catalog
    op.create_table(
        "body_zones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name_fr", sa.String(length=128), nullable=False),
        sa.Column("name_ar", sa.String(length=128), nullable=True),
        sa.Column("name_en", sa.String(length=128), nullable=True),
        sa.Column("category", zone_category, nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("clinic_id", "slug", name="uq_body_zones_clinic_slug"),
    )
    op.create_index("ix_body_zones_clinic_category", "body_zones", ["clinic_id", "category"])

    # patient_photos
    op.create_table(
        "patient_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("treatment_plans.id", ondelete="SET NULL"), nullable=True),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("captured_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("storage", sa.String(length=16), nullable=False, server_default="local"),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("content_type", sa.String(length=64), nullable=False, server_default="image/jpeg"),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("zone_slug", sa.String(length=64), nullable=False),
        sa.Column("stage", photo_stage, nullable=False, server_default="BEFORE"),
        sa.Column("angle", photo_angle, nullable=True),
        sa.Column("consent_scope", photo_consent, nullable=False, server_default="MEDICAL"),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_patient_photos_clinic_patient", "patient_photos", ["clinic_id", "patient_id"])
    op.create_index("ix_patient_photos_zone_slug", "patient_photos", ["zone_slug"])
    op.create_index(
        "ix_patient_photos_patient_zone_stage",
        "patient_photos",
        ["patient_id", "zone_slug", "stage"],
    )


def downgrade() -> None:
    op.drop_index("ix_patient_photos_patient_zone_stage", table_name="patient_photos")
    op.drop_index("ix_patient_photos_zone_slug", table_name="patient_photos")
    op.drop_index("ix_patient_photos_clinic_patient", table_name="patient_photos")
    op.drop_table("patient_photos")
    op.drop_index("ix_body_zones_clinic_category", table_name="body_zones")
    op.drop_table("body_zones")
    bind = op.get_bind()
    sa.Enum(name="photoconsentscope").drop(bind, checkfirst=True)
    sa.Enum(name="photoangle").drop(bind, checkfirst=True)
    sa.Enum(name="photostage").drop(bind, checkfirst=True)
    sa.Enum(name="zonecategory").drop(bind, checkfirst=True)
