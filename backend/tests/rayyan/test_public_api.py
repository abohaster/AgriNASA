"""Fale7 API: key issuance, one-time QR links, auth, rate limits and the public ask endpoint."""

from __future__ import annotations

import hashlib
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.database import SessionLocal
from app.db.models import PublicApiAccessToken, PublicApiKey, utcnow
from tests.rayyan.conftest import ADMIN_HEADERS, ALPHA, create_key

GENERATE = "/api/rayyan/api/generate"
STATE = "/api/rayyan/api"
REVOKE = "/api/rayyan/api/revoke"
LINK = "/api/rayyan/api/access-link"
ASK = "/api/rayyan/v1/ask"


def _generate(client: TestClient) -> dict:
    response = client.post(GENERATE, headers=ADMIN_HEADERS)
    assert response.status_code == 200, response.text
    return response.json()


def _ask(client: TestClient, key: str, **body):
    payload = {"question": "Should this field be irrigated today?", **body}
    return client.post(ASK, json=payload, headers={"Authorization": f"Bearer {key}"})


def _state(client: TestClient):
    return client.get(STATE, headers=ADMIN_HEADERS)


def _revoke(client: TestClient):
    return client.post(REVOKE, headers=ADMIN_HEADERS)


def _link(client: TestClient):
    return client.post(LINK, headers=ADMIN_HEADERS)


def test_key_management_requires_settings_access(rayyan_client: TestClient):
    for method, path in (("get", STATE), ("post", GENERATE), ("post", REVOKE), ("post", LINK)):
        response = getattr(rayyan_client, method)(path)
        assert response.status_code == 401, (path, response.text)
        assert response.json()["error"]["code"] == "SETTINGS_UNAUTHORIZED"


def _key_row() -> PublicApiKey:
    with SessionLocal() as session:
        row = session.scalar(select(PublicApiKey).limit(1))
        assert row is not None
        session.expunge(row)
        return row


def test_state_starts_empty_then_generates_a_key_once(rayyan_client: TestClient):
    empty = _state(rayyan_client)
    assert empty.status_code == 200
    assert empty.json()["exists"] is False
    assert empty.json()["key"] is None
    assert empty.json()["scopes"] == ["fale7:ask"]

    issued = _generate(rayyan_client)
    key = issued["key"]
    assert key.startswith("fl7_")
    assert issued["exists"] is True
    assert issued["status"] == "active"
    assert issued["key_prefix"] == key[:12]
    assert issued["request_count"] == 0
    assert issued["requests_this_hour"] == 0
    assert issued["rate_limit_per_hour"] == 60
    assert issued["last_used_at"] is None

    stored = _key_row()
    assert stored.key_hash == hashlib.sha256(key.encode()).hexdigest()
    assert stored.key_hash != key
    assert stored.key_ciphertext != key

    later = _state(rayyan_client)
    assert later.status_code == 200
    body = later.json()
    assert body["exists"] is True
    assert body["status"] == "active"
    assert body["key"] is None
    assert body["key_prefix"] == key[:12]
    assert key not in later.text


def test_regenerating_invalidates_the_previous_key(rayyan_client: TestClient, field):
    create_key(rayyan_client, label="Gemini", api_key=ALPHA)
    first = _generate(rayyan_client)["key"]
    second = _generate(rayyan_client)["key"]

    assert first != second
    assert _state(rayyan_client).json()["key_prefix"] == second[:12]

    rejected = _ask(rayyan_client, first, field_id=field["id"])
    assert rejected.status_code == 401
    assert rejected.json()["error"]["code"] == "FALE7_API_UNAUTHORIZED"

    accepted = _ask(rayyan_client, second, field_id=field["id"])
    assert accepted.status_code == 200, accepted.text


def test_revoked_key_is_rejected_and_cannot_mint_qr(rayyan_client: TestClient, field):
    create_key(rayyan_client, label="Gemini", api_key=ALPHA)
    key = _generate(rayyan_client)["key"]

    revoked = _revoke(rayyan_client)
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "revoked"
    assert revoked.json()["key"] is None

    blocked = _ask(rayyan_client, key, field_id=field["id"])
    assert blocked.status_code == 401
    assert blocked.json()["error"]["code"] == "FALE7_API_REVOKED"

    assert _link(rayyan_client).status_code == 409


def test_access_link_reveals_the_key_exactly_once(rayyan_client: TestClient):
    key = _generate(rayyan_client)["key"]
    link = _link(rayyan_client)
    assert link.status_code == 200, link.text
    token = link.json()["token"]
    assert len(token) >= 32

    revealed = rayyan_client.get(f"/api/rayyan/api/access/{token}")
    assert revealed.status_code == 200, revealed.text
    body = revealed.json()
    assert body["key"] == key
    assert body["status"] == "active"
    assert body["rate_limit_per_hour"] == 60
    assert body["scopes"] == ["fale7:ask"]

    again = rayyan_client.get(f"/api/rayyan/api/access/{token}")
    assert again.status_code == 410
    assert again.json()["error"]["code"] == "FALE7_ACCESS_LINK_GONE"
    assert key not in again.text

    assert (
        rayyan_client.get("/api/rayyan/api/access/not-a-real-token").status_code == 410
    )


def test_expired_access_link_is_gone(rayyan_client: TestClient):
    key = _generate(rayyan_client)["key"]
    link = _link(rayyan_client).json()

    with SessionLocal() as session:
        row = session.scalar(
            select(PublicApiAccessToken).where(
                PublicApiAccessToken.token_hash
                == hashlib.sha256(link["token"].encode()).hexdigest()
            )
        )
        assert row is not None
        row.expires_at = utcnow() - timedelta(minutes=1)
        session.commit()

    response = rayyan_client.get(f"/api/rayyan/api/access/{link['token']}")
    assert response.status_code == 410
    assert key not in response.text


def test_revoked_key_is_not_revealed_by_an_existing_link(rayyan_client: TestClient):
    key = _generate(rayyan_client)["key"]
    token = _link(rayyan_client).json()["token"]
    assert _revoke(rayyan_client).status_code == 200

    # Revoking deletes outstanding links, so the QR is dead immediately.
    response = rayyan_client.get(f"/api/rayyan/api/access/{token}")
    assert response.status_code == 410
    assert response.json()["error"]["code"] == "FALE7_ACCESS_LINK_GONE"
    assert key not in response.text


def test_public_ask_returns_structured_grounded_data(
    rayyan_client: TestClient, field, fake
):
    create_key(rayyan_client, label="Gemini", api_key=ALPHA)
    key = _generate(rayyan_client)["key"]

    response = _ask(rayyan_client, key, field_id=field["id"])
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["answer"] == fake.generate_text
    assert body["provider"] == "gemini"
    assert body["data_mode"] == "demo"
    assert body["validation"]["status"] == "passed"
    assert body["model"]
    assert body["conversation_id"]

    recommendation = body["recommendation"]
    assert recommendation["irrigation_demand"] in {"low", "medium", "high"}
    assert recommendation["irrigation_label"]
    assert recommendation["demand_reasons"]
    assert recommendation["crop_health_status"]

    assert body["environmental_data"]["latest_values"]
    assert any(source["id"] == "nasa-power-daily" for source in body["data_sources"])
    assert body["limitations"]
    assert body["confidence"]["level"]

    assert body["usage"]["total_requests"] == 1
    assert body["usage"]["requests_this_hour"] == 1
    assert body["usage"]["rate_limit_per_hour"] == 60

    assert any("Demo mode" in warning for warning in body["warnings"])
    assert ALPHA not in response.text
    assert key not in response.text

    row = _key_row()
    assert row.request_count == 1
    assert row.window_count == 1
    assert row.last_status == "ok"
    assert row.last_used_at is not None


def test_public_ask_requires_a_valid_key(rayyan_client: TestClient, field):
    missing = rayyan_client.post(ASK, json={"question": "Hello?", "field_id": field["id"]})
    assert missing.status_code == 401
    assert missing.json()["error"]["code"] == "FALE7_API_UNAUTHORIZED"

    malformed = rayyan_client.post(
        ASK,
        json={"question": "Hello?", "field_id": field["id"]},
        headers={"Authorization": "Token abc"},
    )
    assert malformed.status_code == 401

    unknown = rayyan_client.post(
        ASK,
        json={"question": "Hello?", "field_id": field["id"]},
        headers={"Authorization": "Bearer fl7_does-not-exist"},
    )
    assert unknown.status_code == 401
    assert "Bearer fl7_does-not-exist" not in unknown.text


def test_public_ask_enforces_the_hourly_limit(rayyan_client: TestClient, field):
    create_key(rayyan_client, label="Gemini", api_key=ALPHA)
    key = _generate(rayyan_client)["key"]

    with SessionLocal() as session:
        row = session.scalar(select(PublicApiKey).limit(1))
        row.window_started_at = utcnow()
        row.window_count = 60
        session.commit()

    response = _ask(rayyan_client, key, field_id=field["id"])
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "FALE7_API_RATE_LIMITED"

    state = _state(rayyan_client).json()
    assert state["last_status"] == "rate_limited"
    assert state["requests_this_hour"] == 60


def test_public_ask_checks_the_field_and_crop(rayyan_client: TestClient, field):
    create_key(rayyan_client, label="Gemini", api_key=ALPHA)
    key = _generate(rayyan_client)["key"]

    unknown = _ask(rayyan_client, key, field_id=999_999)
    assert unknown.status_code == 404
    failed_state = _state(rayyan_client).json()
    assert failed_state["last_status"] == "error"
    assert failed_state["last_error_code"] == "NOT_FOUND"
    assert failed_state["request_count"] == 1

    mismatch = _ask(rayyan_client, key, field_id=field["id"], crop="potato")
    assert mismatch.status_code == 422
    assert mismatch.json()["error"]["code"] == "VALIDATION_ERROR"

    matching = _ask(rayyan_client, key, field_id=field["id"], crop="wheat")
    assert matching.status_code == 200, matching.text


def test_public_ask_without_field_uses_the_only_field(rayyan_client: TestClient, field):
    create_key(rayyan_client, label="Gemini", api_key=ALPHA)
    key = _generate(rayyan_client)["key"]

    only = _ask(rayyan_client, key)
    assert only.status_code == 200, only.text

    second = rayyan_client.post(
        "/api/fields",
        json={
            "name": "Second field",
            "latitude": 26.2,
            "longitude": 32.8,
            "crop_id": "potato",
            "planting_date": "2025-11-10",
            "area_ha": 1.2,
            "soil_texture": "loam",
            "irrigation_system": "drip",
        },
    )
    assert second.status_code == 201, second.text
    try:
        ambiguous = _ask(rayyan_client, key)
        assert ambiguous.status_code == 422
        assert "field_id" in ambiguous.json()["error"]["message"]
    finally:
        rayyan_client.delete(f"/api/fields/{second.json()['id']}")
