"""add CHECKOUT_PENDING to intakestatus enum

Revision ID: o1b7d0f6e8a3
Revises: n0a6c9e5d7f1
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op


revision: str = "o1b7d0f6e8a3"
down_revision: Union[str, None] = "n0a6c9e5d7f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE intakestatus ADD VALUE IF NOT EXISTS 'CHECKOUT_PENDING' BEFORE 'ACTIVE'"
    )


def downgrade() -> None:
    # Postgres can't drop a value from an enum.
    pass
