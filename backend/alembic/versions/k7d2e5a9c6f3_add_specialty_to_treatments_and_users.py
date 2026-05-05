"""add specialty column to treatments and users

Revision ID: k7d2e5a9c6f3
Revises: j6c1d4f8e9b2
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k7d2e5a9c6f3"
down_revision: Union[str, None] = "j6c1d4f8e9b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "treatments",
        sa.Column("specialty", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("specialty", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "specialty")
    op.drop_column("treatments", "specialty")
