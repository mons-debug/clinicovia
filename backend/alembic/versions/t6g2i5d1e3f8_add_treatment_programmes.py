"""add treatment_programmes table + programme_id FK on plans

Revision ID: t6g2i5d1e3f8
Revises: s5f1h4c0d2e7
Create Date: 2026-05-02
"""
from typing import Sequence, Union
from alembic import op

revision: str = "t6g2i5d1e3f8"
down_revision: Union[str, None] = "s5f1h4c0d2e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS treatment_programmes (
            id UUID PRIMARY KEY,
            clinic_id UUID NOT NULL REFERENCES clinics(id),
            patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_treatment_programmes_clinic_patient ON treatment_programmes(clinic_id, patient_id)")
    op.execute("ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS programme_id UUID REFERENCES treatment_programmes(id) ON DELETE SET NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE treatment_plans DROP COLUMN IF EXISTS programme_id")
    op.execute("DROP TABLE IF EXISTS treatment_programmes")
