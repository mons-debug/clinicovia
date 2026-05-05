"""Calendar — day view + journey events."""

from datetime import date, timedelta

import pytest


@pytest.mark.integration
async def test_day_returns_appointments_grouped_by_doctor(
    client, make_user, auth_headers, unique_phone
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    # Create patient + appointment for tomorrow
    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Imane",
            "last_name": "Tazi",
            "phone": unique_phone,
            "phone_country_code": "+212",
        },
    )
    assert r.status_code == 201
    pid = r.json()["id"]

    tomorrow = date.today() + timedelta(days=1)
    r = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "patient_id": pid,
            "appointment_date": tomorrow.isoformat(),
            "start_time": "10:00:00",
            "end_time": "10:30:00",
            "duration_minutes": 30,
            "treatment": "Consultation",
        },
    )
    assert r.status_code == 201

    # Day view should include the appointment under "unassigned" (no doctor assigned)
    r = await client.get(
        "/api/v1/calendar/day",
        headers=headers,
        params={"date": tomorrow.isoformat()},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["date"] == tomorrow.isoformat()
    assert body["counts"]["scheduled"] >= 1
    # Either the doctor bucket or the unassigned list contains it
    all_appts = body["unassigned"] + [a for d in body["doctors"] for a in d["appointments"]]
    assert any(a["patient_name"] == "Imane Tazi" for a in all_appts)


@pytest.mark.integration
async def test_journey_event_marks_arrived_and_status(
    client, make_user, auth_headers, unique_phone
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Youssef",
            "last_name": "El Amrani",
            "phone": unique_phone,
            "phone_country_code": "+212",
        },
    )
    pid = r.json()["id"]

    tomorrow = date.today() + timedelta(days=1)
    r = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "patient_id": pid,
            "appointment_date": tomorrow.isoformat(),
            "start_time": "11:00:00",
            "end_time": "11:30:00",
            "duration_minutes": 30,
            "treatment": "Consultation",
        },
    )
    assert r.status_code == 201
    appt_id = r.json()["id"]

    # Mark arrived
    r = await client.post(
        f"/api/v1/calendar/{appt_id}/event",
        headers=headers,
        json={"event": "arrived"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "checked_in"

    # Mark started -> in_progress
    r = await client.post(
        f"/api/v1/calendar/{appt_id}/event",
        headers=headers,
        json={"event": "started"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"

    # Mark ended -> completed
    r = await client.post(
        f"/api/v1/calendar/{appt_id}/event",
        headers=headers,
        json={"event": "ended"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "completed"


@pytest.mark.integration
async def test_day_isolates_tenants(client, make_user, auth_headers, unique_phone):
    user_a, clinic_a = await make_user()
    user_b, clinic_b = await make_user()
    headers_a = auth_headers(user_a.id, clinic_a.id)
    headers_b = auth_headers(user_b.id, clinic_b.id)

    # User A creates patient + appointment
    r = await client.post(
        "/api/v1/patients",
        headers=headers_a,
        json={
            "first_name": "Loubna",
            "last_name": "Hamzaoui",
            "phone": unique_phone,
            "phone_country_code": "+212",
        },
    )
    pid = r.json()["id"]
    tomorrow = date.today() + timedelta(days=1)
    await client.post(
        "/api/v1/appointments",
        headers=headers_a,
        json={
            "patient_id": pid,
            "appointment_date": tomorrow.isoformat(),
            "start_time": "09:00:00",
            "end_time": "09:30:00",
            "duration_minutes": 30,
            "treatment": "Consultation",
        },
    )

    # User B's day view should NOT see User A's appointment
    r = await client.get(
        "/api/v1/calendar/day",
        headers=headers_b,
        params={"date": tomorrow.isoformat()},
    )
    assert r.status_code == 200
    all_b_appts = r.json()["unassigned"] + [a for d in r.json()["doctors"] for a in d["appointments"]]
    assert all(a["patient_name"] != "Loubna Hamzaoui" for a in all_b_appts)
