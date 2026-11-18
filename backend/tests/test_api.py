"""
HTTP-level tests for the public API.

The suite runs with `DATA_MODE=demo` (see conftest.py), so every analysis replays
the cached NASA POWER snapshot. That keeps tests deterministic and offline while
still exercising the full NASA -> processing -> science -> API pipeline.
"""

from datetime import date, timedelta

import pytest


def test_health_endpoint_reports_offline_capabilities(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["data_mode"] == "demo"
    assert body["database"] == "ok"
    # conftest deliberately leaves credentials empty.
    assert body["ai_configured"] is False
    assert body["vegetation_configured"] is False


def test_data_sources_expose_provenance(client):
    response = client.get("/api/data-sources")
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "demo"
    assert body["sources"], "the provenance catalogue must not be empty"

    power = next(source for source in body["sources"] if source["id"] == "nasa-power-daily")
    assert power["nature"] == "reanalysis"
    assert "0.5" in (power["resolution"] or "")
    assert any("not on-farm sensors" in note for note in body["notes"])


def test_demo_descriptor_describes_the_cached_snapshot(client):
    response = client.get("/api/demo")
    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert body["snapshot_date"] == "2026-03-10"
    assert body["snapshot_field"]["latitude"] == 26.15
    assert "Cached NASA POWER snapshot" in body["notice"]


def test_field_crud_roundtrip(client, field):
    field_id = field["id"]
    assert field["crop_name"] == "Wheat"
    assert field["boundary_geojson"] is None

    listed = client.get("/api/fields")
    assert listed.status_code == 200
    assert any(row["id"] == field_id for row in listed.json())

    fetched = client.get(f"/api/fields/{field_id}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Test wheat field"

    patched = client.patch(f"/api/fields/{field_id}", json={"name": "Renamed field"})
    assert patched.status_code == 200
    assert patched.json()["name"] == "Renamed field"


def test_field_boundary_polygon_is_stored_and_returned(client):
    polygon = {
        "type": "Polygon",
        # Four corners plus the closing position, in [longitude, latitude] order.
        "coordinates": [
            [
                [32.7200, 26.1500],
                [32.7260, 26.1500],
                [32.7260, 26.1540],
                [32.7200, 26.1540],
                [32.7200, 26.1500],
            ]
        ],
    }
    response = client.post(
        "/api/fields",
        json={
            "name": "Boundary field",
            "latitude": 26.152,
            "longitude": 32.723,
            "planting_date": "2025-11-15",
            "boundary_geojson": polygon,
        },
    )
    assert response.status_code == 201, response.text
    created = response.json()
    assert created["boundary_geojson"] == polygon

    fetched = client.get(f"/api/fields/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["boundary_geojson"] == polygon

    assert client.delete(f"/api/fields/{created['id']}").status_code == 204


def test_invalid_field_boundaries_are_rejected(client):
    base = {
        "name": "Bad boundary",
        "latitude": 26.15,
        "longitude": 32.72,
        "planting_date": "2025-11-15",
    }
    unclosed = {
        "type": "Polygon",
        "coordinates": [
            [[32.72, 26.15], [32.73, 26.15], [32.73, 26.16], [32.72, 26.16]]
        ],
    }
    too_few = {
        "type": "Polygon",
        "coordinates": [[[32.72, 26.15], [32.73, 26.15], [32.72, 26.15]]],
    }
    wrong_type = {
        "type": "Point",
        "coordinates": [32.72, 26.15],
    }

    for boundary in (unclosed, too_few, wrong_type):
        response = client.post("/api/fields", json={**base, "boundary_geojson": boundary})
        assert response.status_code == 422, boundary
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_field_validation_uses_the_error_envelope(client):
    response = client.post(
        "/api/fields",
        json={
            "name": "Bad latitude",
            "latitude": 120,
            "longitude": 32.72,
            "planting_date": "2025-11-15",
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert "latitude" in body["error"]["message"].lower()


def test_unsupported_crop_is_rejected(client):
    response = client.post(
        "/api/fields",
        json={
            "name": "Unknown crop",
            "latitude": 26.15,
            "longitude": 32.72,
            "crop_id": "corn",
            "planting_date": "2025-11-15",
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_missing_field_returns_friendly_404(client):
    response = client.get("/api/fields/999999/environment")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "NOT_FOUND"
    assert "deleted" in body["error"]["details"]


def test_environment_demo_response(client, field):
    response = client.get(f"/api/fields/{field['id']}/environment?mode=demo")
    assert response.status_code == 200
    body = response.json()

    assert body["is_demo"] is True
    assert body["start"] == "2025-11-01"
    assert body["end"] == "2026-03-10"
    assert body["source"]["nature"] == "reanalysis"
    assert body["summary"]["days_returned"] <= 366
    assert len(body["series"]) == body["summary"]["days_returned"]
    assert body["summary"]["latest_date"] is not None

    et0_values = [point["et0_mm_day"] for point in body["series"] if point["et0_mm_day"] is not None]
    assert et0_values, "ET₀ should be computable across the snapshot"
    assert all(value >= 0 for value in et0_values)
    assert any("coarse grid" in limitation.lower() for limitation in body["limitations"])


def test_environment_range_is_capped_without_error(client, field):
    # POWER coverage starts in 1981; a decade-long request is clamped, not fetched.
    response = client.get(
        f"/api/fields/{field['id']}/environment"
        "?start=1990-01-01&end=2026-01-01&mode=demo"
    )
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["days_returned"] <= 366
    assert body["start"] <= body["end"]


def test_reversed_explicit_range_is_rejected(client, field):
    response = client.get(
        f"/api/fields/{field['id']}/environment"
        "?start=2026-02-01&end=2026-01-01&mode=demo"
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_environment_trims_trailing_days_without_complete_et0():
    from app.services.environment import _trim_to_latest_complete
    from app.services.nasa_power import NasaDailySeries
    from app.services.processing import process_series

    start = date(2026, 11, 9)
    complete = {
        "t2m_mean_c": 22.0,
        "t2m_max_c": 30.0,
        "t2m_min_c": 15.0,
        "rh_mean_pct": 40.0,
        "precipitation_mm": 0.0,
        "wind_speed_2m_ms": 2.0,
        "solar_radiation_mj_m2_day": 18.0,
        "pressure_kpa": 100.0,
        "soil_moisture_root_fraction": 0.3,
    }
    values = {
        variable: {
            start: value,
            start + timedelta(days=1): value,
            start + timedelta(days=2): None,
        }
        for variable, value in complete.items()
    }
    series = NasaDailySeries(
        latitude=26.15,
        longitude=32.72,
        elevation_m=95.0,
        start=start,
        end=start + timedelta(days=2),
        values=values,
    )
    trimmed, dropped = _trim_to_latest_complete(series, process_series(series))
    assert dropped == 1
    assert trimmed.end == start + timedelta(days=1)


def test_post_harvest_analysis_reports_season_complete(client, monkeypatch):
    from app.services import nasa_power
    from app.services.nasa_power import NasaDailySeries

    created = client.post(
        "/api/fields",
        json={
            "name": "Old wheat field",
            "latitude": 26.15,
            "longitude": 32.72,
            "crop_id": "wheat",
            "planting_date": "2024-11-15",
            "soil_texture": "loam",
            "irrigation_system": "sprinkler",
        },
    )
    assert created.status_code == 201, created.text
    field_id = created.json()["id"]

    start = date(2024, 11, 15)
    end = date(2025, 6, 30)
    days = (end - start).days + 1
    values = {
        "t2m_mean_c": 22.0,
        "t2m_max_c": 30.0,
        "t2m_min_c": 15.0,
        "rh_mean_pct": 40.0,
        "precipitation_mm": 0.0,
        "wind_speed_2m_ms": 2.0,
        "solar_radiation_mj_m2_day": 18.0,
        "pressure_kpa": 100.0,
        "soil_moisture_root_fraction": 0.3,
    }
    series = NasaDailySeries(
        latitude=26.15,
        longitude=32.72,
        elevation_m=95.0,
        start=start,
        end=end,
        values={
            variable: {start + timedelta(days=offset): value for offset in range(days)}
            for variable, value in values.items()
        },
    )
    monkeypatch.setattr(nasa_power, "fetch_daily", lambda **_: series)
    monkeypatch.setattr(nasa_power, "fetch_climatology", lambda **_: None)

    try:
        irrigation = client.get(f"/api/fields/{field_id}/irrigation?mode=live&end=2025-06-30")
        assert irrigation.status_code == 200, irrigation.text
        irrigation_body = irrigation.json()
        assert irrigation_body["season_complete"] is True
        assert irrigation_body["status"] == "insufficient_data"
        assert irrigation_body["demand"] == "unknown"
        assert irrigation_body["stage"]["code"] == "post_harvest"

        health = client.get(f"/api/fields/{field_id}/health?mode=live&end=2025-06-30")
        assert health.status_code == 200, health.text
        health_body = health.json()
        assert health_body["season_complete"] is True
        assert health_body["status"] == "insufficient_data"
        assert health_body["indicators"] == []
    finally:
        client.delete(f"/api/fields/{field_id}")


def test_irrigation_demo_is_deterministic_and_grounded(client, field):
    response = client.get(f"/api/fields/{field['id']}/irrigation?mode=demo")
    assert response.status_code == 200
    body = response.json()

    assert body["is_demo"] is True
    assert body["status"] == "ok"
    assert body["demand"] in {"low", "moderate", "high"}
    assert body["confidence"]["level"] in {"medium", "low"}
    assert body["computed_for"] == "2026-03-10"
    assert body["stage"]["code"] in {"initial", "development", "mid", "late"}
    assert body["et0_mm_day"] is not None
    assert body["etc_mm_day"] == pytest.approx(body["kc"] * body["et0_mm_day"], abs=1e-3)
    assert body["net_requirement_mm"] is not None
    assert body["gross_requirement_mm"] is not None
    assert body["gross_requirement_mm"] >= body["net_requirement_mm"]
    assert body["source"]["nature"] == "calculated"
    assert any("I = 0" in limitation for limitation in body["limitations"])
    assert any("not a validated" in limitation.lower() for limitation in body["limitations"])


def test_health_demo_reports_five_indicators_and_no_diagnosis(client, field):
    response = client.get(f"/api/fields/{field['id']}/health?mode=demo")
    assert response.status_code == 200
    body = response.json()

    assert body["is_demo"] is True
    assert body["status"] in {"good", "moderate", "stressed", "insufficient_data"}
    assert {indicator["id"] for indicator in body["indicators"]} == {
        "heat",
        "frost",
        "water",
        "rain_anomaly",
        "vegetation",
    }
    assert body["computed_for"] == "2026-03-10"
    assert any("disease" in limitation.lower() for limitation in body["limitations"])

    # Earth Engine is unconfigured in tests, so vegetation must be honest.
    vegetation_indicator = next(i for i in body["indicators"] if i["id"] == "vegetation")
    assert vegetation_indicator["status"] == "unknown"
    assert vegetation_indicator["value"] is None


def test_vegetation_unavailable_without_earth_engine(client, field):
    response = client.get(f"/api/fields/{field['id']}/vegetation?mode=demo")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["series"] == []
    assert body["latest"] is None
    assert body["trend"] == "unknown"
    assert "Earth Engine" in (body["reason"] or "")

    live = client.get(f"/api/fields/{field['id']}/vegetation?mode=live")
    assert live.status_code == 200
    live_body = live.json()
    assert live_body["available"] is False
    assert live_body["latest"] is None
    assert "not configured" in (live_body["reason"] or "").lower()


def test_assistant_falls_back_to_rule_based_and_returns_context(client, field):
    response = client.post(
        "/api/assistant/chat",
        json={
            "field_id": field["id"],
            "message": "Why is irrigation demand high?",
            "mode": "demo",
        },
    )
    assert response.status_code == 200
    body = response.json()

    assert body["provider"] == "rule_based"
    assert body["reply"]
    assert body["is_demo"] is True
    assert "No AI model is configured" in body["notice"]
    assert "Qena" in body["notice"]

    context = body["context_used"]
    assert context["data_mode"] == "demo"
    assert context["field"]["id"] == field["id"]
    assert context["irrigation"]["status"] in {"ok", "insufficient_data"}
    assert context["provenance"]["environment_nature"] == "reanalysis"
    # The reply is grounded: the numerical demand class in prose matches context.
    assert context["irrigation"]["demand"] in body["reply"].lower()

    # The stored assistant message must keep the exact context for later viewing.
    conversation = client.get(f"/api/assistant/conversations/{field['id']}")
    assert conversation.status_code == 200
    messages = conversation.json()
    assistant_messages = [message for message in messages if message["role"] == "assistant"]
    assert assistant_messages
    assert assistant_messages[-1]["context_used"] == context


def test_assistant_missing_data_answer_is_grounded(client, field):
    response = client.post(
        "/api/assistant/chat",
        json={
            "field_id": field["id"],
            "message": "Which data is missing?",
            "mode": "demo",
        },
    )
    assert response.status_code == 200
    body = response.json()
    reply = body["reply"].lower()
    # NDVI is genuinely missing in tests, so an honest answer must mention it.
    assert "ndvi" in reply
    assert "missing" in reply or "unavailable" in reply


def test_assistant_rejects_unknown_field_and_short_questions(client, field):
    unknown = client.post(
        "/api/assistant/chat",
        json={"field_id": 999999, "message": "How much water?", "mode": "demo"},
    )
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "NOT_FOUND"

    short = client.post(
        "/api/assistant/chat",
        json={"field_id": field["id"], "message": "a", "mode": "demo"},
    )
    assert short.status_code == 422
    assert short.json()["error"]["code"] == "VALIDATION_ERROR"


def test_planting_date_validation_rejects_pre_1981(client):
    response = client.post(
        "/api/fields",
        json={
            "name": "Too old",
            "latitude": 26.15,
            "longitude": 32.72,
            "planting_date": "1970-01-01",
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert date.today()  # keep the import meaningful for future date-based checks
