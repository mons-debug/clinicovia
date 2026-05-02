"""add session_price to treatment_sessions

Revision ID: q3d9f2a8b0c5
Revises: p2c8e1f7a9b4
Create Date: 2026-05-01
"""
from typing import Sequence, Union
from alembic import op

revision: str = "q3d9f2a8b0c5"
down_revision: Union[str, None] = "p2c8e1f7a9b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE treatment_sessions ADD COLUMN IF NOT EXISTS session_price FLOAT")


def downgrade() -> None:
    op.execute("ALTER TABLE treatment_sessions DROP COLUMN IF EXISTS session_price")
