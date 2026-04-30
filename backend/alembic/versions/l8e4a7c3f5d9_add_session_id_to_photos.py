"""add session_id column to patient_photos

Revision ID: l8e4a7c3f5d9
Revises: k7d2e5a9c6f3
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "l8e4a7c3f5d9"
down_revision: Union[str, None] = "k7d2e5a9c6f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "patient_photos",
        sa.Column("session_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_patient_photos_session",
        "patient_photos",
        "treatment_sessions",
        ["session_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_patient_photos_session",
        "patient_photos",
        ["session_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_patient_photos_session", table_name="patient_photos")
    op.drop_constraint("fk_patient_photos_session", "patient_photos", type_="foreignkey")
    op.drop_column("patient_photos", "session_id")
