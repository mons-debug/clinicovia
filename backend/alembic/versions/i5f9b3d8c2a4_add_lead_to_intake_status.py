"""add LEAD value to intakestatus enum

Postgres allows ALTER TYPE … ADD VALUE since 9.1; the new value goes
to the start of the order list because it represents the earliest
lifecycle stage. WhatsApp / form inbounds become LEAD instead of
INTAKE_PENDING so they stay out of the queue board until they
physically arrive.

Revision ID: i5f9b3d8c2a4
Revises: h4e7a2c9d8f1
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op


revision: str = "i5f9b3d8c2a4"
down_revision: Union[str, None] = "h4e7a2c9d8f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE cannot run inside a transaction block in older Postgres,
    # but Alembic's transactional DDL handles this for 9.1+.
    op.execute("ALTER TYPE intakestatus ADD VALUE IF NOT EXISTS 'LEAD' BEFORE 'INTAKE_PENDING'")


def downgrade() -> None:
    # Postgres doesn't support DROP VALUE on enums. The LEAD value must
    # be left in place; if you really need to remove it, do a CREATE
    # TYPE … AS ENUM (...) + ALTER TABLE … TYPE ... USING ... dance.
    pass
