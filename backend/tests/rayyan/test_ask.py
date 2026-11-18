"""Checks 8-9: asking RAYAN, provider failures, grounding and fallbacks."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from tests.rayyan.conftest import ADMIN_HEADERS, ALPHA, BETA, create_key


def _ask(client: TestClient, field_id: int, message: str, **extra):
    payload = {"field_id": field_id, "message": message, **extra}
    return client.post("/api/rayyan/ask", json=payload)


def test_ask_with_active_key(rayyan_client: TestClient, field, fake):
    created = create_key(rayyan_client, label="Primary", api_key=ALPHA).json()

    response = _ask(
        rayyan_client,
        field["id"],
        "What does the irrigation refill requirement mean for this wheat field?",
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["provider"] == "gemini"
    assert body["model"]
    assert body["key_id"] == created["id"]
    assert body["key_label"] == "Primary"
    assert body["reply"] == fake.generate_text
    assert body["validation"]["status"] == "passed"
    assert body["provider_error"] is None
    assert body["conversation_persisted"] is False
    assert body["is_demo"] is True

    context = body["context_used"]
    assert context["field"]["id"] == field["id"]
    assert context["data_mode"] == "demo"
    assert "irrigation" in context and "crop_health" in context
    assert context["rayyan"]["conversation_persisted"] is False
    assert context["forecast"]["available"] is False

    statuses = {entry["id"]: entry["status"] for entry in body["capabilities"]}
    assert statuses["sentinel2_ndvi"] == "DEMO_ONLY"
    assert statuses["disease_diagnosis"] == "NOT_IMPLEMENTED"
    assert statuses["yield_prediction"] == "NOT_IMPLEMENTED"

    assert ALPHA not in response.text
    assert body["sources"]
    assert any(source["id"] == "nasa-power-daily" for source in body["sources"])

    generated = fake.generated[-1]
    assert generated.headers["x-goog-api-key"] == ALPHA
    request_body = json.loads(generated.content.decode("utf-8"))
    assert request_body["store"] is False
    assert "system_instruction" in request_body
    assert "<computed_field_context>" in request_body["input"]


def test_demo_forecast_is_reported_unavailable(rayyan_client: TestClient, field):
    create_key(rayyan_client, label="Primary", api_key=ALPHA)
    response = _ask(rayyan_client, field["id"], "Will it rain tomorrow on this field?")
    assert response.status_code == 200, response.text
    forecast = response.json()["context_used"]["forecast"]
    assert forecast["requested"] is True
    assert forecast["available"] is False
    assert "Demo mode" in forecast["reason"]


def test_invalid_key_during_ask_is_reported_and_preserved(
    rayyan_client: TestClient, field, fake
):
    created = create_key(rayyan_client, label="Will fail", api_key=ALPHA).json()
    fake.mode = "invalid"

    response = _ask(rayyan_client, field["id"], "Explain the crop-health indicators.")
    assert response.status_code == 409, response.text
    error = response.json()["error"]
    assert error["code"] == "GEMINI_KEY_INVALID"
    assert "preserved" in error["details"].lower()

    listing = rayyan_client.get("/api/rayyan/settings", headers=ADMIN_HEADERS).json()
    assert len(listing["keys"]) == 1
    assert listing["keys"][0]["status"] == "invalid"
    assert listing["keys"][0]["active"] is True
    assert listing["configured"] is False

    generated_before = len(fake.generated)
    blocked = _ask(rayyan_client, field["id"], "Try again please.")
    assert blocked.status_code == 409
    assert len(fake.generated) == generated_before, "invalid key must not be sent again"

    fake.mode = "ok"
    validated = rayyan_client.post(
        f"/api/rayyan/settings/keys/{created['id']}/validate", headers=ADMIN_HEADERS
    )
    assert validated.status_code == 200
    assert validated.json()["valid"] is True

    recovered = _ask(rayyan_client, field["id"], "Explain the irrigation status.")
    assert recovered.status_code == 200, recovered.text


def test_quota_error_and_switching_to_another_key(rayyan_client: TestClient, field, fake):
    alpha = create_key(rayyan_client, label="Quota key", api_key=ALPHA).json()
    fake.mode = "quota"

    response = _ask(rayyan_client, field["id"], "Explain the irrigation status.")
    assert response.status_code == 429, response.text
    error = response.json()["error"]
    assert error["code"] == "GEMINI_QUOTA_EXCEEDED"
    assert "another valid saved key" in error["details"]
    assert "30s" in error["details"]

    listing = rayyan_client.get("/api/rayyan/settings", headers=ADMIN_HEADERS).json()
    quota_key = next(key for key in listing["keys"] if key["id"] == alpha["id"])
    assert quota_key["status"] == "quota_limited"
    assert quota_key["last_error_code"] == "GEMINI_QUOTA_EXCEEDED"

    fake.mode = "ok"
    beta = create_key(rayyan_client, label="Backup key", api_key=BETA).json()
    assert beta["status"] == "valid"
    assert beta["active"] is False

    activated = rayyan_client.post(
        f"/api/rayyan/settings/keys/{beta['id']}/activate", headers=ADMIN_HEADERS
    )
    assert activated.status_code == 200
    resumed = _ask(rayyan_client, field["id"], "Explain the irrigation status.")
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["key_id"] == beta["id"]


def test_transient_failure_returns_labelled_deterministic_fallback(
    rayyan_client: TestClient, field, fake
):
    create_key(rayyan_client, label="Primary", api_key=ALPHA)
    fake.mode = "timeout"

    response = _ask(rayyan_client, field["id"], "Explain the irrigation status.")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "deterministic_fallback"
    assert body["provider_error"]["code"] == "GEMINI_TIMEOUT"
    assert body["validation"]["status"] == "skipped"
    assert "not an AI answer" in body["reply"]
    assert "Google Gemini did not produce this answer" in body["notice"]

    listing = rayyan_client.get("/api/rayyan/settings", headers=ADMIN_HEADERS).json()
    # A timeout does not invalidate the key.
    assert listing["keys"][0]["status"] == "valid"
    assert listing["configured"] is True


def test_fabricated_numbers_are_withheld(rayyan_client: TestClient, field, fake):
    create_key(rayyan_client, label="Primary", api_key=ALPHA)
    fake.generate_text = (
        "Apply exactly 999 mm of water tomorrow and expect the soil to recover."
    )

    response = _ask(rayyan_client, field["id"], "How much should I irrigate?")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "deterministic_fallback"
    assert body["provider_error"]["code"] == "RAYAN_VALIDATION_REJECTED"
    assert body["validation"]["status"] == "rejected"
    assert "999" in body["validation"]["rejected_numbers"]
    assert "999" not in body["reply"]


def test_diagnosis_claim_is_withheld(rayyan_client: TestClient, field, fake):
    create_key(rayyan_client, label="Primary", api_key=ALPHA)
    fake.generate_text = "The crop has rust and the field will yield five tons."

    response = _ask(rayyan_client, field["id"], "Does my crop have a disease?")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "deterministic_fallback"
    assert "unsafe_diagnosis" in body["validation"]["checks"]


def test_urls_are_removed(rayyan_client: TestClient, field, fake):
    create_key(rayyan_client, label="Primary", api_key=ALPHA)
    fake.generate_text = (
        "The context shows the computed irrigation need. Read more at "
        "https://unverified.example/page and treat the estimate as decision support."
    )
    response = _ask(rayyan_client, field["id"], "Where can I read more?")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "gemini"
    assert body["validation"]["removed_urls"] == 1
    assert "unverified.example" not in body["reply"]


def test_conversation_is_ephemeral_but_used_for_context(
    rayyan_client: TestClient, field, fake
):
    create_key(rayyan_client, label="Primary", api_key=ALPHA)
    first = _ask(
        rayyan_client,
        field["id"],
        "First question: explain the irrigation status.",
        conversation_id="conv-test-1",
    )
    assert first.status_code == 200
    assert first.json()["conversation_id"] == "conv-test-1"
    assert first.json()["context_used"]["rayyan"]["history_turns"] == 0

    second = _ask(
        rayyan_client,
        field["id"],
        "Second question: and the crop-health indicators?",
        conversation_id="conv-test-1",
    )
    assert second.status_code == 200
    assert second.json()["context_used"]["rayyan"]["history_turns"] == 2
    assert second.json()["conversation_persisted"] is False

    prompt = json.loads(fake.generated[-1].content.decode("utf-8"))["input"]
    assert "First question" in prompt


def test_unknown_field_is_404(rayyan_client: TestClient):
    create_key(rayyan_client, label="Primary", api_key=ALPHA)
    response = _ask(rayyan_client, 999999, "Explain the irrigation status.")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
