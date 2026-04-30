"""Appointments — link to patient + doctor + tenant isolation on FKs."""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.models.appointment import Appointment


@pytest.mark.integration
async def test_create_appointment_links_patient_and_clinic(
    client, make_user, auth_headers, unique_phone, db
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    # First create a patient via API so we have a real patient_id in this clinic
    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Karima",
            "last_name": "Idrissi",
            "phone": unique_phone,
            "phone_country_code": "+212",
        },
    )
    assert r.status_code == 201
    patient_id = r.json()["id"]

    # Schedule an appointment
    tomorrow = date.today() + timedelta(days=1)
    r = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "patient_id": patient_id,
            "appointment_date": tomorrow.isoformat(),
            "start_time": "10:00:00",
            "end_time": "10:30:00",
            "duration_minutes": 30,
            "treatment": "Consultation",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["patient_id"] == patient_id
    assert body["treatment"] == "Consultation"

    # Verify clinic_id at the DB level (not exposed in response)
    appt = (
        await db.execute(select(Appointment).where(Appointment.id == uuid.UUID(body["id"])))
    ).scalar_one()
    assert appt.clinic_id == clinic.id
