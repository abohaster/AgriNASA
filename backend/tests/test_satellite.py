"""Satellite (Earth Engine) validation and pure-science tests.

The suite never calls Google Earth Engine: no credentials exist in the test
environment, so the live path must honestly report `GEE_UNAVAILABLE`.
"""

from datetime import date, timedelta

import pytest

from app.science import sar_moisture
from app.services.satellite import parse_stored_boundary

TODAY = date.today()
SQUARE = {
    "type": "Polygon",
    "coordinates": [
        [
            [32.70, 26.14],
            [32.74, 26.14],
            [32.74, 26.16],
            [32.70, 26.16],
            [32.70, 26.14],
        ]
    ],
}


# ── Pure SAR / optical classification ──────────────────────────────────────
@pytest.mark.parametrize(
    ("vv_db", "expected"),
    [
        (-22.0, "dry"),
        (-17.5, "dry"),
        (-17.0, "near_normal"),
        (-14.0, "near_normal"),
        (-12.0, "near_normal"),
        (-11.9, "wet"),
        (-6.0, "wet"),
        (None, "unknown"),
    ],
)
def test_wetness_category_thresholds(vv_db, expected):
    assert sar_moisture.wetness_category(vv_db) == expected


def test_relative_wetness_score_is_bounded():
    assert sar_moisture.relative_wetness_score(None) is None
    assert sar_moisture.relative_wetness_score(-30.0) == 0.0
    assert sar_moisture.relative_wetness_score(0.0) == 1.0
    assert sar_moisture.relative_wetness_score(-13.5) == 0.5


@pytest.mark.parametrize(
    ("ndvi", "expected"),
    [(0.05, "sparse"), (0.2, "moderate"), (0.5, "moderate"), (0.7, "dense"), (None, "unknown")],
)
def test_vegetation_condition(ndvi, expected):
    assert sar_moisture.vegetation_condition(ndvi) == expected


@pytest.mark.parametrize(
    ("ndmi", "expected"),
    [(-0.4, "low"), (-0.001, "low"), (0.0, "moderate"), (0.2, "moderate"), (0.45, "high"), (None, "unknown")],
)
def test_moisture_condition(ndmi, expected):
    assert sar_moisture.moisture_condition(ndmi) == expected


def test_interpretations_never_claim_volumetric_moisture():
    text = sar_moisture.wetness_interpretation(-9.0)
    assert "volumetric" not in text
    assert "surface" in text.lower()
    assert "disease" in sar_moisture.vegetation_interpretation(0.6, 0.3)


# ── Request validation ─────────────────────────────────────────────────────
def test_requires_a_spatial_input(client):
    response = client.post("/api/satellite/analyze-field", json={})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_rejects_polygon_and_point_together(client):
    response = client.post(
        "/api/satellite/analyze-field",
        json={"geometry": SQUARE, "latitude": 26.15, "longitude": 32.72},
    )
    assert response.status_code == 422


def test_rejects_open_polygon(client):
    open_ring = {
        "type": "Polygon",
        "coordinates": [[[32.70, 26.14], [32.74, 26.14], [32.74, 26.16], [32.70, 26.16]]],
    }
    response = client.post("/api/satellite/analyze-field", json={"geometry": open_ring})
    assert response.status_code == 422


def test_rejects_future_end_date(client):
    response = client.post(
        "/api/satellite/analyze-field",
        json={
            "latitude": 26.15,
            "longitude": 32.72,
            "end": (TODAY + timedelta(days=1)).isoformat(),
        },
    )
    assert response.status_code == 422


def test_rejects_range_longer_than_cap(client):
    response = client.post(
        "/api/satellite/analyze-field",
        json={
            "latitude": 26.15,
            "longitude": 32.72,
            "start": (TODAY - timedelta(days=120)).isoformat(),
            "end": TODAY.isoformat(),
        },
    )
    assert response.status_code == 422


def test_rejects_start_after_end(client):
    response = client.post(
        "/api/satellite/analyze-field",
        json={
            "latitude": 26.15,
            "longitude": 32.72,
            "start": TODAY.isoformat(),
            "end": (TODAY - timedelta(days=5)).isoformat(),
        },
    )
    assert response.status_code == 422


@pytest.mark.parametrize("buffer_km", [0.05, 30])
def test_rejects_buffer_outside_bounds(client, buffer_km):
    response = client.post(
        "/api/satellite/analyze-field",
        json={"latitude": 26.15, "longitude": 32.72, "buffer_km": buffer_km},
    )
    assert response.status_code == 422


# ── Defaults and honest unconfigured behaviour ─────────────────────────────
def test_defaults_are_last_thirty_days_and_half_km_buffer():
    from app.schemas.satellite import SatelliteRequest

    request = SatelliteRequest(latitude=26.15, longitude=32.72)
    assert request.end == TODAY
    assert request.start == TODAY - timedelta(days=30)
    assert request.buffer_km == 0.5
    assert request.max_cloud_percent == 30
    assert request.geometry_source == "point_buffer"


def test_unconfigured_gee_returns_typed_503(client):
    response = client.post(
        "/api/satellite/analyze-field", json={"latitude": 26.15, "longitude": 32.72}
    )
    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "GEE_UNAVAILABLE"
    assert error["details"] == "GEE_NOT_CONFIGURED"
    assert "not configured" in error["message"]
    assert "Traceback" not in response.text


@pytest.mark.parametrize(
    ("message", "transient"),
    [
        ("Caller does not have required permission to use project p. Grant the caller "
         "the roles/serviceusage.serviceUsageConsumer role.", True),
        ("Propagation of the new permission may take a few minutes.", True),
        ("Backend error: computation timed out.", True),
        ("User memory limit exceeded.", False),
    ],
)
def test_only_transient_provider_errors_are_retried(message, transient):
    from app.services.satellite import _is_transient

    assert _is_transient(RuntimeError(message)) is transient


def test_public_analyze_field_alias_matches_satellite_route(client):
    response = client.post(
        "/api/analyze-field", json={"latitude": 26.15, "longitude": 32.72}
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "GEE_UNAVAILABLE"


def test_stored_field_uses_same_honest_failure(client, field):
    response = client.post(f"/api/satellite/fields/{field['id']}", json={})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "GEE_UNAVAILABLE"


def test_missing_field_returns_404(client):
    response = client.post("/api/satellite/fields/999999", json={})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


# ── Stored boundary parsing ────────────────────────────────────────────────
def test_parse_stored_boundary_accepts_polygon():
    import json

    assert parse_stored_boundary(json.dumps(SQUARE)) == SQUARE


@pytest.mark.parametrize("raw", [None, "", "not json", '{"type":"Point","coordinates":[1,2]}'])
def test_parse_stored_boundary_ignores_invalid(raw):
    assert parse_stored_boundary(raw) is None
