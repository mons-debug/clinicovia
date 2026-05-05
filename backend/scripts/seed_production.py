"""Production seeder: Refine Beauty Clinic + full team.

Creates:
  - Refine Beauty Clinic (Tanger)
  - Moncef (super_admin + clinic_owner)    moncef@refine.ma / Refine2026!
  - Dr. Amr Ismail (doctor)                amr@refine.ma / Refine2026!
  - Dr. Meryem El Boujadaini (doctor)      meryem@refine.ma / Refine2026!
  - Sabrina (receptionist)                 sabrina@refine.ma / Refine2026!

Also seeds the 14-service treatment catalog.

Idempotent — safe to re-run.

    python -m scripts.seed_production
"""

from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session as async_session_maker
from app.models.user import User
from app.models.clinic import Clinic, ClinicMembership, Role
from app.utils.security import hash_password


DEFAULT_PASSWORD = "Refine2026!"


async def get_or_create_clinic(session: AsyncSession) -> Clinic:
    result = await session.execute(
        select(Clinic).where(Clinic.slug == "refine-beauty-clinic")
    )
    clinic = result.scalar_one_or_none()
    if clinic:
        print(f"  · Clinic already exists: {clinic.name} ({clinic.id})")
        return clinic

    clinic = Clinic(
        name="Refine Beauty Clinic",
        slug="refine-beauty-clinic",
        clinic_type="Aesthetic/Cosmetic",
        description="Clinique de médecine esthétique et chirurgie plastique",
        phone="+212539000000",
        email="contact@refine.ma",
        website="https://refineclinic.ma",
        city="Tanger",
        country="Morocco",
        timezone="Africa/Casablanca",
        currency="MAD",
        language="fr",
        primary_color="#0D4F6C",
        accent_color="#C9A96E",
    )
    session.add(clinic)
    await session.flush()
    print(f"  + Created clinic: {clinic.name} ({clinic.id})")
    return clinic


async def get_or_create_user(
    session: AsyncSession,
    email: str,
    first_name: str,
    last_name: str,
    phone: str | None = None,
    specialty: str | None = None,
    is_super_admin: bool = False,
) -> User:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        if specialty and not user.specialty:
            user.specialty = specialty
        if is_super_admin and not user.is_super_admin:
            user.is_super_admin = True
        print(f"  · User exists: {email}")
        return user

    user = User(
        email=email,
        password_hash=hash_password(DEFAULT_PASSWORD),
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        specialty=specialty,
        is_active=True,
        is_verified=True,
        is_super_admin=is_super_admin,
    )
    session.add(user)
    await session.flush()
    print(f"  + Created user: {first_name} {last_name} <{email}>")
    return user


async def ensure_membership(
    session: AsyncSession, user: User, clinic: Clinic, role: Role
) -> None:
    result = await session.execute(
        select(ClinicMembership).where(
            ClinicMembership.user_id == user.id,
            ClinicMembership.clinic_id == clinic.id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership:
        if membership.role != role:
            membership.role = role
            print(f"      → Updated role to {role.value}")
        return

    session.add(ClinicMembership(
        user_id=user.id,
        clinic_id=clinic.id,
        role=role,
        is_active=True,
    ))
    print(f"      → Linked as {role.value}")


async def seed_treatments(session: AsyncSession, clinic_id: uuid.UUID) -> int:
    from app.models.appointment import Treatment

    services = [
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

    added = 0
    for svc in services:
        exists = await session.execute(
            select(Treatment).where(
                Treatment.name == svc["name"],
                Treatment.clinic_id == clinic_id,
            )
        )
        if exists.scalar_one_or_none():
            continue
        session.add(Treatment(
            clinic_id=clinic_id,
            name=svc["name"],
            duration_minutes=svc["duration_minutes"],
            category=svc.get("category"),
            description=svc.get("description"),
            price=0,
            is_active=True,
        ))
        added += 1
    return added


DOCTOR_SERVICES = [
    {"name": "Botox", "duration_minutes": 30, "category": "Médecine esthétique",
     "specialty": "aesthetic_medicine", "default_price": 0,
     "description": "Injection de toxine botulique — rides du front, pattes d'oie, lion.",
     "consent_template": "Je soussigné(e), autorise le Dr. à effectuer des injections de toxine botulique. "
     "J'ai été informé(e) des risques possibles (ecchymoses, asymétrie temporaire, ptôse) "
     "et des alternatives. J'ai eu l'occasion de poser toutes mes questions."},
    {"name": "Acide hyaluronique (Fillers)", "duration_minutes": 45, "category": "Médecine esthétique",
     "specialty": "aesthetic_medicine", "default_price": 0,
     "description": "Comblement des sillons, lèvres, cernes, pommettes.",
     "consent_template": "Je soussigné(e), autorise le Dr. à effectuer des injections d'acide hyaluronique. "
     "J'ai été informé(e) des risques possibles (œdème, ecchymoses, nodules) "
     "et des alternatives. J'ai eu l'occasion de poser toutes mes questions."},
    {"name": "Thread Lift (fils tenseurs)", "duration_minutes": 60, "category": "Médecine esthétique",
     "specialty": "aesthetic_medicine", "default_price": 0,
     "description": "Lifting non-chirurgical par fils tenseurs résorbables."},
    {"name": "PRP (plasma riche en plaquettes)", "duration_minutes": 45, "category": "Médecine esthétique",
     "specialty": "aesthetic_medicine", "default_price": 0,
     "description": "Auto-régénération cutanée — visage, cheveux, cicatrices."},
    {"name": "Épilation laser", "duration_minutes": 30, "category": "Laser",
     "specialty": "aesthetic_medicine", "default_price": 0,
     "description": "Épilation définitive — toutes zones."},
    {"name": "Soin du visage", "duration_minutes": 60, "category": "Soins",
     "specialty": "aesthetic_medicine", "default_price": 0,
     "description": "Hydrafacial / nettoyage profond / hydratation."},
    {"name": "Peeling", "duration_minutes": 45, "category": "Soins",
     "specialty": "aesthetic_medicine", "default_price": 0,
     "description": "Exfoliation chimique pour le renouvellement cellulaire."},
    {"name": "Mésothérapie", "duration_minutes": 45, "category": "Médecine esthétique",
     "specialty": "aesthetic_medicine", "default_price": 0,
     "description": "Micro-injections de vitamines / acide hyaluronique."},
    {"name": "Cellulite (Cryolipolyse / Radiofréquence)", "duration_minutes": 60, "category": "Soins du corps",
     "specialty": "aesthetic_medicine", "default_price": 0,
     "description": "Traitement non-invasif de la cellulite et amas graisseux."},
    {"name": "Soin du corps", "duration_minutes": 60, "category": "Soins du corps",
     "specialty": "aesthetic_medicine", "default_price": 0,
     "description": "Drainage, modelage, raffermissement."},
    {"name": "Liposuccion", "duration_minutes": 30, "category": "Chirurgie esthétique",
     "specialty": "plastic_surgery", "default_price": 0,
     "description": "Consultation chirurgicale — aspiration des amas graisseux."},
    {"name": "Abdominoplastie", "duration_minutes": 30, "category": "Chirurgie esthétique",
     "specialty": "plastic_surgery", "default_price": 0,
     "description": "Consultation — chirurgie réparatrice du ventre."},
    {"name": "Rhinoplastie", "duration_minutes": 30, "category": "Chirurgie esthétique",
     "specialty": "plastic_surgery", "default_price": 0,
     "description": "Consultation — chirurgie du nez.",
     "consent_template": "Je soussigné(e), autorise le Dr. à effectuer un acte de rhinoplastie. "
     "J'ai été informé(e) des risques chirurgicaux (anesthésie, cicatrisation, résultat variable) "
     "et des alternatives. J'ai eu l'occasion de poser toutes mes questions."},
    {"name": "Mammoplastie", "duration_minutes": 30, "category": "Chirurgie esthétique",
     "specialty": "plastic_surgery", "default_price": 0,
     "description": "Consultation — augmentation, réduction ou lift mammaire."},
]


async def seed_doctor_services(
    session: AsyncSession, clinic_id: uuid.UUID, doctors: dict[str, User]
) -> int:
    from app.models.doctor_service import DoctorService

    added = 0
    for i, svc in enumerate(DOCTOR_SERVICES):
        doctor = doctors.get(svc["specialty"])
        if not doctor:
            continue

        exists = await session.execute(
            select(DoctorService).where(
                DoctorService.clinic_id == clinic_id,
                DoctorService.doctor_id == doctor.id,
                DoctorService.name == svc["name"],
            )
        )
        if exists.scalar_one_or_none():
            continue

        session.add(DoctorService(
            clinic_id=clinic_id,
            doctor_id=doctor.id,
            name=svc["name"],
            category=svc.get("category"),
            description=svc.get("description"),
            duration_minutes=svc["duration_minutes"],
            default_price=svc.get("default_price", 0),
            consent_template=svc.get("consent_template"),
            is_active=True,
            sort_order=i,
        ))
        added += 1
    return added


async def main():
    print("\n=== Seeding Refine Beauty Clinic (Production) ===\n")

    async with async_session_maker() as session:
        # 1. Clinic
        clinic = await get_or_create_clinic(session)

        # 2. Moncef — super admin + clinic owner
        moncef = await get_or_create_user(
            session,
            email="moncef@refine.ma",
            first_name="Moncef",
            last_name="Bennassar",
            phone="+212600000000",
            is_super_admin=True,
        )
        await ensure_membership(session, moncef, clinic, Role.CLINIC_OWNER)

        # 3. Dr. Amr — plastic surgery
        amr = await get_or_create_user(
            session,
            email="amr@refine.ma",
            first_name="Amr",
            last_name="Ismail",
            phone="+212600000002",
            specialty="plastic_surgery",
        )
        await ensure_membership(session, amr, clinic, Role.DOCTOR)

        # 4. Dr. Meryem — aesthetic medicine
        meryem = await get_or_create_user(
            session,
            email="meryem@refine.ma",
            first_name="Meryem",
            last_name="El Boujadaini",
            phone="+212600000003",
            specialty="aesthetic_medicine",
        )
        await ensure_membership(session, meryem, clinic, Role.DOCTOR)

        # 5. Sabrina — receptionist
        sabrina = await get_or_create_user(
            session,
            email="sabrina@refine.ma",
            first_name="Sabrina",
            last_name="Réception",
            phone="+212600000001",
        )
        await ensure_membership(session, sabrina, clinic, Role.RECEPTIONIST)

        # 6. Legacy treatments (kept for backward compat)
        added = await seed_treatments(session, clinic.id)
        print(f"\n  Treatments (legacy): {added} added")

        # 7. Doctor services (new — doctor-owned)
        doctors_map = {
            "aesthetic_medicine": meryem,
            "plastic_surgery": amr,
        }
        ds_added = await seed_doctor_services(session, clinic.id, doctors_map)
        print(f"  Doctor services: {ds_added} added")

        await session.commit()

    print("\n=== Done ===")
    print(f"\nLogin credentials (all use password: {DEFAULT_PASSWORD}):")
    print(f"  moncef@refine.ma   — super_admin + clinic_owner")
    print(f"  amr@refine.ma      — doctor (plastic_surgery)")
    print(f"  meryem@refine.ma   — doctor (aesthetic_medicine)")
    print(f"  sabrina@refine.ma  — receptionist")


if __name__ == "__main__":
    asyncio.run(main())
