"""Billing — invoices + payments + sequential numbering."""

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
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.mark.integration
async def test_create_draft_invoice_computes_totals(
    client, make_user, auth_headers, unique_phone
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)
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
            "tva_rate": 0,
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "draft"
    assert body["number"].startswith("DRAFT-")
    assert body["subtotal"] == 2300.0
    assert body["discount"] == 100.0
    assert body["total"] == 2200.0


@pytest.mark.integration
async def test_issue_invoice_assigns_sequential_number(
    client, make_user, auth_headers, unique_phone
):
    """Two issued invoices in the same year should get FAC-YYYY-0001 and -0002."""
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)
    pid = await _patient(client, headers, unique_phone)
    year = date.today().year

    numbers = []
    for label, price in (("A", 1000), ("B", 1500)):
        r = await client.post(
            "/api/v1/invoices",
            headers=headers,
            json={
                "patient_id": pid,
                "line_items": [{"label": label, "quantity": 1, "unit_price": price}],
            },
        )
        inv_id = r.json()["id"]
        r = await client.post(f"/api/v1/invoices/{inv_id}/issue", headers=headers)
        assert r.status_code == 200, r.text
        numbers.append(r.json()["number"])

    # Both should match the FAC-YYYY-NNNN pattern with sequential N
    assert numbers[0].startswith(f"FAC-{year}-")
    assert numbers[1].startswith(f"FAC-{year}-")
    n1 = int(numbers[0].split("-")[-1])
    n2 = int(numbers[1].split("-")[-1])
    assert n2 == n1 + 1


@pytest.mark.integration
async def test_record_partial_then_full_payment_flips_status(
    client, make_user, auth_headers, unique_phone
):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)
    pid = await _patient(client, headers, unique_phone)

    r = await client.post(
        "/api/v1/invoices",
        headers=headers,
        json={
            "patient_id": pid,
            "line_items": [{"label": "Cure", "quantity": 1, "unit_price": 5000}],
        },
    )
    inv_id = r.json()["id"]
    await client.post(f"/api/v1/invoices/{inv_id}/issue", headers=headers)

    # Partial: 2000 of 5000
    r = await client.post(
        f"/api/v1/invoices/{inv_id}/payments",
        headers=headers,
        json={"amount": 2000, "method": "cash"},
    )
    assert r.status_code == 201
    r = await client.get(f"/api/v1/invoices/{inv_id}", headers=headers)
    assert r.json()["status"] == "partial"
    assert r.json()["total_paid"] == 2000.0

    # Top up to full
    r = await client.post(
        f"/api/v1/invoices/{inv_id}/payments",
        headers=headers,
        json={"amount": 3000, "method": "card"},
    )
    assert r.status_code == 201
    r = await client.get(f"/api/v1/invoices/{inv_id}", headers=headers)
    assert r.json()["status"] == "paid"
    assert r.json()["total_paid"] == 5000.0


@pytest.mark.integration
async def test_invoices_isolate_tenants(client, make_user, auth_headers, unique_phone):
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
    r = await client.get(f"/api/v1/invoices/{inv_id}", headers=headers_b)
    assert r.status_code == 404
