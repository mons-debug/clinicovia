"""Prescriptions — sequential numbering, sign flow, drug seed, PDF."""

from datetime import date

import pytest


async def _patient(client, headers, unique_phone, name="Imane Bennani"):
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
async def test_seed_drugs_idempotent(client, make_user, auth_headers):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.post("/api/v1/prescriptions/seed-drugs", headers=headers)
    assert r.status_code == 200
    first = r.json()["inserted"]
    assert first > 20  # at least 20 of the seed list landed

    # Second call should be a no-op
    r = await client.post("/api/v1/prescriptions/seed-drugs", headers=headers)
    assert r.status_code == 200
    assert r.json()["inserted"] == 0

    # List filters work
    r = await client.get("/api/v1/prescriptions/drugs?search=paracétamol", headers=headers)
    assert r.status_code == 200
    drugs = r.json()["drugs"]
    assert any(d["dci"] == "paracétamol" for d in drugs)


@pytest.mark.integration
async def test_create_and_sign_prescription(client, make_user, auth_headers, unique_phone):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)
    pid = await _patient(client, headers, unique_phone)

    r = await client.post(
        "/api/v1/prescriptions",
        headers=headers,
        json={
            "patient_id": pid,
            "issue_date": date.today().isoformat(),
            "diagnosis": "Post-Botox glabelle",
            "lines": [
                {
                    "dci": "paracétamol",
                    "brand": "Doliprane",
                    "form": "tablet",
                    "strength": "1000 mg",
                    "posology": "1 cp × 3/j",
                    "duration": "3 j",
                },
                {
                    "dci": "ibuprofène",
                    "brand": "Brufen",
                    "form": "tablet",
                    "strength": "400 mg",
                    "posology": "1 cp × 2/j au cours du repas",
                    "duration": "3 j",
                },
            ],
            "renewable": False,
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "draft"
    assert body["number"].startswith("DRAFT-")
    assert len(body["lines"]) == 2

    rx_id = body["id"]

    # Sign — locks ORD-YYYY-NNNN
    r = await client.post(f"/api/v1/prescriptions/{rx_id}/sign", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "signed"
    assert body["number"].startswith(f"ORD-{date.today().year}-")
    assert body["signed_at"] is not None


@pytest.mark.integration
async def test_sequential_numbering_per_clinic_per_year(
    client, make_user, auth_headers, unique_phone
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)
    pid = await _patient(client, headers, unique_phone)

    numbers = []
    for _ in range(2):
        r = await client.post(
            "/api/v1/prescriptions",
            headers=headers,
            json={
                "patient_id": pid,
                "lines": [{"dci": "paracétamol", "posology": "1 cp × 3/j"}],
            },
        )
        rx_id = r.json()["id"]
        r = await client.post(f"/api/v1/prescriptions/{rx_id}/sign", headers=headers)
        numbers.append(r.json()["number"])

    n1 = int(numbers[0].split("-")[-1])
    n2 = int(numbers[1].split("-")[-1])
    assert n2 == n1 + 1


@pytest.mark.integration
async def test_prescription_pdf_renders(client, make_user, auth_headers, unique_phone):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    await client.patch(
        "/api/v1/clinics/me",
        headers=headers,
        json={"name": "Refine Beauty Clinic", "ice": "002345678000056", "if_number": "12345678"},
    )

    pid = await _patient(client, headers, unique_phone)
    r = await client.post(
        "/api/v1/prescriptions",
        headers=headers,
        json={
            "patient_id": pid,
            "diagnosis": "Suite à acte de Botox",
            "lines": [
                {"dci": "paracétamol", "strength": "500 mg", "posology": "1 cp × 3/j", "duration": "3 j"},
            ],
        },
    )
    rx_id = r.json()["id"]
    await client.post(f"/api/v1/prescriptions/{rx_id}/sign", headers=headers)

    r = await client.get(f"/api/v1/prescriptions/{rx_id}/pdf", headers=headers)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.content.startswith(b"%PDF-")
    assert len(r.content) > 1500


@pytest.mark.integration
async def test_prescriptions_isolate_tenants(client, make_user, auth_headers, unique_phone):
    user_a, clinic_a = await make_user()
    user_b, clinic_b = await make_user()
    headers_a = auth_headers(user_a.id, clinic_a.id)
    headers_b = auth_headers(user_b.id, clinic_b.id)

    pid_a = await _patient(client, headers_a, unique_phone)
    r = await client.post(
        "/api/v1/prescriptions",
        headers=headers_a,
        json={"patient_id": pid_a, "lines": [{"dci": "paracétamol", "posology": "1 cp/j"}]},
    )
    rx_id = r.json()["id"]

    r = await client.get(f"/api/v1/prescriptions/{rx_id}", headers=headers_b)
    assert r.status_code == 404
