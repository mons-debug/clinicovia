"""Idempotent seeder: Refine Beauty Clinic 14-service catalog.

Run inside the backend container:
    python -m scripts.seed_refine_treatments <clinic-id>

Inserts any missing service rows (matched by name + clinic_id) and
skips ones that already exist. Safe to re-run.
"""

from __future__ import annotations

import asyncio
import sys
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session as async_session_maker
from app.models.appointment import Treatment


# ── The catalog ──────────────────────────────────────────────────────
# Source: clients/refine/profile.md (Moncef's brain).
# Tone: clinic-facing names in French. Prices left at 0 (Refine quotes
# per-patient). Categories used for grouping in the picker.

REFINE_SERVICES: list[dict] = [
    # Aesthetic medicine (Dr. Meryem)
    {"name": "Botox", "duration_minutes": 30, "category": "Médecine esthétique",
     "specialty": "aesthetic_medicine",
     "description": "Injection de toxine botulique — rides du front, pattes d'oie, lion."},
    {"name": "Acide hyaluronique (Fillers)", "duration_minutes": 45, "category": "Médecine esthétique",
     "specialty": "aesthetic_medicine",
     "description": "Comblement des sillons, lèvres, cernes, pommettes."},
    {"name": "Thread Lift (fils tenseurs)", "duration_minutes": 60, "category": "Médecine esthétique",
     "specialty": "aesthetic_medicine",
     "description": "Lifting non-chirurgical par fils tenseurs résorbables."},
    {"name": "PRP (plasma riche en plaquettes)", "duration_minutes": 45, "category": "Médecine esthétique",
     "specialty": "aesthetic_medicine",
     "description": "Auto-régénération cutanée — visage, cheveux, cicatrices."},
    {"name": "Épilation laser", "duration_minutes": 30, "category": "Laser",
     "specialty": "aesthetic_medicine",
     "description": "Épilation définitive — toutes zones."},
    {"name": "Soin du visage", "duration_minutes": 60, "category": "Soins",
     "specialty": "aesthetic_medicine",
     "description": "Hydrafacial / nettoyage profond / hydratation."},
    {"name": "Peeling", "duration_minutes": 45, "category": "Soins",
     "specialty": "aesthetic_medicine",
     "description": "Exfoliation chimique pour le renouvellement cellulaire."},
    {"name": "Mésothérapie", "duration_minutes": 45, "category": "Médecine esthétique",
     "specialty": "aesthetic_medicine",
     "description": "Micro-injections de vitamines / acide hyaluronique."},
    {"name": "Cellulite (Cryolipolyse / Radiofréquence)", "duration_minutes": 60, "category": "Soins du corps",
     "specialty": "aesthetic_medicine",
     "description": "Traitement non-invasif de la cellulite et amas graisseux."},
    {"name": "Soin du corps", "duration_minutes": 60, "category": "Soins du corps",
     "specialty": "aesthetic_medicine",
     "description": "Drainage, modelage, raffermissement."},

    # Plastic surgery (Dr. Amr) — durations are pre-op consultation, actual surgery scheduled separately
    {"name": "Liposuccion", "duration_minutes": 30, "category": "Chirurgie esthétique",
     "specialty": "plastic_surgery",
     "description": "Consultation chirurgicale — aspiration des amas graisseux."},
    {"name": "Abdominoplastie", "duration_minutes": 30, "category": "Chirurgie esthétique",
     "specialty": "plastic_surgery",
     "description": "Consultation — chirurgie réparatrice du ventre."},
    {"name": "Rhinoplastie", "duration_minutes": 30, "category": "Chirurgie esthétique",
     "specialty": "plastic_surgery",
     "description": "Consultation — chirurgie du nez."},
    {"name": "Mammoplastie", "duration_minutes": 30, "category": "Chirurgie esthétique",
     "specialty": "plastic_surgery",
     "description": "Consultation — augmentation, réduction ou lift mammaire."},
]


async def seed(clinic_id: uuid.UUID) -> int:
    """Insert any missing services for `clinic_id`. Returns number added."""
    added = 0
    async with async_session_maker() as session:  # type: AsyncSession
        # Pull existing names so we can dedup
        existing = await session.execute(
            select(Treatment.name).where(Treatment.clinic_id == clinic_id)
        )
        existing_names = {row[0] for row in existing.all()}

        for svc in REFINE_SERVICES:
            if svc["name"] in existing_names:
                continue
            session.add(Treatment(
                clinic_id=clinic_id,
                name=svc["name"],
                description=svc.get("description"),
                duration_minutes=svc["duration_minutes"],
                price=0.0,
                currency="MAD",
                category=svc.get("category"),
                specialty=svc.get("specialty"),
                is_active=True,
            ))
            added += 1
        await session.commit()
    return added


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.seed_refine_treatments <clinic-uuid>")
        sys.exit(1)
    try:
        clinic_id = uuid.UUID(sys.argv[1])
    except ValueError:
        print("Invalid UUID")
        sys.exit(1)
    added = asyncio.run(seed(clinic_id))
    print(f"Seeded {added} services for clinic {clinic_id}")


if __name__ == "__main__":
    main()
