"""add prep_sent_at to patients

Revision ID: s5f1h4c0d2e7
Revises: r4e0g3b9c1d6
Create Date: 2026-05-02
"""
from typing import Sequence, Union
from alembic import op

revision: str = "s5f1h4c0d2e7"
down_revision: Union[str, None] = "r4e0g3b9c1d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE patients ADD COLUMN IF NOT EXISTS prep_sent_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS prep_sent_at")
