"""Photos + body zones — seed, upload, list, serve, tenant isolation."""

import io

import pytest


# 1×1 transparent PNG
TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d49444154789c63000100000005000167a700180000000049454e44"
    "ae426082"
)


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
async def test_seed_and_list_zones(client, make_user, auth_headers):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)

    r = await client.post("/api/v1/photos/zones/seed", headers=headers)
    assert r.status_code == 200
    assert r.json()["inserted"] >= 20

    # Idempotent
    r = await client.post("/api/v1/photos/zones/seed", headers=headers)
    assert r.json()["inserted"] == 0

    r = await client.get("/api/v1/photos/zones", headers=headers)
    assert r.status_code == 200
    slugs = {z["slug"] for z in r.json()["zones"]}
    assert "glabelle" in slugs
    assert "aisselles" in slugs
    assert "pieds" in slugs


@pytest.mark.integration
async def test_upload_and_serve_photo(client, make_user, auth_headers, unique_phone):
    user, clinic = await make_user()
    headers = auth_headers(user.id, clinic.id)
    await client.post("/api/v1/photos/zones/seed", headers=headers)

    pid = await _patient(client, headers, unique_phone)

    files = {"file": ("test.png", io.BytesIO(TINY_PNG), "image/png")}
    data = {
        "patient_id": pid,
        "zone_slug": "glabelle",
        "stage": "before",
        "angle": "front",
        "consent_scope": "medical",
    }
    r = await client.post("/api/v1/photos/upload", headers=headers, files=files, data=data)
    assert r.status_code == 201, r.text
    photo = r.json()
    assert photo["zone_slug"] == "glabelle"
    assert photo["stage"] == "before"
    assert photo["size_bytes"] > 0

    # Serve
    r = await client.get(f"/api/v1/photos/{photo['id']}/file", headers=headers)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/")
    assert r.content == TINY_PNG

    # List
    r = await client.get(f"/api/v1/photos?patient_id={pid}", headers=headers)
    assert r.status_code == 200
    assert r.json()["total"] == 1


@pytest.mark.integration
async def test_photos_isolate_tenants(client, make_user, auth_headers, unique_phone):
    user_a, clinic_a = await make_user()
    user_b, clinic_b = await make_user()
    headers_a = auth_headers(user_a.id, clinic_a.id)
    headers_b = auth_headers(user_b.id, clinic_b.id)

    await client.post("/api/v1/photos/zones/seed", headers=headers_a)
    pid = await _patient(client, headers_a, unique_phone)

    files = {"file": ("test.png", io.BytesIO(TINY_PNG), "image/png")}
    data = {"patient_id": pid, "zone_slug": "glabelle"}
    r = await client.post("/api/v1/photos/upload", headers=headers_a, files=files, data=data)
    pid_photo = r.json()["id"]

    # B can't read A's photo
    r = await client.get(f"/api/v1/photos/{pid_photo}/file", headers=headers_b)
    assert r.status_code == 404
