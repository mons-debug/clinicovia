"""Idempotent seeder: Refine Beauty Clinic team accounts.

Creates three user accounts so Moncef can test each role's portal:
  - Sabrina (receptionist)         sabrina@refine.ma  / Refine2026!
  - Dr. Amr Ismail (plastic_surgery)   amr@refine.ma  / Refine2026!
  - Dr. Meryem El Boujadaini (aesthetic_medicine)
                                  meryem@refine.ma  / Refine2026!

All linked to clinic 0cc8d2ca-98c3-4414-a0c2-2ed23a51e756.
Re-running is safe — existing users are skipped.

Run inside the backend container:
    python -m scripts.seed_refine_team
"""

from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session as async_session_maker
from app.models.user import User
from app.models.clinic import ClinicMembership, Role
from app.utils.security import hash_password


REFINE_CLINIC_ID = uuid.UUID("0cc8d2ca-98c3-4414-a0c2-2ed23a51e756")
DEFAULT_PASSWORD = "Refine2026!"

TEAM = [
    {
        "email": "sabrina@refine.ma",
        "first_name": "Sabrina",
        "last_name": "Réception",
        "phone": "+212600000001",
        "specialty": None,
        "role": Role.RECEPTIONIST,
    },
    {
        "email": "amr@refine.ma",
        "first_name": "Amr",
        "last_name": "Ismail",
        "phone": "+212600000002",
        "specialty": "plastic_surgery",
        "role": Role.DOCTOR,
    },
    {
        "email": "meryem@refine.ma",
        "first_name": "Meryem",
        "last_name": "El Boujadaini",
        "phone": "+212600000003",
        "specialty": "aesthetic_medicine",
        "role": Role.DOCTOR,
    },
]


async def seed() -> None:
    added = 0
    skipped = 0
    async with async_session_maker() as session:  # type: AsyncSession
        for member in TEAM:
            # Skip if user already exists
            existing = await session.execute(
                select(User).where(User.email == member["email"])
            )
            user = existing.scalar_one_or_none()
            if user is None:
                user = User(
                    email=member["email"],
                    password_hash=hash_password(DEFAULT_PASSWORD),
                    first_name=member["first_name"],
                    last_name=member["last_name"],
                    phone=member["phone"],
                    specialty=member["specialty"],
                    is_active=True,
                    is_verified=True,
                )
                session.add(user)
                await session.flush()
                added += 1
                print(f"  + created {member['email']}")
            else:
                # Make sure specialty is set (we may have created the user
                # before W9.1 added the specialty column).
                if member["specialty"] and not user.specialty:
                    user.specialty = member["specialty"]
                skipped += 1
                print(f"  · {member['email']} already exists — checked specialty")

            # Skip if membership already exists
            mem_check = await session.execute(
                select(ClinicMembership).where(
                    ClinicMembership.user_id == user.id,
                    ClinicMembership.clinic_id == REFINE_CLINIC_ID,
                )
            )
            membership = mem_check.scalar_one_or_none()
            if membership is None:
                session.add(ClinicMembership(
                    user_id=user.id,
                    clinic_id=REFINE_CLINIC_ID,
                    role=member["role"],
                    is_active=True,
                ))
                print(f"      → linked to Refine as {member['role'].value}")
            elif membership.role != member["role"] or not membership.is_active:
                membership.role = member["role"]
                membership.is_active = True
                print(f"      → role updated to {member['role'].value}")

        await session.commit()

    print(f"\nSeeded {added} new users · {skipped} already existed")
    print("\nLogin credentials:")
    for m in TEAM:
        print(f"  {m['email']}  /  {DEFAULT_PASSWORD}    [{m['role'].value}]")


if __name__ == "__main__":
    asyncio.run(seed())
