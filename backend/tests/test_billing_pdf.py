"""Invoice PDF — render check + tenant isolation."""

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
    assert r.status_code == 201
    return r.json()["id"]


@pytest.mark.integration
async def test_pdf_returns_application_pdf_bytes(
    client, make_user, auth_headers, unique_phone
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    # Set legal IDs so the letterhead has something to print
    await client.patch(
        "/api/v1/clinics/me",
        headers=headers,
        json={
            "name": "Refine Beauty Clinic",
            "ice": "002345678000056",
            "if_number": "12345678",
            "rc_number": "98765",
            "address": "12 Rue Hassan II",
            "city": "Casablanca",
            "country": "Morocco",
            "phone": "+212522123456",
        },
    )

    pid = await _patient(client, headers, unique_phone)

    r = await client.post(
        "/api/v1/invoices",
        headers=headers,
        json={
            "patient_id": pid,
            "issue_date": date.today().isoformat(),
            "line_items": [
                {"label": "Consultation initiale", "quantity": 1, "unit_price": 300},
                {"label": "Botox glabelle", "quantity": 1, "unit_price": 2000},
            ],
            "discount": 100,
        },
    )
    inv_id = r.json()["id"]
    await client.post(f"/api/v1/invoices/{inv_id}/issue", headers=headers)

    # PDF endpoint
    r = await client.get(f"/api/v1/invoices/{inv_id}/pdf", headers=headers)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("application/pdf")
    body = r.content
    assert body.startswith(b"%PDF-"), "Response should start with the PDF magic bytes"
    assert len(body) > 2_000, "PDF should be a non-trivial size"


@pytest.mark.integration
async def test_pdf_isolates_tenants(client, make_user, auth_headers, unique_phone):
    user_a, clinic_a = await make_user()
    user_b, clinic_b = await make_user()
    headers_a = auth_headers(user_a.id, clinic_a.id)
    headers_b = auth_headers(user_b.id, clinic_b.id)

    pid = await _patient(client, headers_a, unique_phone)
    r = await client.post(
        "/api/v1/invoices",
        headers=headers_a,
        json={
            "patient_id": pid,
            "line_items": [{"label": "X", "quantity": 1, "unit_price": 100}],
        },
    )
    inv_id = r.json()["id"]

    r = await client.get(f"/api/v1/invoices/{inv_id}/pdf", headers=headers_b)
    assert r.status_code == 404
