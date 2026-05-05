"""
Common Maroc DCI seed for new clinics. Lightweight — covers post-op
analgesia, antibiotics, antihistamines, topicals, and the most common
beauty-clinic adjuncts (vitamin C, hyaluronic acid, etc.).

Idempotent: skip if a (clinic_id, dci, strength, form) row already
exists. Called once when a clinic is provisioned (or on demand from
the settings page).
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prescription import Drug, DrugForm


SEED: list[dict] = [
    # Antalgiques
    {"dci": "paracétamol", "brand": "Doliprane", "form": DrugForm.TABLET, "strength": "500 mg", "drug_class": "antalgique", "default_posology": "1 cp × 3/j", "default_duration": "3 j"},
    {"dci": "paracétamol", "brand": "Doliprane", "form": DrugForm.TABLET, "strength": "1000 mg", "drug_class": "antalgique", "default_posology": "1 cp × 3/j", "default_duration": "3 j"},
    {"dci": "ibuprofène", "brand": "Brufen", "form": DrugForm.TABLET, "strength": "400 mg", "drug_class": "AINS", "default_posology": "1 cp × 3/j au cours du repas", "default_duration": "3 j"},
    {"dci": "diclofénac", "brand": "Voltarène", "form": DrugForm.TABLET, "strength": "50 mg", "drug_class": "AINS", "default_posology": "1 cp × 2/j", "default_duration": "5 j"},
    {"dci": "tramadol", "brand": "Topalgic", "form": DrugForm.CAPSULE, "strength": "50 mg", "drug_class": "antalgique-palier-2", "default_posology": "1 cp × 3/j si besoin", "default_duration": "3 j"},

    # Antibiotiques
    {"dci": "amoxicilline", "brand": "Clamoxyl", "form": DrugForm.CAPSULE, "strength": "500 mg", "drug_class": "antibiotique-bêta-lactamine", "default_posology": "1 gel × 3/j", "default_duration": "7 j"},
    {"dci": "amoxicilline + acide clavulanique", "brand": "Augmentin", "form": DrugForm.TABLET, "strength": "1 g", "drug_class": "antibiotique-bêta-lactamine", "default_posology": "1 cp × 2/j", "default_duration": "7 j"},
    {"dci": "azithromycine", "brand": "Zithromax", "form": DrugForm.TABLET, "strength": "500 mg", "drug_class": "antibiotique-macrolide", "default_posology": "1 cp/j", "default_duration": "3 j"},
    {"dci": "ciprofloxacine", "brand": "Ciflox", "form": DrugForm.TABLET, "strength": "500 mg", "drug_class": "antibiotique-fluoroquinolone", "default_posology": "1 cp × 2/j", "default_duration": "5 j"},
    {"dci": "métronidazole", "brand": "Flagyl", "form": DrugForm.TABLET, "strength": "500 mg", "drug_class": "antibiotique-imidazolé", "default_posology": "1 cp × 3/j", "default_duration": "7 j"},

    # Antihistaminiques
    {"dci": "cétirizine", "brand": "Zyrtec", "form": DrugForm.TABLET, "strength": "10 mg", "drug_class": "antihistaminique", "default_posology": "1 cp/j le soir", "default_duration": "5 j"},
    {"dci": "loratadine", "brand": "Clarityne", "form": DrugForm.TABLET, "strength": "10 mg", "drug_class": "antihistaminique", "default_posology": "1 cp/j", "default_duration": "5 j"},
    {"dci": "desloratadine", "brand": "Aerius", "form": DrugForm.TABLET, "strength": "5 mg", "drug_class": "antihistaminique", "default_posology": "1 cp/j", "default_duration": "5 j"},

    # Corticoïdes
    {"dci": "prednisone", "brand": "Cortancyl", "form": DrugForm.TABLET, "strength": "20 mg", "drug_class": "corticoïde", "default_posology": "1 cp/j le matin", "default_duration": "3 j"},
    {"dci": "méthylprednisolone", "brand": "Medrol", "form": DrugForm.TABLET, "strength": "16 mg", "drug_class": "corticoïde", "default_posology": "1 cp/j", "default_duration": "5 j"},

    # Anti-acide / IPP
    {"dci": "oméprazole", "brand": "Mopral", "form": DrugForm.CAPSULE, "strength": "20 mg", "drug_class": "IPP", "default_posology": "1 gel/j à jeun", "default_duration": "10 j"},
    {"dci": "pantoprazole", "brand": "Inipomp", "form": DrugForm.TABLET, "strength": "40 mg", "drug_class": "IPP", "default_posology": "1 cp/j à jeun", "default_duration": "10 j"},

    # Antiviraux / topiques
    {"dci": "aciclovir", "brand": "Zovirax", "form": DrugForm.CREAM, "strength": "5%", "drug_class": "antiviral-topique", "default_posology": "5 applications/j", "default_duration": "5 j"},
    {"dci": "aciclovir", "brand": "Zovirax", "form": DrugForm.TABLET, "strength": "400 mg", "drug_class": "antiviral", "default_posology": "1 cp × 5/j", "default_duration": "5 j"},

    # Anti-cicatriciels / topiques esthétiques
    {"dci": "héparine + flavonoïdes", "brand": "Auriderm", "form": DrugForm.CREAM, "strength": "—", "drug_class": "anti-ecchymose", "default_posology": "Application 3×/j sur la zone", "default_duration": "5 j"},
    {"dci": "centella asiatica + acide hyaluronique", "brand": "Cicalfate+", "form": DrugForm.CREAM, "strength": "—", "drug_class": "cicatrisant", "default_posology": "Application 2×/j", "default_duration": "10 j"},
    {"dci": "vitamine K", "brand": "Auriderm K5", "form": DrugForm.CREAM, "strength": "—", "drug_class": "anti-ecchymose", "default_posology": "Application 2×/j", "default_duration": "5 j"},
    {"dci": "acide hyaluronique", "brand": "Hyalu Bioderma", "form": DrugForm.CREAM, "strength": "—", "drug_class": "hydratant", "default_posology": "Application 2×/j", "default_duration": "30 j"},
    {"dci": "vitamine C", "brand": "Skinceuticals C E Ferulic", "form": DrugForm.DROPS, "strength": "15%", "drug_class": "antioxydant-topique", "default_posology": "4-5 gouttes le matin", "default_duration": "30 j"},

    # Solaires
    {"dci": "écran solaire SPF 50+", "brand": "Anthelios", "form": DrugForm.CREAM, "strength": "SPF 50+", "drug_class": "photoprotection", "default_posology": "Renouveler toutes les 2 h", "default_duration": "—"},

    # Anesthésiques topiques
    {"dci": "lidocaïne + prilocaïne", "brand": "Emla", "form": DrugForm.CREAM, "strength": "5%", "drug_class": "anesthésique-topique", "default_posology": "Application 1 h avant procédure", "default_duration": "Acte"},

    # Antifongiques
    {"dci": "kétoconazole", "brand": "Ketoderm", "form": DrugForm.CREAM, "strength": "2%", "drug_class": "antifongique-topique", "default_posology": "1-2 applications/j", "default_duration": "14 j"},

    # Anti-acnéique
    {"dci": "trétinoïne", "brand": "Retacnyl", "form": DrugForm.CREAM, "strength": "0.05%", "drug_class": "rétinoïde-topique", "default_posology": "Application le soir", "default_duration": "30 j"},
    {"dci": "isotrétinoïne", "brand": "Roaccutane", "form": DrugForm.CAPSULE, "strength": "20 mg", "drug_class": "rétinoïde-systémique", "default_posology": "À ajuster au poids", "default_duration": "—"},
]


async def seed_drugs_for_clinic(db: AsyncSession, clinic_id: uuid.UUID) -> int:
    """Insert any missing seed drugs for the clinic. Returns inserted count."""
    inserted = 0
    for spec in SEED:
        existing = await db.execute(
            select(Drug).where(
                Drug.clinic_id == clinic_id,
                Drug.dci == spec["dci"],
                Drug.strength == spec.get("strength"),
                Drug.form == spec["form"],
            )
        )
        if existing.scalar_one_or_none() is None:
            db.add(Drug(clinic_id=clinic_id, **spec))
            inserted += 1
    await db.commit()
    return inserted
