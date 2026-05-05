"""add patient_consents table

Revision ID: p2c8e1f7a9b4
Revises: o1b7d0f6e8a3
Create Date: 2026-05-01
"""
from typing import Sequence, Union
from alembic import op

revision: str = "p2c8e1f7a9b4"
down_revision: Union[str, None] = "o1b7d0f6e8a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE consenttype AS ENUM ('general','treatment','photo','marketing','anesthesia');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE consentstatus AS ENUM ('pending','signed','declined','revoked');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS patient_consents (
            id UUID PRIMARY KEY,
            clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
            patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
            consent_type consenttype NOT NULL,
            title VARCHAR(255) NOT NULL,
            body_text TEXT,
            body_template JSONB,
            treatment_name VARCHAR(255),
            plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL,
            status consentstatus NOT NULL,
            signature_data TEXT,
            signed_at TIMESTAMPTZ,
            signed_ip VARCHAR(64),
            declined_at TIMESTAMPTZ,
            revoked_at TIMESTAMPTZ,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_patient_consents_clinic_patient
        ON patient_consents(clinic_id, patient_id);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS patient_consents")
    op.execute("DROP TYPE IF EXISTS consentstatus")
    op.execute("DROP TYPE IF EXISTS consenttype")
