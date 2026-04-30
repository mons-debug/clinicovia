"""
Common aesthetic-clinic body-zone seed.

Idempotent — skips zones whose slug already exists for the clinic.
Names cover FR/AR/EN; clinics can add custom zones later.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.photo import BodyZone, ZoneCategory


SEED: list[dict] = [
    # Face — common Refine zones
    {"slug": "front", "name_fr": "Front", "name_ar": "الجبهة", "name_en": "Forehead", "category": ZoneCategory.FACE, "sort_order": 10},
    {"slug": "glabelle", "name_fr": "Glabelle", "name_ar": "بين الحاجبين", "name_en": "Glabella", "category": ZoneCategory.FACE, "sort_order": 20},
    {"slug": "tempes", "name_fr": "Tempes", "name_ar": "الصدغين", "name_en": "Temples", "category": ZoneCategory.FACE, "sort_order": 30},
    {"slug": "patte-d-oie", "name_fr": "Pattes d'oie", "name_ar": "تجاعيد العين", "name_en": "Crow's feet", "category": ZoneCategory.FACE, "sort_order": 40},
    {"slug": "joues", "name_fr": "Joues", "name_ar": "الخدين", "name_en": "Cheeks", "category": ZoneCategory.FACE, "sort_order": 50},
    {"slug": "pommettes", "name_fr": "Pommettes", "name_ar": "الوجنتان", "name_en": "Cheekbones", "category": ZoneCategory.FACE, "sort_order": 60},
    {"slug": "sillons-naso-geniens", "name_fr": "Sillons naso-géniens", "name_ar": "الخطوط الأنفية الشفوية", "name_en": "Nasolabial folds", "category": ZoneCategory.FACE, "sort_order": 70},
    {"slug": "levres", "name_fr": "Lèvres", "name_ar": "الشفاه", "name_en": "Lips", "category": ZoneCategory.FACE, "sort_order": 80},
    {"slug": "menton", "name_fr": "Menton", "name_ar": "الذقن", "name_en": "Chin", "category": ZoneCategory.FACE, "sort_order": 90},
    {"slug": "mandibule", "name_fr": "Mandibule", "name_ar": "الفك السفلي", "name_en": "Jawline", "category": ZoneCategory.FACE, "sort_order": 100},
    {"slug": "cou", "name_fr": "Cou", "name_ar": "العنق", "name_en": "Neck", "category": ZoneCategory.FACE, "sort_order": 110},
    {"slug": "decollete", "name_fr": "Décolleté", "name_ar": "أعلى الصدر", "name_en": "Décolleté", "category": ZoneCategory.FACE, "sort_order": 120},
    # Body
    {"slug": "aisselles", "name_fr": "Aisselles", "name_ar": "الإبطين", "name_en": "Underarms", "category": ZoneCategory.BODY, "sort_order": 200},
    {"slug": "abdomen", "name_fr": "Abdomen", "name_ar": "البطن", "name_en": "Abdomen", "category": ZoneCategory.BODY, "sort_order": 210},
    {"slug": "flancs", "name_fr": "Flancs", "name_ar": "الجوانب", "name_en": "Flanks", "category": ZoneCategory.BODY, "sort_order": 220},
    {"slug": "fesses", "name_fr": "Fessiers", "name_ar": "الأرداف", "name_en": "Buttocks", "category": ZoneCategory.BODY, "sort_order": 230},
    {"slug": "cuisses", "name_fr": "Cuisses", "name_ar": "الفخذين", "name_en": "Thighs", "category": ZoneCategory.BODY, "sort_order": 240},
    {"slug": "genoux", "name_fr": "Genoux", "name_ar": "الركبتين", "name_en": "Knees", "category": ZoneCategory.BODY, "sort_order": 250},
    {"slug": "dos", "name_fr": "Dos", "name_ar": "الظهر", "name_en": "Back", "category": ZoneCategory.BODY, "sort_order": 260},
    # Hair
    {"slug": "cuir-chevelu", "name_fr": "Cuir chevelu", "name_ar": "فروة الرأس", "name_en": "Scalp", "category": ZoneCategory.HAIR, "sort_order": 300},
    {"slug": "barbe", "name_fr": "Barbe", "name_ar": "اللحية", "name_en": "Beard", "category": ZoneCategory.HAIR, "sort_order": 310},
    {"slug": "sourcils", "name_fr": "Sourcils", "name_ar": "الحاجبين", "name_en": "Eyebrows", "category": ZoneCategory.HAIR, "sort_order": 320},
    # Extremities
    {"slug": "mains", "name_fr": "Mains", "name_ar": "اليدين", "name_en": "Hands", "category": ZoneCategory.EXTREMITIES, "sort_order": 400},
    {"slug": "pieds", "name_fr": "Pieds", "name_ar": "القدمين", "name_en": "Feet", "category": ZoneCategory.EXTREMITIES, "sort_order": 410},
    {"slug": "bras", "name_fr": "Bras", "name_ar": "الذراعين", "name_en": "Arms", "category": ZoneCategory.EXTREMITIES, "sort_order": 420},
    {"slug": "jambes", "name_fr": "Jambes", "name_ar": "الساقين", "name_en": "Legs", "category": ZoneCategory.EXTREMITIES, "sort_order": 430},
]


async def seed_zones_for_clinic(db: AsyncSession, clinic_id: uuid.UUID) -> int:
    inserted = 0
    for spec in SEED:
        existing = await db.execute(
            select(BodyZone).where(
                BodyZone.clinic_id == clinic_id,
                BodyZone.slug == spec["slug"],
            )
        )
        if existing.scalar_one_or_none() is None:
            db.add(BodyZone(clinic_id=clinic_id, **spec))
            inserted += 1
    await db.commit()
    return inserted
