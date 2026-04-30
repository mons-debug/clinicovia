"""Queue (salle d'attente) — state machine + tenant isolation."""

import pytest


@pytest.mark.integration
async def test_queue_returns_three_buckets(client, make_user, auth_headers, unique_phone):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    # Create a patient with intake_status=intake_pending
    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Salma",
            "last_name": "El Fassi",
            "phone": unique_phone,
            "phone_country_code": "+212",
            "intake_status": "intake_pending",
            "requested_service": "Consultation Botox",
        },
    )
    assert r.status_code == 201, r.text

    r = await client.get("/api/v1/queue", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "intake_pending" in body
    assert "awaiting_doctor" in body
    assert "in_room" in body
    pending_phones = {p["phone"] for p in body["intake_pending"]}
    assert unique_phone in pending_phones


@pytest.mark.integration
async def test_advance_intake_state_machine(client, make_user, auth_headers, unique_phone):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Hicham",
            "last_name": "Benkirane",
            "phone": unique_phone,
            "phone_country_code": "+212",
            "intake_status": "intake_pending",
        },
    )
    assert r.status_code == 201
    pid = r.json()["id"]

    # pending -> awaiting_doctor (legal)
    r = await client.post(
        f"/api/v1/queue/{pid}/advance",
        headers=headers,
        json={"to_status": "awaiting_doctor"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["intake_status"] == "awaiting_doctor"

    # awaiting_doctor -> in_room (legal)
    r = await client.post(
        f"/api/v1/queue/{pid}/advance",
        headers=headers,
        json={"to_status": "in_room"},
    )
    assert r.status_code == 200
    assert r.json()["intake_status"] == "in_room"

    # in_room -> active (legal — finishes consultation)
    r = await client.post(
        f"/api/v1/queue/{pid}/advance",
        headers=headers,
        json={"to_status": "active"},
    )
    assert r.status_code == 200
    assert r.json()["intake_status"] == "active"


@pytest.mark.integration
async def test_advance_intake_rejects_illegal_transition(
    client, make_user, auth_headers, unique_phone
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Nadia",
            "last_name": "Cherradi",
            "phone": unique_phone,
            "phone_country_code": "+212",
            "intake_status": "intake_pending",
        },
    )
    assert r.status_code == 201
    pid = r.json()["id"]

    # pending -> in_room is illegal (must go through awaiting_doctor first)
    r = await client.post(
        f"/api/v1/queue/{pid}/advance",
        headers=headers,
        json={"to_status": "in_room"},
    )
    assert r.status_code == 409, r.text
    assert "Cannot transition" in r.json()["detail"]


@pytest.mark.integration
async def test_queue_isolates_tenants(client, make_user, auth_headers, unique_phone):
    """Clinic A's queue patient must NOT show up in clinic B's queue."""
    user_a, clinic_a = await make_user()
    user_b, clinic_b = await make_user()
    headers_a = auth_headers(user_a.id, clinic_a.id)
    headers_b = auth_headers(user_b.id, clinic_b.id)

    r = await client.post(
        "/api/v1/patients",
        headers=headers_a,
        json={
            "first_name": "Khadija",
            "last_name": "Sefrioui",
            "phone": unique_phone,
            "phone_country_code": "+212",
            "intake_status": "intake_pending",
        },
    )
    assert r.status_code == 201
    pid_a = r.json()["id"]

    r_b = await client.get("/api/v1/queue", headers=headers_b)
    assert r_b.status_code == 200
    all_b_ids = {p["id"] for bucket in ("intake_pending", "awaiting_doctor", "in_room")
                 for p in r_b.json()[bucket]}
    assert pid_a not in all_b_ids
