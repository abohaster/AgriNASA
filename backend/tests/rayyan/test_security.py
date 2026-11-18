"""Settings auth, validation-error hygiene, capabilities and leak checks."""

from __future__ import annotations

import logging

from fastapi.testclient import TestClient

from tests.rayyan.conftest import ADMIN_HEADERS, ALPHA, create_key


def test_settings_require_token(rayyan_client: TestClient):
    listing = rayyan_client.get("/api/rayyan/settings")
    assert listing.status_code == 401
    assert listing.json()["error"]["code"] == "SETTINGS_UNAUTHORIZED"

    wrong = rayyan_client.post(
        "/api/rayyan/settings/keys",
        headers={"X-Rayyan-Settings-Token": "wrong"},
        json={"label": "Nope", "api_key": ALPHA},
    )
    assert wrong.status_code == 401

    public = rayyan_client.get("/api/rayyan/availability")
    assert public.status_code == 200
    assert public.json()["configured"] is False


def test_validation_error_never_echoes_the_key(rayyan_client: TestClient):
    secret_like = "shortkey"
    response = rayyan_client.post(
        "/api/rayyan/settings/keys",
        headers=ADMIN_HEADERS,
        json={"label": "Short", "api_key": secret_like},
    )
    assert response.status_code == 422
    assert secret_like not in response.text


def test_capabilities_in_demo_mode(rayyan_client: TestClient):
    response = rayyan_client.get("/api/rayyan/capabilities?mode=demo")
    assert response.status_code == 200
    body = response.json()
    statuses = {entry["id"]: entry["status"] for entry in body["capabilities"]}

    assert body["data_mode"] == "demo"
    assert statuses["nasa_power"] == "DEMO_ONLY"
    assert statuses["sentinel2_ndvi"] == "DEMO_ONLY"
    assert statuses["open_meteo_forecast"] == "DEMO_ONLY"
    assert statuses["disease_diagnosis"] == "NOT_IMPLEMENTED"
    assert statuses["pest_identification"] == "NOT_IMPLEMENTED"
    assert statuses["yield_prediction"] == "NOT_IMPLEMENTED"
    assert statuses["continuous_monitoring"] == "NOT_IMPLEMENTED"
    assert statuses["on_farm_sensors"] == "NOT_IMPLEMENTED"
    assert statuses["irrigation_schedule"] == "NOT_IMPLEMENTED"
    assert "disease_diagnosis" in body["unavailable_ids"]


def test_capabilities_in_live_mode_without_earth_engine(rayyan_client: TestClient):
    response = rayyan_client.get("/api/rayyan/capabilities?mode=live")
    assert response.status_code == 200
    statuses = {entry["id"]: entry["status"] for entry in response.json()["capabilities"]}
    assert statuses["sentinel2_ndvi"] == "CONFIGURATION_REQUIRED"
    assert statuses["nasa_gibs"] == "AVAILABLE"
    assert statuses["geocoding"] == "AVAILABLE"


def test_no_key_in_logs_or_any_response(rayyan_client: TestClient, field, caplog):
    caplog.set_level(logging.DEBUG)
    created = create_key(rayyan_client, label="Log check", api_key=ALPHA)
    assert created.status_code == 201

    responses = [
        created,
        rayyan_client.get("/api/rayyan/settings", headers=ADMIN_HEADERS),
        rayyan_client.get("/api/rayyan/availability"),
        rayyan_client.get("/api/rayyan/capabilities"),
        rayyan_client.get("/api/rayyan/settings/models", headers=ADMIN_HEADERS),
        rayyan_client.post(
            "/api/rayyan/ask",
            json={"field_id": field["id"], "message": "Explain the irrigation status."},
        ),
    ]

    for response in responses:
        assert ALPHA not in response.text

    log_text = caplog.text
    assert ALPHA not in log_text
    assert "x-goog-api-key" not in log_text.lower()
