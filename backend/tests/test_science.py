"""
Unit tests for the deterministic science layer.

These tests pin the equations and thresholds that farmers may act on. They are
intentionally explicit about numbers so a future refactor cannot silently move a
boundary (e.g. the 0.55 / 0.80 depletion classes) without a failing test.
"""

from datetime import date

import pytest

from app.crops import get_crop
from app.science.crop_coefficient import (
    crop_evapotranspiration,
    days_after_planting,
    root_depth_m,
    stage_for_day,
)
from app.science.et0 import (
    Et0Inputs,
    compute_et0,
    extraterrestrial_radiation,
    pressure_from_elevation,
)
from app.science.irrigation import (
    ConfidenceFactors,
    assess_confidence,
    classify_demand,
    refill_requirements,
)
from app.science.stress import (
    DailyTemperature,
    assess_health,
    frost_indicator,
    heat_stress_indicator,
    rainfall_anomaly_indicator,
    summarise_indicator_agreement,
    vegetation_indicator,
    water_stress_indicator,
)
from app.science.vegetation_indices import (
    ndvi,
    ndvi_trend,
    normalized_difference,
    two_scene_trend,
)
from app.science.water_balance import (
    BalanceDayInput,
    get_soil_properties,
    simulate_water_balance,
    total_available_water_mm,
)
from app.services.processing import (
    add_days,
    monthly_rainfall_normal_mm_per_day,
    normal_30_day_rainfall_mm,
    recent_precipitation_total,
    subset_points,
)

WHEAT = get_crop("wheat")


def wheat_inputs(**overrides) -> Et0Inputs:
    values = dict(
        day=date(2026, 1, 15),
        latitude_deg=26.15,
        elevation_m=96.0,
        tmax_c=24.0,
        tmin_c=10.0,
        rh_mean_pct=55.0,
        wind_speed_2m_ms=2.5,
        solar_radiation_mj_m2_day=15.0,
        pressure_kpa=100.1,
    )
    values.update(overrides)
    return Et0Inputs(**values)


# ── ET₀ ─────────────────────────────────────────────────────────────────────


def test_et0_typical_qena_day_is_plausible():
    result = compute_et0(wheat_inputs())
    assert result.missing_inputs == []
    assert result.et0_mm_day is not None
    # A clear, mild winter day in Upper Egypt commonly evaporates 2–6 mm/day.
    assert 1.0 < result.et0_mm_day < 8.0
    assert result.components["pressure_kpa"] == pytest.approx(100.1, abs=0.01)


def test_et0_missing_wind_is_not_invented():
    result = compute_et0(wheat_inputs(wind_speed_2m_ms=None))
    assert result.et0_mm_day is None
    assert "Wind speed at 2 m" in result.missing_inputs


def test_et0_rejects_tmax_below_tmin():
    result = compute_et0(wheat_inputs(tmax_c=8.0, tmin_c=14.0))
    assert result.et0_mm_day is None
    assert any("Maximum temperature is below minimum" in note for note in result.notes)


def test_et0_rejects_humidity_outside_physical_range():
    result = compute_et0(wheat_inputs(rh_mean_pct=130.0))
    assert result.et0_mm_day is None
    assert any("Relative humidity is outside" in note for note in result.notes)


def test_et0_pressure_falls_back_to_elevation():
    result = compute_et0(wheat_inputs(pressure_kpa=None))
    expected = pressure_from_elevation(96.0)
    assert result.et0_mm_day is not None
    assert result.components["pressure_kpa"] == pytest.approx(expected, abs=0.01)
    assert any("estimated from elevation" in note for note in result.notes)


def test_et0_is_clamped_to_zero_on_a_cold_negative_radiation_day():
    # Cold, humid, high-latitude winter day: net radiation is negative and the
    # aerodynamic term is zero, so the raw equation returns a negative number.
    result = compute_et0(
        Et0Inputs(
            day=date(2026, 12, 21),
            latitude_deg=60.0,
            elevation_m=0.0,
            tmax_c=-5.0,
            tmin_c=-15.0,
            rh_mean_pct=100.0,
            wind_speed_2m_ms=0.5,
            solar_radiation_mj_m2_day=1.5,
            pressure_kpa=None,
        )
    )
    assert result.et0_mm_day == 0.0
    assert any("negative" in note for note in result.notes)


def test_extraterrestrial_radiation_is_positive_and_seasonal():
    january = extraterrestrial_radiation(26.15, 15)
    july = extraterrestrial_radiation(26.15, 196)
    assert 10.0 < january < 30.0
    assert january < july  # Northern-hemisphere summer has more top-of-atmosphere radiation.


# ── Crop coefficient and root depth ─────────────────────────────────────────


def test_wheat_profile_has_documented_fao56_stages():
    assert WHEAT.season_length_days == 150
    assert [stage.code for stage in WHEAT.stages] == ["initial", "development", "mid", "late"]
    assert WHEAT.depletion_fraction_p == 0.55


def test_stage_boundaries_and_before_after_crop():
    assert stage_for_day(WHEAT, -1).code == "pre_planting"
    assert stage_for_day(WHEAT, -1).kc is None

    initial = stage_for_day(WHEAT, 0)
    assert initial.code == "initial"
    assert initial.kc == pytest.approx(0.40)

    development = stage_for_day(WHEAT, 20)
    assert development.code == "development"
    assert development.kc == pytest.approx(0.40)

    mid = stage_for_day(WHEAT, 50)
    assert mid.code == "mid"
    assert mid.kc == pytest.approx(1.15)

    late = stage_for_day(WHEAT, 110)
    assert late.code == "late"
    assert late.kc == pytest.approx(1.15)

    harvested = stage_for_day(WHEAT, 150)
    assert harvested.code == "post_harvest"
    assert harvested.kc is None


def test_kc_interpolates_linearly_in_development_and_late_season():
    halfway_development = stage_for_day(WHEAT, 35)  # 15 of 30 days into development.
    assert halfway_development.kc == pytest.approx(0.775, abs=1e-4)

    near_harvest = stage_for_day(WHEAT, 149)
    assert 0.30 <= near_harvest.kc < 0.40


def test_root_depth_and_et_relationships():
    assert root_depth_m(WHEAT, 0.0) == pytest.approx(0.15)
    assert root_depth_m(WHEAT, 1.0) == pytest.approx(1.5)
    assert root_depth_m(WHEAT, 0.5) == pytest.approx(0.825)
    assert root_depth_m(WHEAT, None) == pytest.approx(WHEAT.root_depth_initial_m)

    assert crop_evapotranspiration(1.15, 5.0) == pytest.approx(5.75)
    assert crop_evapotranspiration(None, 5.0) is None
    assert crop_evapotranspiration(1.15, None) is None

    planting = date(2025, 11, 15)
    assert days_after_planting(planting, date(2025, 11, 25)) == 10


# ── Root-zone water balance ─────────────────────────────────────────────────


def test_soil_texture_fallback_and_total_available_water():
    loam = get_soil_properties("loam")
    assert (loam.field_capacity, loam.wilting_point) == (0.29, 0.14)

    fallback = get_soil_properties("moon_dust")
    assert fallback.texture == "loam"

    # 1000 × (0.29 − 0.14) × 0.15 m = 22.5 mm at emergence.
    assert total_available_water_mm(loam, 0.15) == pytest.approx(22.5)


def _single_day(*, dap: int, et0: float | None, precip: float | None) -> BalanceDayInput:
    return BalanceDayInput(
        day=date(2025, 11, 15),
        days_after_planting=dap,
        precipitation_mm=precip,
        et0_mm_day=et0,
    )


def test_initial_depletion_is_half_of_taw():
    result = simulate_water_balance(
        profile=WHEAT,
        soil=get_soil_properties("loam"),
        days=[_single_day(dap=0, et0=0.0, precip=0.0)],
    )
    assert result.initial_depletion_mm == pytest.approx(11.25)
    assert result.final_depletion_mm == pytest.approx(11.25)
    assert result.stress_days == 0


def test_rainfall_refills_bucket_and_excess_becomes_drainage():
    result = simulate_water_balance(
        profile=WHEAT,
        soil=get_soil_properties("loam"),
        days=[_single_day(dap=0, et0=0.0, precip=50.0)],
    )
    # 10 % runoff leaves 45 mm effective rain against 11.25 mm depletion.
    assert result.runoff_total_mm == pytest.approx(5.0)
    assert result.drainage_total_mm == pytest.approx(33.75)
    assert result.final_depletion_mm == 0.0


def test_crop_water_use_depletes_the_bucket():
    result = simulate_water_balance(
        profile=WHEAT,
        soil=get_soil_properties("loam"),
        days=[_single_day(dap=0, et0=2.0, precip=None)],
    )
    # ETc = 0.40 × 2.0 = 0.8 mm; 11.25 + 0.8 = 12.05 mm.
    assert result.records[0].etc_mm_day == pytest.approx(0.8)
    assert result.final_depletion_mm == pytest.approx(12.05)
    assert result.records[0].stressed is False


def test_missing_et0_is_counted_not_interpolated():
    result = simulate_water_balance(
        profile=WHEAT,
        soil=get_soil_properties("loam"),
        days=[_single_day(dap=0, et0=None, precip=0.0)],
    )
    assert result.excluded_et0_days == 1
    assert result.records[0].etc_mm_day is None
    assert result.final_depletion_mm == pytest.approx(11.25)


def test_stress_is_flagged_at_readily_available_water_limit():
    result = simulate_water_balance(
        profile=WHEAT,
        soil=get_soil_properties("loam"),
        days=[_single_day(dap=100, et0=9.0, precip=0.0)],
    )
    assert result.stress_days == 1
    assert result.records[0].stressed is True
    # Mid-season Kc is 1.15, so ETc = 10.35 mm and the bucket crosses RAW.
    assert result.records[0].etc_mm_day == pytest.approx(10.35)


def test_water_balance_requires_at_least_one_day():
    with pytest.raises(ValueError):
        simulate_water_balance(
            profile=WHEAT, soil=get_soil_properties("loam"), days=[]
        )


# ── NDVI ────────────────────────────────────────────────────────────────────


def test_normalized_difference_and_ndvi_formula():
    assert ndvi(0.8, 0.2) == pytest.approx(0.6)
    assert ndvi(0.2, 0.8) == pytest.approx(-0.6)
    assert ndvi(0.0, 0.0) is None
    assert ndvi(1.2, 0.3) is None
    assert normalized_difference(0.5, 0.5) == 0.0


def test_ndvi_trend_directions_and_unknown():
    assert ndvi_trend([0.2, 0.2, 0.2, 0.5, 0.5, 0.5]) == "improving"
    assert ndvi_trend([0.6, 0.6, 0.6, 0.3, 0.3, 0.3]) == "declining"
    assert ndvi_trend([0.4, 0.4, 0.4, 0.4]) == "stable"
    assert ndvi_trend([0.4, 0.4, 0.4]) == "unknown"


def test_two_scene_trend_uses_the_same_noise_threshold():
    assert two_scene_trend(0.30, 0.50) == "improving"
    assert two_scene_trend(0.60, 0.35) == "declining"
    assert two_scene_trend(0.42, 0.44) == "stable"
    assert two_scene_trend(0.42, 1.4) == "unknown"
    assert two_scene_trend(-2.0, 0.2) == "unknown"


# ── Environmental stress indicators ─────────────────────────────────────────


def _temperature_days(count: int, tmax: float | None, tmin: float | None) -> list[DailyTemperature]:
    return [
        DailyTemperature(day=date(2026, 1, 1), tmax_c=tmax, tmin_c=tmin) for _ in range(count)
    ]


def test_heat_indicator_thresholds():
    stress = heat_stress_indicator(_temperature_days(14, 32.0, 18.0))
    assert stress.status == "stress"
    assert stress.value == 14

    watch = heat_stress_indicator(
        _temperature_days(12, 25.0, 15.0) + _temperature_days(2, 31.0, 18.0)
    )
    assert watch.status == "watch"
    assert watch.value == 2

    good = heat_stress_indicator(_temperature_days(14, 24.0, 12.0))
    assert good.status == "good"

    unknown = heat_stress_indicator(_temperature_days(14, None, 12.0))
    assert unknown.status == "unknown"
    assert unknown.value is None


def test_frost_indicator_thresholds():
    stress = frost_indicator(_temperature_days(14, 8.0, -2.0))
    assert stress.status == "stress"
    assert stress.value == 14

    watch = frost_indicator(_temperature_days(13, 8.0, 2.0) + _temperature_days(1, 8.0, -0.5))
    assert watch.status == "watch"

    good = frost_indicator(_temperature_days(14, 18.0, 5.0))
    assert good.status == "good"


def test_water_stress_indicator_thresholds():
    assert water_stress_indicator(0.85, 3).status == "stress"
    assert water_stress_indicator(0.60, 1).status == "watch"
    assert water_stress_indicator(0.30, 0).status == "good"
    assert water_stress_indicator(None, 0).status == "unknown"


def test_rainfall_anomaly_thresholds():
    assert rainfall_anomaly_indicator(20.0, 50.0).status == "stress"  # −60 %
    assert rainfall_anomaly_indicator(35.0, 50.0).status == "watch"  # −30 %
    assert rainfall_anomaly_indicator(110.0, 50.0).status == "watch"  # +120 %
    assert rainfall_anomaly_indicator(50.0, 50.0).status == "good"  # 0 %
    assert rainfall_anomaly_indicator(10.0, 0.0).status == "unknown"

    short_window = rainfall_anomaly_indicator(None, 12.0, available_days=9)
    assert short_window.status == "unknown"
    assert "only 9 day(s) are available since planting" in short_window.interpretation


def test_vegetation_indicator_never_guesses_without_a_provider():
    unknown = vegetation_indicator(available=False, latest_ndvi=0.6, trend="improving")
    assert unknown.status == "unknown"
    assert unknown.value is None

    improving = vegetation_indicator(available=True, latest_ndvi=0.6, trend="improving")
    assert improving.status == "good"

    declining = vegetation_indicator(available=True, latest_ndvi=0.4, trend="declining")
    assert declining.status == "watch"


def test_assess_health_requires_two_known_indicators():
    only_one = [water_stress_indicator(0.30, 0), water_stress_indicator(None, 0)]
    assert assess_health(only_one).status == "insufficient_data"


def test_assess_health_any_stress_dominates():
    indicators = [
        water_stress_indicator(0.30, 0),
        heat_stress_indicator(_temperature_days(14, 33.0, 18.0)),
    ]
    assessment = assess_health(indicators)
    assert assessment.status == "stressed"
    assert "heat" in assessment.status_reason


def test_assess_health_watch_and_good():
    watch = assess_health(
        [
            water_stress_indicator(0.60, 1),
            frost_indicator(_temperature_days(14, 18.0, 5.0)),
        ]
    )
    assert watch.status == "moderate"

    good = assess_health(
        [
            water_stress_indicator(0.30, 0),
            frost_indicator(_temperature_days(14, 18.0, 5.0)),
        ]
    )
    assert good.status == "good"


def test_indicator_agreement_is_descriptive_not_a_health_probability():
    indicators = [
        water_stress_indicator(0.85, 2),
        frost_indicator(_temperature_days(14, 18.0, 5.0)),
        vegetation_indicator(available=False, latest_ndvi=None, trend="unknown"),
    ]
    agreement = summarise_indicator_agreement(indicators)
    assert agreement.known == 2
    assert agreement.total == 3
    assert agreement.stressed == 1
    assert agreement.percent == 50.0

    unknown_only = summarise_indicator_agreement(
        [vegetation_indicator(available=False, latest_ndvi=None, trend="unknown")]
    )
    assert unknown_only.percent is None
    assert unknown_only.known == 0


# ── Irrigation demand and confidence ────────────────────────────────────────


def test_demand_classes_follow_documented_fractions():
    high = classify_demand(
        depletion_fraction=0.85, precipitation_last_7d_mm=0.0, etc_mm_day=5.0, stress_days=2
    )
    assert high.level == "high"

    moderate = classify_demand(
        depletion_fraction=0.60, precipitation_last_7d_mm=10.0, etc_mm_day=3.0, stress_days=0
    )
    assert moderate.level == "moderate"

    low = classify_demand(
        depletion_fraction=0.30, precipitation_last_7d_mm=10.0, etc_mm_day=3.0, stress_days=0
    )
    assert low.level == "low"

    unknown = classify_demand(
        depletion_fraction=None, precipitation_last_7d_mm=None, etc_mm_day=None, stress_days=0
    )
    assert unknown.level == "unknown"


def test_accelerated_high_demand_requires_dry_week_and_high_etc():
    accelerated = classify_demand(
        depletion_fraction=0.68, precipitation_last_7d_mm=1.0, etc_mm_day=5.0, stress_days=0
    )
    assert accelerated.level == "high"

    not_accelerated = classify_demand(
        depletion_fraction=0.68, precipitation_last_7d_mm=12.0, etc_mm_day=5.0, stress_days=0
    )
    assert not_accelerated.level == "moderate"


def test_refill_requirement_applies_application_efficiency():
    net, gross, efficiency = refill_requirements(depletion_mm=100.0, irrigation_system="sprinkler")
    assert net == pytest.approx(100.0)
    assert gross == pytest.approx(133.3)
    assert efficiency == pytest.approx(0.75)

    net, gross, efficiency = refill_requirements(depletion_mm=None, irrigation_system="drip")
    assert (net, gross, efficiency) == (None, None, None)

    net, gross, efficiency = refill_requirements(depletion_mm=40.0, irrigation_system=None)
    assert net == pytest.approx(40.0)
    assert gross is None


def test_confidence_is_capped_at_medium_for_power_only_inputs():
    result = assess_confidence(
        ConfidenceFactors(
            et0_coverage=1.0,
            precipitation_coverage=1.0,
            soil_provided=True,
            irrigation_system_provided=True,
            days_simulated=120,
            vegetation_available=False,
        )
    )
    assert result.level == "medium"
    assert any("capped at medium" in reason for reason in result.reasons)

    weaker = assess_confidence(
        ConfidenceFactors(
            et0_coverage=0.70,
            precipitation_coverage=0.80,
            soil_provided=False,
            irrigation_system_provided=False,
            days_simulated=5,
            vegetation_available=False,
        )
    )
    assert weaker.level == "low"


# ── Processing helpers ──────────────────────────────────────────────────────


def test_recent_precipitation_total_requires_80_percent_coverage():
    points = [{"precipitation_mm": 1.0} for _ in range(10)]
    assert recent_precipitation_total(points, 10) == pytest.approx(10.0)

    sparse = [{"precipitation_mm": 1.0}] * 7 + [{"precipitation_mm": None}] * 3
    assert recent_precipitation_total(sparse, 10) is None
    assert recent_precipitation_total([], 10) is None


def test_monthly_and_30_day_rainfall_normals():
    climatology = {"JAN": 0.4, "JUL": 0.0}
    assert monthly_rainfall_normal_mm_per_day(climatology, 1) == pytest.approx(0.4)
    assert monthly_rainfall_normal_mm_per_day(climatology, 2) is None
    assert monthly_rainfall_normal_mm_per_day(None, 1) is None
    assert monthly_rainfall_normal_mm_per_day({"JAN": "bad"}, 1) is None

    assert normal_30_day_rainfall_mm(climatology, date(2026, 1, 31)) == pytest.approx(12.0)
    assert normal_30_day_rainfall_mm(climatology, date(2026, 2, 28)) is None


def test_subset_points_and_add_days_are_inclusive():
    points = [
        {"date": "2026-01-01"},
        {"date": "2026-01-02"},
        {"date": "2026-01-03"},
        {"date": "2026-01-04"},
    ]
    subset = subset_points(points, date(2026, 1, 2), date(2026, 1, 3))
    assert [point["date"] for point in subset] == ["2026-01-02", "2026-01-03"]
    assert add_days(date(2026, 1, 1), 30) == date(2026, 1, 31)
