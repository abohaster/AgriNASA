"""Tests for the post-calculation plausibility guardrail."""

from datetime import date

from app.schemas.farmer import FarmerForecastDay, FarmerWeather
from app.schemas.satellite import SoilMoistureOut, VegetationIndicesOut
from app.science import validation
from app.services.forecast import ForecastDay


def _vegetation(**overrides) -> VegetationIndicesOut:
    values = {
        "available": True,
        "ndvi": 0.55,
        "ndmi": 0.12,
        "ndwi": -0.12,
        "ndvi_condition": "dense",
        "ndmi_condition": "moderate",
        "interpretation": "test",
    }
    values.update(overrides)
    return VegetationIndicesOut(**values)


def _soil(**overrides) -> SoilMoistureOut:
    values = {
        "available": True,
        "category": "near_normal",
        "relative_score": 0.55,
        "relative_percent": 55.0,
        "vv_db": -14.2,
        "vh_db": -22.0,
        "vh_minus_vv_db": -7.8,
        "acquisition_date": date(2026, 11, 12),
        "scene_count": 4,
        "valid_pixels": 900,
        "interpretation": "test",
    }
    values.update(overrides)
    return SoilMoistureOut(**values)


def _weather(**overrides) -> FarmerWeather:
    values = {
        "available": True,
        "date": date(2026, 11, 12),
        "temperature_mean_c": 20.0,
        "temperature_max_c": 28.0,
        "temperature_min_c": 12.0,
        "humidity_pct": 55.0,
        "wind_ms": 2.5,
        "rain_mm": 0.0,
        "et0_mm_day": 3.2,
    }
    values.update(overrides)
    return FarmerWeather(**values)


def test_valid_indices_pass_unchanged():
    out, corrections = validation.validate_vegetation(_vegetation())

    assert corrections == []
    assert out.ndvi == 0.55
    assert out.ndmi == 0.12


def test_a_small_ndvi_overshoot_is_clamped_and_logged():
    out, corrections = validation.validate_vegetation(_vegetation(ndvi=1.01))

    assert out.ndvi == 1.0
    assert out.available is True
    assert "ndvi:clamped" in corrections


def test_a_gross_ndvi_outlier_is_rejected_not_shown():
    out, corrections = validation.validate_vegetation(_vegetation(ndvi=4.2, ndmi=None))

    assert out.available is False
    assert out.ndvi is None
    assert out.ndmi is None
    assert "ndvi:rejected" in corrections
    assert "plausibility" in (out.reason or "")


def test_a_wrong_condition_label_is_recomputed_from_the_verified_value():
    out, corrections = validation.validate_vegetation(
        _vegetation(ndvi=0.1, ndvi_condition="dense")
    )

    assert out.ndvi_condition == "sparse"
    assert "ndvi_condition:recomputed" in corrections


def test_percentage_above_one_hundred_is_clamped():
    out, corrections = validation.validate_soil(_soil(relative_percent=130.0))

    assert out.relative_percent == 100.0
    assert "relative_percent:clamped" in corrections


def test_soil_category_is_recomputed_from_verified_backscatter():
    out, corrections = validation.validate_soil(_soil(vv_db=-9.0, category="dry"))

    assert out.category == "wet"
    assert "category:recomputed" in corrections


def test_gross_backscatter_outlier_marks_wetness_unavailable():
    out, corrections = validation.validate_soil(_soil(vv_db=-120.0))

    assert out.available is False
    assert out.category == "unknown"
    assert out.vv_db is None
    assert "vv_db:rejected" in corrections


def test_weather_humidity_above_one_hundred_is_clamped():
    out, corrections = validation.validate_weather_values(_weather(humidity_pct=140.0))

    assert out.humidity_pct == 100.0
    assert "humidity_pct:clamped" in corrections


def test_a_gross_temperature_outlier_marks_weather_unavailable():
    out, corrections = validation.validate_weather_values(
        _weather(temperature_mean_c=-999.0)
    )

    assert out.available is False
    assert out.temperature_mean_c is None
    assert "temperature_mean_c:rejected" in corrections


def test_swapped_forecast_extremes_are_reordered():
    day = ForecastDay(
        date=date(2026, 11, 15),
        temperature_max_c=10.0,
        temperature_min_c=22.0,
        rain_mm=-0.5,
        wind_max_ms=2.0,
    )
    days, corrections = validation.validate_forecast_days([day])

    assert days[0].temperature_max_c == 22.0
    assert days[0].temperature_min_c == 10.0
    assert days[0].rain_mm == 0.0
    assert "forecast_day[0].temperature_range:recomputed" in corrections
    assert "forecast_day[0].rain_mm:clamped" in corrections


def test_percent_clamp_returns_an_integer():
    corrections: list[str] = []

    assert validation.clamp_percent(101.2, "readiness_percent", corrections) == 100
    assert corrections == ["readiness_percent:clamped"]
    assert validation.clamp_percent(48.6, "readiness_percent", corrections) == 49
