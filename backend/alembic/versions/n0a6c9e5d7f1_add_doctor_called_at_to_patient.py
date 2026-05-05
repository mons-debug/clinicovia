"""add doctor_called_at to patient

Revision ID: n0a6c9e5d7f1
Revises: m9f5b8d4e6a2
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "n0a6c9e5d7f1"
down_revision: Union[str, None] = "m9f5b8d4e6a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "patients",
        sa.Column("doctor_called_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("patients", "doctor_called_at")
