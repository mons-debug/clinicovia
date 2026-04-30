"""Patients — CRUD + tenant isolation critical paths."""

import uuid

import pytest
from sqlalchemy import select

from app.models.patient import Patient


@pytest.mark.integration
async def test_create_patient_scoped_to_clinic(client, make_user, auth_headers, unique_phone, db):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Fatima",
            "last_name": "Alaoui",
            "phone": unique_phone,
            "phone_country_code": "+212",
            "gender": "female",
            "city": "Casablanca",
            "country": "Morocco",
            "lead_source": "whatsapp",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["first_name"] == "Fatima"

    # Verify the DB row carries the right clinic_id (response model omits it)
    patient = (await db.execute(select(Patient).where(Patient.id == uuid.UUID(body["id"])))).scalar_one()
    assert patient.clinic_id == clinic.id


@pytest.mark.integration
async def test_list_patients_isolates_tenants(client, make_user, auth_headers, unique_phone):
    """User A creates a patient. User B (different clinic) must NOT see it."""
    user_a, clinic_a = await make_user()
    user_b, clinic_b = await make_user()
    headers_a = auth_headers(user_a.id, clinic_a.id)
    headers_b = auth_headers(user_b.id, clinic_b.id)

    # User A creates a patient
    r = await client.post(
        "/api/v1/patients",
        headers=headers_a,
        json={
            "first_name": "Yasmine",
            "last_name": "Bennani",
            "phone": unique_phone,
            "phone_country_code": "+212",
        },
    )
    assert r.status_code == 201
    patient_a_id = r.json()["id"]

    # User A sees their own patient
    r = await client.get("/api/v1/patients", headers=headers_a)
    assert r.status_code == 200
    a_ids = {p["id"] for p in r.json()["patients"]}
    assert patient_a_id in a_ids

    # User B (other clinic) does NOT see User A's patient
    r = await client.get("/api/v1/patients", headers=headers_b)
    assert r.status_code == 200
    b_ids = {p["id"] for p in r.json()["patients"]}
    assert patient_a_id not in b_ids
