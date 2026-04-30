"""Calendar ↔ Queue link — journey events keep both views in sync."""

from datetime import date, timedelta

import pytest


@pytest.mark.integration
async def test_arrived_event_lands_patient_in_awaiting_doctor_bucket(
    client, make_user, auth_headers, unique_phone
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    # Patient + appointment for tomorrow
    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Sara",
            "last_name": "Boukhriss",
            "phone": unique_phone,
            "phone_country_code": "+212",
            "intake_status": "active",
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
            "start_time": "09:00:00",
            "end_time": "09:30:00",
            "duration_minutes": 30,
            "treatment": "Botox",
        },
    )
    appt_id = r.json()["id"]

    # Mark arrived → patient should now be awaiting_doctor
    r = await client.post(
        f"/api/v1/calendar/{appt_id}/event",
        headers=headers,
        json={"event": "arrived"},
    )
    assert r.status_code == 200

    r = await client.get("/api/v1/queue", headers=headers)
    assert r.status_code == 200
    awaiting_ids = {p["id"] for p in r.json()["awaiting_doctor"]}
    assert pid in awaiting_ids


@pytest.mark.integration
async def test_started_event_moves_patient_to_in_room(
    client, make_user, auth_headers, unique_phone
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Adil",
            "last_name": "Cherkaoui",
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
            "start_time": "10:00:00",
            "end_time": "10:30:00",
            "duration_minutes": 30,
            "treatment": "Hydrafacial",
        },
    )
    appt_id = r.json()["id"]

    await client.post(
        f"/api/v1/calendar/{appt_id}/event",
        headers=headers,
        json={"event": "arrived"},
    )
    await client.post(
        f"/api/v1/calendar/{appt_id}/event",
        headers=headers,
        json={"event": "started"},
    )

    r = await client.get("/api/v1/queue", headers=headers)
    assert r.status_code == 200
    in_room_ids = {p["id"] for p in r.json()["in_room"]}
    assert pid in in_room_ids


@pytest.mark.integration
async def test_ended_event_clears_patient_from_queue(
    client, make_user, auth_headers, unique_phone
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Latifa",
            "last_name": "Ouazzani",
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
    appt_id = r.json()["id"]

    for ev in ("arrived", "started", "ended"):
        r = await client.post(
            f"/api/v1/calendar/{appt_id}/event",
            headers=headers,
            json={"event": ev},
        )
        assert r.status_code == 200

    # Patient should not be in any of the three queue buckets
    r = await client.get("/api/v1/queue", headers=headers)
    body = r.json()
    bucket_ids: set[str] = set()
    for k in ("intake_pending", "awaiting_doctor", "in_room"):
        bucket_ids.update(p["id"] for p in body[k])
    assert pid not in bucket_ids
