"""
Shared pytest fixtures for Clinicovia.

Integration tests hit the real running backend (FastAPI on
localhost:8000 inside the Docker network). DB ops use a per-test engine
with NullPool so each test owns its connection lifecycle and we avoid
the "Future attached to a different event loop" trap that plagues async
SQLAlchemy + pytest-asyncio.

Tests use UUID-unique emails/phones/slugs so collisions are impossible.
Created rows are left in the dev DB; truncate manually if needed.
"""

from __future__ import annotations

import os
import uuid
from typing import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models.clinic import Clinic, ClinicMembership, Role
from app.models.user import User
from app.utils.security import hash_password, create_access_token


BACKEND_URL = os.environ.get("TEST_BACKEND_URL", "http://localhost:8000")


def _new_engine_and_factory():
    eng = create_async_engine(settings.database_url, poolclass=NullPool)
    return eng, async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)


# ---------- HTTP client over the live backend ---------------------------

@pytest_asyncio.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=15.0) as ac:
        yield ac


# ---------- DB session for direct verification --------------------------

@pytest_asyncio.fixture
async def db() -> AsyncIterator[AsyncSession]:
    eng, Factory = _new_engine_and_factory()
    async with Factory() as session:
        yield session
    await eng.dispose()


# ---------- User / clinic factories -------------------------------------

@pytest_asyncio.fixture
async def make_user():
    async def _make(
        email: str | None = None,
        password: str = "Test1234!",
        first_name: str = "Test",
        last_name: str = "User",
        clinic: Clinic | None = None,
        role: Role = Role.CLINIC_OWNER,
    ) -> tuple[User, Clinic]:
        suffix = uuid.uuid4().hex[:8]
        eng, Factory = _new_engine_and_factory()
        async with Factory() as session:
            user = User(
                email=email or f"u-{suffix}@example.com",
                password_hash=hash_password(password),
                first_name=first_name,
                last_name=last_name,
            )
            session.add(user)
            await session.flush()

            if clinic is None:
                clinic = Clinic(
                    name="Test Clinic",
                    slug=f"test-clinic-{suffix}",
                )
                session.add(clinic)
                await session.flush()
            else:
                clinic = await session.merge(clinic)

            membership = ClinicMembership(
                user_id=user.id,
                clinic_id=clinic.id,
                role=role,
            )
            session.add(membership)
            await session.commit()
            await session.refresh(user)
            await session.refresh(clinic)
            # Detach so the caller can use these models with a fresh session
            session.expunge_all()
        await eng.dispose()
        return user, clinic
    return _make


# ---------- Auth helpers ------------------------------------------------

@pytest.fixture
def auth_headers():
    """Build Authorization header for a given user_id + clinic_id."""
    def _make(user_id: uuid.UUID, clinic_id: uuid.UUID, role: str = "clinic_owner") -> dict[str, str]:
        token = create_access_token(user_id=user_id, clinic_id=clinic_id, role=role)
        return {"Authorization": f"Bearer {token}"}
    return _make


@pytest.fixture
def unique_email():
    return f"u-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture
def unique_phone():
    return f"+21266{uuid.uuid4().int % 1_000_000:06d}"
