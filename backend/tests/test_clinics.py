"""Clinic settings — read + update + tenant isolation."""

import pytest


@pytest.mark.integration
async def test_get_my_clinic_returns_owner_clinic(client, make_user, auth_headers):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.get("/api/v1/clinics/me", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == str(clinic.id)
    # Defaults from W1.1
    assert body["timezone"] == "Africa/Casablanca"
    assert body["currency"] == "MAD"
    assert body["language"] == "fr"


@pytest.mark.integration
async def test_update_clinic_persists_legal_ids(client, make_user, auth_headers):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.patch(
        "/api/v1/clinics/me",
        headers=headers,
        json={
            "name": "Refine Beauty Clinic",
            "ice": "002345678000056",
            "if_number": "12345678",
            "rc_number": "98765",
            "cnss": "1122334",
            "phone": "+212522123456",
            "address": "12 Rue Hassan II, Casablanca",
            "primary_color": "#A65D46",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Refine Beauty Clinic"
    assert body["ice"] == "002345678000056"
    assert body["if_number"] == "12345678"
    assert body["rc_number"] == "98765"
    assert body["cnss"] == "1122334"
    assert body["primary_color"] == "#A65D46"


@pytest.mark.integration
async def test_clinic_settings_isolate_tenants(client, make_user, auth_headers):
    user_a, clinic_a = await make_user()
    user_b, clinic_b = await make_user()
    headers_a = auth_headers(user_a.id, clinic_a.id)
    headers_b = auth_headers(user_b.id, clinic_b.id)

    # User A patches clinic A
    await client.patch("/api/v1/clinics/me", headers=headers_a, json={"name": "Clinic A"})
    # User B reads — should see clinic B's name (not "Clinic A")
    r = await client.get("/api/v1/clinics/me", headers=headers_b)
    assert r.status_code == 200
    assert r.json()["name"] != "Clinic A"
