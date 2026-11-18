"""Tests for the simplified farmer-guide endpoint and its scores."""

from datetime import date, datetime, timedelta, timezone

from app.crops.calendar import get_calendar
from app.schemas.farmer import FarmerWeather
from app.schemas.satellite import (
    SatelliteAnalysisOut,
    SatelliteTilesOut,
    SoilMoistureOut,
    VegetationIndicesOut,
)
from app.services import farmer_summary as service
from app.services.forecast import ForecastDay, ForecastResult

WHEAT = get_calendar("wheat")
assert WHEAT is not None


def _weather(mean: float = 20.0, available: bool = True) -> FarmerWeather:
    return FarmerWeather(
        available=available,
        date=date(2026, 11, 12) if available else None,
        temperature_mean_c=mean if available else None,
        temperature_max_c=28.0 if available else None,
        temperature_min_c=12.0 if available else None,
        humidity_pct=55.0 if available else None,
        wind_ms=2.5 if available else None,
        rain_mm=0.0 if available else None,
        et0_mm_day=3.2 if available else None,
        reason=None if available else "NASA POWER is unavailable.",
    )


def _soil(category: str = "near_normal") -> SoilMoistureOut:
    return SoilMoistureOut(
        available=True,
        category=category,  # type: ignore[arg-type]
        relative_score=0.459,
        relative_percent=45.9,
        vv_db=-14.2,
        vh_db=-22.0,
        vh_minus_vv_db=-7.8,
        acquisition_date=date(2026, 11, 12),
        scene_count=6,
        valid_pixels=1200,
        reason=None,
        interpretation="Relative wetness is near the middle of the observed range.",
    )


def _vegetation(ndvi: float = 0.483, ndmi: float = 0.148) -> VegetationIndicesOut:
    return VegetationIndicesOut(
        available=True,
        ndvi=ndvi,
        ndmi=ndmi,
        ndwi=-0.1,
        ndvi_condition="moderate",
        ndmi_condition="moderate",
        acquisition_date=date(2026, 11, 10),
        scene_count=12,
        cloud_cover_percent=15.7,
        valid_fraction=0.82,
        composite=False,
        interpretation="Moderate canopy cover.",
    )


def _reading(
    soil_category: str = "near_normal", ndvi: float = 0.483, ndmi: float = 0.148
) -> service._SatelliteReading:
    return service._SatelliteReading(
        available=True,
        soil=_soil(soil_category),
        vegetation=_vegetation(ndvi, ndmi),
        reason_code="ok",
        reason=None,
    )


def _forecast() -> ForecastResult:
    first = date(2026, 11, 14)
    return ForecastResult(
        available=True,
        days=[
            ForecastDay(
                date=first + timedelta(days=index),
                temperature_max_c=31.8,
                temperature_min_c=12.6,
                rain_mm=0.0,
                wind_max_ms=2.4,
            )
            for index in range(5)
        ],
    )


def _analysis() -> SatelliteAnalysisOut:
    return SatelliteAnalysisOut(
        field_id=None,
        area_ha=78.5,
        geometry_source="point_buffer",
        start=date(2026, 9, 15),
        end=date(2026, 11, 14),
        soil_moisture=_soil(),
        vegetation=_vegetation(),
        tiles=SatelliteTilesOut(),
        sources=[],
        limitations=[],
        generated_at=datetime.now(timezone.utc),
    )


# ── Scores ──────────────────────────────────────────────────────────────────


def test_wheat_month_scores_follow_the_calendar():
    assert service.month_score(WHEAT, 11) == service.MONTH_SCORE_IDEAL
    assert service.month_score(WHEAT, 10) == service.MONTH_SCORE_ACCEPTABLE
    assert service.month_score(WHEAT, 12) == service.MONTH_SCORE_ACCEPTABLE
    assert service.month_score(WHEAT, 6) == service.MONTH_SCORE_OUTSIDE


def test_temperature_score_penalises_each_degree_outside_the_optimum():
    assert service.temperature_score(WHEAT, 20.0) == 100
    assert service.temperature_score(WHEAT, 27.0) == 80
    assert service.temperature_score(WHEAT, 33.0) == 20
    assert service.temperature_score(WHEAT, 35.0) == 0
    assert service.temperature_score(WHEAT, 0.0) == 0


def test_health_percent_blends_ndvi_and_ndmi_and_maps_to_a_rating():
    percent = service.health_percent(0.483, 0.148)
    assert percent == 53
    assert service.health_rating(percent) == "fair"

    excellent = service.health_percent(0.80, 0.30)
    assert excellent == 88
    assert service.health_rating(excellent) == "excellent"

    assert service.health_rating(service.health_percent(0.20, -0.05)) in {"poor", "weak"}


# ── Service behaviour ───────────────────────────────────────────────────────


def test_plant_now_in_season_is_suitable_with_a_full_score(monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather())
    monkeypatch.setattr(service, "_run_satellite", lambda lat, lon, today, geometry=None: _reading())
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    summary = service.build_farmer_summary(
        latitude=26.15,
        longitude=32.72,
        crop_id="wheat",
        intent="plant_now",
        today=date(2026, 11, 14),
    )

    assert summary.available is True
    assert summary.health is None
    assert summary.planting is not None
    assert summary.planting.verdict == "suitable"
    assert summary.planting.readiness_percent == 100
    assert summary.planting.primary_reason == "in_ideal_season"
    assert summary.soil.advice == "ready_to_plant"
    assert summary.soil.acquisition_date == date(2026, 11, 12)


def test_plant_now_outside_the_season_is_not_suitable(monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather(mean=20.0))
    monkeypatch.setattr(service, "_run_satellite", lambda lat, lon, today, geometry=None: _reading())
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    summary = service.build_farmer_summary(
        latitude=26.15,
        longitude=32.72,
        crop_id="wheat",
        intent="plant_now",
        today=date(2026, 6, 15),
    )

    assert summary.planting is not None
    assert summary.planting.verdict == "not_suitable"
    assert summary.planting.primary_reason == "outside_planting_season"
    assert summary.planting.readiness_percent is not None
    assert summary.planting.readiness_percent < 75


def test_saturated_soil_keeps_the_readiness_low_enough_for_the_verdict(monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather(mean=20.0))
    monkeypatch.setattr(
        service, "_run_satellite", lambda lat, lon, today, geometry=None: _reading(soil_category="wet")
    )
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    summary = service.build_farmer_summary(
        latitude=26.15,
        longitude=32.72,
        crop_id="wheat",
        intent="plant_now",
        today=date(2026, 11, 14),
    )

    assert summary.planting is not None
    assert summary.planting.verdict == "not_suitable"
    assert summary.planting.primary_reason == "soil_saturated"
    assert summary.planting.readiness_percent is not None
    assert summary.planting.readiness_percent < 50


def test_plant_now_with_dry_soil_asks_for_irrigation_before_sowing(monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather())
    monkeypatch.setattr(
        service, "_run_satellite", lambda lat, lon, today, geometry=None: _reading(soil_category="dry")
    )
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    summary = service.build_farmer_summary(
        latitude=26.15,
        longitude=32.72,
        crop_id="wheat",
        intent="plant_now",
        today=date(2026, 11, 14),
    )

    assert summary.soil.advice == "irrigate_before_planting"
    assert summary.planting is not None
    assert summary.planting.primary_reason == "soil_dry"
    assert summary.planting.verdict == "marginal"


def test_already_planted_translates_indices_into_health_and_advice(monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather())
    monkeypatch.setattr(
        service, "_run_satellite", lambda lat, lon, today, geometry=None: _reading(soil_category="dry")
    )
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    summary = service.build_farmer_summary(
        latitude=26.15,
        longitude=32.72,
        crop_id="wheat",
        intent="already_planted",
        today=date(2026, 11, 14),
    )

    assert summary.planting is None
    assert summary.health is not None
    assert summary.health.available is True
    assert summary.health.percent == 53
    assert summary.health.rating == "fair"
    assert summary.health.ndvi == 0.483
    assert summary.soil.advice == "irrigate_today"
    assert summary.outlook.available is True
    assert summary.outlook.headline == "heat"
    assert "irrigate_early_morning" in summary.outlook.advice


def test_weather_failure_leaves_the_readiness_unavailable(monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather(available=False))
    monkeypatch.setattr(service, "_run_satellite", lambda lat, lon, today, geometry=None: _reading())
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    summary = service.build_farmer_summary(
        latitude=26.15,
        longitude=32.72,
        crop_id="wheat",
        intent="plant_now",
        today=date(2026, 11, 14),
    )

    assert summary.planting is not None
    assert summary.planting.verdict == "unknown"
    assert summary.planting.readiness_percent is None
    assert summary.planting.primary_reason == "weather_unavailable"


def test_missing_satellite_reading_is_reported_not_guessed(monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather())
    monkeypatch.setattr(
        service,
        "_run_satellite",
        lambda lat, lon, today, geometry=None: service._SatelliteReading(
            available=False,
            soil=None,
            vegetation=None,
            reason_code="satellite_not_configured",
            reason="Satellite analysis is not configured on this server.",
        ),
    )
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    summary = service.build_farmer_summary(
        latitude=26.15,
        longitude=32.72,
        crop_id="wheat",
        intent="already_planted",
        today=date(2026, 11, 14),
    )

    assert summary.health is not None
    assert summary.health.available is False
    assert summary.health.percent is None
    assert summary.health.reason_code == "satellite_not_configured"
    assert summary.soil.available is False
    assert summary.soil.advice == "check_soil_moisture"


# ── Timeline guidance ───────────────────────────────────────────────────────


def test_pre_planting_timeline_lists_preparation_and_sowing_actions(monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather())
    monkeypatch.setattr(
        service,
        "_run_satellite",
        lambda lat, lon, today, geometry=None: _reading(soil_category="dry"),
    )
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    summary = service.build_farmer_summary(
        latitude=26.15,
        longitude=32.72,
        crop_id="wheat",
        intent="plant_now",
        today=date(2026, 11, 14),
    )

    timeline = summary.timeline
    assert timeline is not None
    assert timeline.stage == "pre_planting"
    assert timeline.emergence_from is None
    assert timeline.seed_depth_cm_min == 3.0
    assert timeline.seed_depth_cm_max == 5.0
    assert "dry_seedbed" in timeline.risks
    assert "heat_stress" in timeline.risks
    for action in (
        "prepare_seedbed",
        "pre_irrigate",
        "sow_now",
        "sow_at_depth",
        "apply_basal_fertiliser",
    ):
        assert action in timeline.actions


def test_early_growth_timeline_computes_the_emergence_window(monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather())
    monkeypatch.setattr(
        service,
        "_run_satellite",
        lambda lat, lon, today, geometry=None: _reading(soil_category="dry"),
    )
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    summary = service.build_farmer_summary(
        latitude=26.15,
        longitude=32.72,
        crop_id="wheat",
        intent="already_planted",
        today=date(2026, 11, 14),
        days_since_planting=7,
    )

    timeline = summary.timeline
    assert timeline is not None
    assert timeline.stage == "early_growth"
    assert timeline.planting_date == date(2026, 11, 7)
    assert timeline.emergence_from == date(2026, 11, 12)
    assert timeline.emergence_to == date(2026, 11, 17)
    assert "dry_seedbed" in timeline.risks
    assert "light_irrigation" in timeline.actions
    for action in ("monitor_seedbed", "check_emergence", "protect_young_roots", "scout_weeds", "scout_pests"):
        assert action in timeline.actions


def test_past_emergence_is_flagged_for_an_old_sowing(monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather())
    monkeypatch.setattr(service, "_run_satellite", lambda lat, lon, today, geometry=None: _reading())
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    summary = service.build_farmer_summary(
        latitude=26.15,
        longitude=32.72,
        crop_id="wheat",
        intent="already_planted",
        today=date(2026, 11, 14),
        days_since_planting=21,
    )

    assert summary.timeline is not None
    assert summary.timeline.stage == "early_growth"
    assert "past_emergence_window" in summary.timeline.risks


def test_an_established_crop_gets_monitoring_advice_only(monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather())
    monkeypatch.setattr(service, "_run_satellite", lambda lat, lon, today, geometry=None: _reading())
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    summary = service.build_farmer_summary(
        latitude=26.15,
        longitude=32.72,
        crop_id="wheat",
        intent="already_planted",
        today=date(2026, 11, 14),
        days_since_planting=60,
    )

    timeline = summary.timeline
    assert timeline is not None
    assert timeline.stage == "established"
    assert timeline.emergence_from is None
    assert timeline.seed_depth_cm_min is None
    assert "monitor_crop" in timeline.actions
    assert "check_emergence" not in timeline.actions


def test_request_geometry_reaches_the_satellite_analysis(monkeypatch):
    captured: dict = {}

    def fake_analyze(request):
        captured["request"] = request
        return _analysis()

    monkeypatch.setattr(service.satellite_service, "analyze", fake_analyze)
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather())
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    polygon = {
        "type": "Polygon",
        "coordinates": [
            [[30.938, 30.793], [30.942, 30.793], [30.942, 30.797], [30.938, 30.797], [30.938, 30.793]]
        ],
    }
    summary = service.build_farmer_summary(
        latitude=30.7951,
        longitude=30.9402,
        crop_id="wheat",
        intent="already_planted",
        today=date(2026, 11, 14),
        days_since_planting=7,
        geometry=polygon,
    )

    assert summary.available is True
    request = captured["request"]
    assert request.geometry == polygon
    assert request.geometry_source == "polygon"
    assert request.include_tiles is True


def test_demo_fields_endpoint_returns_real_polygons_for_each_crop(client):
    response = client.get("/api/farmer-demo-fields")
    assert response.status_code == 200

    fields = response.json()
    assert len(fields) == 4
    assert {field["id"] for field in fields} == {
        "delta_irrigated",
        "nubaria_reclamation",
        "sharqia_prepared",
        "luxor_tomato",
    }
    assert {field["crop_id"] for field in fields} == {"wheat", "potato", "tomato"}
    for field in fields:
        assert field["geometry"]["type"] == "Polygon"
        assert field["geometry"]["coordinates"][0][0] == field["geometry"]["coordinates"][0][-1]
        assert -90 <= field["latitude"] <= 90
        assert -180 <= field["longitude"] <= 180
        assert field["name_ar"]


# ── HTTP contract ───────────────────────────────────────────────────────────


def test_farmer_endpoint_rejects_an_unknown_crop(client):
    response = client.post(
        "/api/farmer-summary",
        json={
            "latitude": 26.15,
            "longitude": 32.72,
            "crop_id": "banana",
            "intent": "plant_now",
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert "wheat" in (body["error"]["details"] or "")


def test_farmer_endpoint_demo_mode_is_explicit(client):
    response = client.post(
        "/api/farmer-summary?mode=demo",
        json={
            "latitude": 26.15,
            "longitude": 32.72,
            "crop_id": "wheat",
            "intent": "already_planted",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["is_demo"] is True
    assert body["reason_code"] == "demo_mode_not_supported"
    assert body["health"] is None
    assert body["crop"]["id"] == "wheat"


def test_farmer_endpoint_returns_both_scenarios(client, monkeypatch):
    monkeypatch.setattr(service, "_fetch_weather", lambda lat, lon: _weather())
    monkeypatch.setattr(service, "_run_satellite", lambda lat, lon, today, geometry=None: _reading())
    monkeypatch.setattr(service.forecast_service, "fetch_forecast", lambda lat, lon: _forecast())

    common = {"latitude": 26.15, "longitude": 32.72, "crop_id": "wheat"}
    planted = client.post(
        "/api/farmer-summary", json={**common, "intent": "already_planted"}
    )
    assert planted.status_code == 200
    body = planted.json()
    assert body["health"]["percent"] == 53
    assert body["health"]["rating"] == "fair"
    assert body["weather"]["temperature_mean_c"] == 20.0
    assert body["forecast"]["provider"] == "Open-Meteo"
    assert len(body["forecast"]["days"]) == 5
    assert any(source["id"] == "open-meteo-forecast" for source in body["sources"])
    assert body["timeline"]["stage"] == "established"
    assert "tiles" in body
    assert body["corrections"] == []

    planting = client.post("/api/farmer-summary", json={**common, "intent": "plant_now"})
    assert planting.status_code == 200
    assert planting.json()["planting"]["verdict"] == "suitable"
    assert planting.json()["timeline"]["stage"] == "pre_planting"


def test_farmer_endpoint_rejects_an_open_polygon(client):
    response = client.post(
        "/api/farmer-summary",
        json={
            "latitude": 30.7951,
            "longitude": 30.9402,
            "crop_id": "wheat",
            "intent": "plant_now",
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [[30.938, 30.793], [30.942, 30.793], [30.942, 30.797], [30.938, 30.797]]
                ],
            },
        },
    )
    assert response.status_code == 422
