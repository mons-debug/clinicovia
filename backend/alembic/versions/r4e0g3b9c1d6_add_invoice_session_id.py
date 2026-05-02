"""add session_id to invoices

Revision ID: r4e0g3b9c1d6
Revises: q3d9f2a8b0c5
Create Date: 2026-05-02
"""
from typing import Sequence, Union
from alembic import op

revision: str = "r4e0g3b9c1d6"
down_revision: Union[str, None] = "q3d9f2a8b0c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS session_id UUID "
        "REFERENCES treatment_sessions(id) ON DELETE SET NULL"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_invoices_session ON invoices(session_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_invoices_session")
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS session_id")
