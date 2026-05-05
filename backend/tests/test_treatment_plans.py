"""Treatment plans + sessions — auto-generation + transitions."""

import pytest


@pytest.mark.integration
async def test_create_plan_auto_generates_sessions(client, make_user, auth_headers, unique_phone):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Hanae",
            "last_name": "Kabbaj",
            "phone": unique_phone,
            "phone_country_code": "+212",
        },
    )
    pid = r.json()["id"]

    r = await client.post(
        "/api/v1/plans",
        headers=headers,
        json={
            "patient_id": pid,
            "title": "Botox visage — cure 4 séances",
            "primary_service": "botox",
            "indication_slugs": ["lignes-frontales", "patte-d-oie"],
            "zone_slugs": ["glabelle", "tempes"],
            "total_sessions": 4,
            "interval_value": 4,
            "interval_unit": "weeks",
            "estimated_total": 8000,
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["title"].startswith("Botox")
    assert body["total_sessions"] == 4
    assert len(body["sessions"]) == 4
    # Sessions are sequentially numbered
    nums = sorted(s["session_number"] for s in body["sessions"])
    assert nums == [1, 2, 3, 4]
    # All start in PLANNED
    assert all(s["status"] == "planned" for s in body["sessions"])


@pytest.mark.integration
async def test_advance_session_to_completed(client, make_user, auth_headers, unique_phone):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Mohamed",
            "last_name": "Benali",
            "phone": unique_phone,
            "phone_country_code": "+212",
        },
    )
    pid = r.json()["id"]

    r = await client.post(
        "/api/v1/plans",
        headers=headers,
        json={
            "patient_id": pid,
            "title": "Hydrafacial — 3 séances",
            "total_sessions": 3,
            "interval_value": 2,
            "interval_unit": "weeks",
        },
    )
    plan = r.json()
    s1_id = plan["sessions"][0]["id"]

    # planned -> scheduled (legal)
    r = await client.post(
        f"/api/v1/plans/sessions/{s1_id}/advance",
        headers=headers,
        json={"to_status": "scheduled"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "scheduled"

    # scheduled -> in_progress
    r = await client.post(
        f"/api/v1/plans/sessions/{s1_id}/advance",
        headers=headers,
        json={"to_status": "in_progress"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"

    # in_progress -> completed (with outcome)
    r = await client.post(
        f"/api/v1/plans/sessions/{s1_id}/advance",
        headers=headers,
        json={"to_status": "completed", "outcome_score": 9, "outcome_note": "Très bonne tolérance"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "completed"
    assert body["outcome_score"] == 9
    assert body["completed_at"] is not None


@pytest.mark.integration
async def test_advance_session_rejects_illegal_transition(
    client, make_user, auth_headers, unique_phone
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": "Sofia",
            "last_name": "Idrissi",
            "phone": unique_phone,
            "phone_country_code": "+212",
        },
    )
    pid = r.json()["id"]
    r = await client.post(
        "/api/v1/plans",
        headers=headers,
        json={"patient_id": pid, "title": "Test", "total_sessions": 1, "interval_value": 1, "interval_unit": "weeks"},
    )
    sid = r.json()["sessions"][0]["id"]

    # planned -> in_progress is illegal (must be scheduled first)
    r = await client.post(
        f"/api/v1/plans/sessions/{sid}/advance",
        headers=headers,
        json={"to_status": "in_progress"},
    )
    assert r.status_code == 409


@pytest.mark.integration
async def test_plans_isolate_tenants(client, make_user, auth_headers, unique_phone):
    user_a, clinic_a = await make_user()
    user_b, clinic_b = await make_user()
    headers_a = auth_headers(user_a.id, clinic_a.id)
    headers_b = auth_headers(user_b.id, clinic_b.id)

    r = await client.post(
        "/api/v1/patients",
        headers=headers_a,
        json={"first_name": "Salma", "last_name": "X", "phone": unique_phone, "phone_country_code": "+212"},
    )
    pid_a = r.json()["id"]
    r = await client.post(
        "/api/v1/plans",
        headers=headers_a,
        json={"patient_id": pid_a, "title": "Cure A", "total_sessions": 1, "interval_value": 1, "interval_unit": "weeks"},
    )
    plan_a = r.json()["id"]

    # B should not see plan A
    r = await client.get(f"/api/v1/plans/{plan_a}", headers=headers_b)
    assert r.status_code == 404
