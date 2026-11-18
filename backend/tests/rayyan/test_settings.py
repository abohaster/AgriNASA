"""Checks 1-7 and 10: key lifecycle, encryption, masking and deletion."""

from __future__ import annotations

import json as jsonlib
import secrets
from pathlib import Path

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.rayyan import keystore
from app.rayyan.config import get_rayyan_settings
from app.rayyan.crypto import KeyCipher, validate_key_format
from tests.rayyan.conftest import (
    ADMIN_HEADERS,
    ALPHA,
    AQ_VALID,
    BETA,
    UNKNOWN,
    create_key,
)


def test_add_valid_key_activates_and_validates(rayyan_client: TestClient):
    response = create_key(rayyan_client, label="Primary", api_key=ALPHA)
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["label"] == "Primary"
    assert body["active"] is True
    assert body["status"] == "valid"
    assert body["masked_key"].endswith(ALPHA[-4:])
    assert ALPHA not in response.text
    assert body["model"] in {"gemini-flash-latest", "gemini-4-hydrogen", "gemini-3.5-flash"}

    with SessionLocal() as session:
        rows = keystore.list_keys(session)
    assert len(rows) == 1
    assert ALPHA not in rows[0]["ciphertext"]


def test_reject_invalid_key_saves_nothing(rayyan_client: TestClient, fake):
    response = create_key(rayyan_client, label="Bad", api_key=UNKNOWN)
    assert response.status_code == 422, response.text
    body = response.json()["error"]
    assert body["code"] in {"GEMINI_KEY_INVALID", "GEMINI_KEY_REJECTED"}
    assert "not saved" in body["details"].lower() or "not saved" in body["message"].lower()

    with SessionLocal() as session:
        assert keystore.count_keys(session) == 0


def test_key_format_accepts_aq_and_legacy_without_rewriting():
    assert validate_key_format(AQ_VALID) is None
    assert validate_key_format(ALPHA) is None
    assert validate_key_format("AQ." + "x" * 20 + " extra") is not None


def test_aq_key_is_verified_by_google_before_saving(rayyan_client: TestClient, fake):
    pasted = f"  {AQ_VALID}\n"
    response = create_key(rayyan_client, label="AI Studio AQ", api_key=pasted)
    assert response.status_code == 201, response.text
    assert AQ_VALID not in response.text
    assert "\u2022" in response.json()["masked_key"]

    # A real authenticated request reached the provider with the exact stored key.
    assert any(
        request.headers.get("x-goog-api-key") == AQ_VALID for request in fake.requests
    )

    with SessionLocal() as session:
        row = keystore.list_keys(session)[0]
    cipher = KeyCipher.from_settings(get_rayyan_settings())
    assert cipher.decrypt(row["ciphertext"]) == AQ_VALID


def test_well_formed_but_fake_aq_key_is_rejected_and_not_saved(
    rayyan_client: TestClient,
):
    fake_but_well_formed = "AQ." + secrets.token_urlsafe(32)
    assert validate_key_format(fake_but_well_formed) is None

    response = create_key(rayyan_client, label="Fake AQ", api_key=fake_but_well_formed)
    assert response.status_code == 422, response.text
    body = response.json()["error"]
    assert body["code"] == "GEMINI_KEY_INVALID"
    assert "API key not valid" in body["details"]
    assert fake_but_well_formed not in response.text

    with SessionLocal() as session:
        assert keystore.count_keys(session) == 0


def test_save_and_retrieve_encrypted(rayyan_client: TestClient):
    assert create_key(rayyan_client, label="Encrypted", api_key=ALPHA).status_code == 201

    settings = get_rayyan_settings()
    with SessionLocal() as session:
        row = keystore.list_keys(session)[0]
    cipher = KeyCipher.from_settings(settings)
    assert cipher.decrypt(row["ciphertext"]) == ALPHA
    assert row["ciphertext"] != ALPHA

    listing = rayyan_client.get("/api/rayyan/settings", headers=ADMIN_HEADERS)
    assert listing.status_code == 200
    assert ALPHA not in listing.text
    assert cipher.decrypt(row["ciphertext"]) == ALPHA


def test_only_masked_keys_in_responses(rayyan_client: TestClient):
    create_key(rayyan_client, label="A", api_key=ALPHA)
    create_key(rayyan_client, label="B", api_key=BETA)

    settings = rayyan_client.get("/api/rayyan/settings", headers=ADMIN_HEADERS)
    keys = settings.json()["keys"]
    assert len(keys) == 2
    for key in keys:
        assert "\u2022" in key["masked_key"]
        assert key["masked_key"] not in {ALPHA, BETA}
        assert len(key["masked_key"]) < len(ALPHA)

    availability = rayyan_client.get("/api/rayyan/availability")
    assert ALPHA not in availability.text and BETA not in availability.text
    assert "masked_key" not in availability.json()


def test_activate_saved_key(rayyan_client: TestClient):
    first = create_key(rayyan_client, label="First", api_key=ALPHA).json()
    second = create_key(rayyan_client, label="Second", api_key=BETA).json()
    assert first["active"] is True
    assert second["active"] is False

    response = rayyan_client.post(
        f"/api/rayyan/settings/keys/{second['id']}/activate",
        headers=ADMIN_HEADERS,
    )
    assert response.status_code == 200, response.text
    assert response.json()["active"] is True

    listing = rayyan_client.get("/api/rayyan/settings", headers=ADMIN_HEADERS).json()
    active = [key for key in listing["keys"] if key["active"]]
    assert len(active) == 1
    assert active[0]["id"] == second["id"]


def test_switch_between_two_keys_uses_the_active_one(
    rayyan_client: TestClient, field, fake
):
    alpha = create_key(
        rayyan_client, label="Alpha", api_key=ALPHA, model="gemini-2.5-flash"
    ).json()
    beta = create_key(
        rayyan_client, label="Beta", api_key=BETA, model="gemini-3.5-flash"
    ).json()

    first = rayyan_client.post(
        "/api/rayyan/ask",
        json={"field_id": field["id"], "message": "What does the irrigation need mean?"},
    )
    assert first.status_code == 200, first.text
    assert first.json()["key_id"] == alpha["id"]

    assert (
        rayyan_client.post(
            f"/api/rayyan/settings/keys/{beta['id']}/activate", headers=ADMIN_HEADERS
        ).status_code
        == 200
    )
    second = rayyan_client.post(
        "/api/rayyan/ask",
        json={"field_id": field["id"], "message": "Explain the current crop-health status."},
    )
    assert second.status_code == 200, second.text
    assert second.json()["key_id"] == beta["id"]

    models = []
    for request in fake.generated:
        body = jsonlib.loads(request.content.decode("utf-8"))
        if "<computed_field_context>" in body.get("input", ""):
            models.append(body["model"])
    assert models[-2:] == ["gemini-2.5-flash", "gemini-3.5-flash"]


def test_delete_key_and_block_requests(rayyan_client: TestClient, field):
    created = create_key(rayyan_client, label="Temporary", api_key=ALPHA).json()

    response = rayyan_client.delete(
        f"/api/rayyan/settings/keys/{created['id']}", headers=ADMIN_HEADERS
    )
    assert response.status_code == 204

    with SessionLocal() as session:
        assert keystore.count_keys(session) == 0

    availability = rayyan_client.get("/api/rayyan/availability").json()
    assert availability["configured"] is False
    assert availability["source"] == "none"

    blocked = rayyan_client.post(
        "/api/rayyan/ask",
        json={"field_id": field["id"], "message": "What is the irrigation need?"},
    )
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["error"]["code"] == "RAYAN_NO_ACTIVE_KEY"


def test_no_key_means_no_gemini_request(rayyan_client: TestClient, field, fake):
    before = len(fake.requests)
    response = rayyan_client.post(
        "/api/rayyan/ask",
        json={"field_id": field["id"], "message": "Should I irrigate today?"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "RAYAN_NO_ACTIVE_KEY"
    assert len(fake.requests) == before


def test_database_file_contains_no_plaintext(rayyan_client: TestClient):
    assert create_key(rayyan_client, label="Disk", api_key=ALPHA).status_code == 201

    from app.db.database import engine

    assert engine.url.get_backend_name() == "sqlite", "tests must run on SQLite"
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA wal_checkpoint(FULL)")

    base = Path(engine.url.database)
    candidates = [base, Path(f"{base}-wal"), Path(f"{base}-shm")]
    for candidate in candidates:
        if candidate.exists():
            assert ALPHA.encode("utf-8") not in candidate.read_bytes()
