"""Consultation SOAP — sign flow + tenant isolation."""

from datetime import date

import pytest


async def _patient(client, headers, unique_phone, name="Test Patient"):
    first, last = name.split(" ", 1)
    r = await client.post(
        "/api/v1/patients",
        headers=headers,
        json={
            "first_name": first,
            "last_name": last,
            "phone": unique_phone,
            "phone_country_code": "+212",
        },
    )
    return r.json()["id"]


@pytest.mark.integration
async def test_create_and_sign_consultation(client, make_user, auth_headers, unique_phone):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)
    pid = await _patient(client, headers, unique_phone)

    r = await client.post(
        "/api/v1/consultations",
        headers=headers,
        json={
            "patient_id": pid,
            "visit_date": date.today().isoformat(),
            "chief_complaint": "Sillons naso-géniens",
            "subjective": "Patiente demande comblement.",
            "objective": "Sillons modérés bilatéraux. Peau Fitzpatrick III, élasticité bonne.",
            "assessment": "Indication confirmée pour acide hyaluronique.",
            "plan_text": "AH 1 ml par côté. Contrôle à J+15.",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "draft"
    assert body["number"].startswith("DRAFT-")

    cons_id = body["id"]

    # Sign — locks CONS-YYYY-NNNN
    r = await client.post(f"/api/v1/consultations/{cons_id}/sign", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "signed"
    assert body["number"].startswith(f"CONS-{date.today().year}-")
    assert body["signed_at"] is not None


@pytest.mark.integration
async def test_consultations_isolate_tenants(client, make_user, auth_headers, unique_phone):
    user_a, clinic_a = await make_user()
    user_b, clinic_b = await make_user()
    headers_a = auth_headers(user_a.id, clinic_a.id)
    headers_b = auth_headers(user_b.id, clinic_b.id)

    pid = await _patient(client, headers_a, unique_phone)
    r = await client.post(
        "/api/v1/consultations",
        headers=headers_a,
        json={"patient_id": pid, "subjective": "x"},
    )
    cons_id = r.json()["id"]

    r = await client.get(f"/api/v1/consultations/{cons_id}", headers=headers_b)
    assert r.status_code == 404


@pytest.mark.integration
async def test_edit_only_while_draft(client, make_user, auth_headers, unique_phone):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)
    pid = await _patient(client, headers, unique_phone)

    r = await client.post(
        "/api/v1/consultations",
        headers=headers,
        json={"patient_id": pid, "subjective": "Initial"},
    )
    cons_id = r.json()["id"]

    # Edit while draft — OK
    r = await client.patch(
        f"/api/v1/consultations/{cons_id}",
        headers=headers,
        json={"subjective": "Updated"},
    )
    assert r.status_code == 200
    assert r.json()["subjective"] == "Updated"

    # Sign
    r = await client.post(f"/api/v1/consultations/{cons_id}/sign", headers=headers)
    assert r.status_code == 200

    # Edit after sign — 409
    r = await client.patch(
        f"/api/v1/consultations/{cons_id}",
        headers=headers,
        json={"subjective": "Should fail"},
    )
    assert r.status_code == 409
