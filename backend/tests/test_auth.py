"""Auth — register and login critical paths."""

import pytest
from sqlalchemy import select

from app.models.clinic import Clinic, ClinicMembership, Role
from app.models.user import User


@pytest.mark.integration
async def test_register_creates_user_clinic_and_owner_membership(client, db, unique_email):
    payload = {
        "first_name": "Test",
        "last_name": "Owner",
        "email": unique_email,
        "password": "TestPass123!",
        "clinic_name": f"Reg Test Clinic {unique_email[:8]}",
        "clinic_type": "beauty",
        "country": "Morocco",
        "city": "Casablanca",
    }

    r = await client.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 201, r.text

    body = r.json()
    assert body["user"]["email"] == payload["email"]
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]
    assert len(body["memberships"]) == 1
    assert body["memberships"][0]["role"] == "clinic_owner"

    # Persisted in DB
    user = (await db.execute(select(User).where(User.email == payload["email"]))).scalar_one()
    clinic = (await db.execute(select(Clinic).where(Clinic.name == payload["clinic_name"]))).scalar_one()
    membership = (
        await db.execute(
            select(ClinicMembership).where(
                ClinicMembership.user_id == user.id,
                ClinicMembership.clinic_id == clinic.id,
            )
        )
    ).scalar_one()
    assert membership.role == Role.CLINIC_OWNER


@pytest.mark.integration
async def test_login_with_correct_password_returns_session(client, make_user, unique_email):
    user, _ = await make_user(email=unique_email, password="LoginPass123!")

    r = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "LoginPass123!"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["tokens"]["access_token"]
    assert body["user"]["email"] == user.email


@pytest.mark.integration
async def test_login_with_wrong_password_rejected(client, make_user, unique_email):
    user, _ = await make_user(email=unique_email, password="Right123!")

    r = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "Wrong123!"},
    )
    assert r.status_code == 401, r.text
