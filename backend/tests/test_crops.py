"""Crop registry data and stage-aware vegetation scoring.

These tests are pure: no NASA POWER, Earth Engine or database call is made.
They pin the FAO-56 values for potato and tomato, check that every registered
crop has complete stage bands, and verify that the same NDVI/NDMI value is read
relative to the growth stage instead of a single global cut-point.
"""

from datetime import date

from app.crops import get_calendar, get_crop, list_crops
from app.schemas.farmer import FarmerSoil
from app.science import sar_moisture
from app.science.crop_coefficient import stage_for_day
from app.services import farmer_summary as farmer
from app.services.forecast import ForecastResult
from app.services.satellite import crop_stage_context

ASSESSED_ON = date(2026, 11, 14)


def test_the_three_supported_crops_are_registered():
    assert {crop.id for crop in list_crops()} == {"wheat", "potato", "tomato"}


def test_every_crop_has_bands_for_every_stage():
    for crop in list_crops():
        calendar = get_calendar(crop.id)
        assert calendar is not None
        assert crop.season_length_days == calendar.season_days, crop.id
        assert set(crop.stage_expectations) == {stage.code for stage in crop.stages}
        for bands in crop.stage_expectations.values():
            assert 0.0 <= bands.ndvi_sparse_max < bands.ndvi_dense_min <= 1.0
            assert -1.0 <= bands.ndmi_low_max < bands.ndmi_high_min <= 1.0


def test_potato_profile_matches_fao56_defaults():
    potato = get_crop("potato")
    assert potato is not None
    assert potato.season_length_days == 120
    assert potato.kc_initial == 0.50
    assert potato.kc_mid == 1.15
    assert potato.kc_end == 0.75
    assert potato.root_depth_initial_m == 0.15
    assert potato.root_depth_max_m == 0.50
    assert potato.depletion_fraction_p == 0.35
    assert potato.heat_stress_threshold_c == 30.0
    assert potato.frost_threshold_c == 0.0
    assert get_calendar("potato").establishment == "tuber"


def test_tomato_profile_matches_fao56_defaults():
    tomato = get_crop("tomato")
    assert tomato is not None
    assert tomato.season_length_days == 140
    assert tomato.kc_initial == 0.60
    assert tomato.kc_mid == 1.15
    assert tomato.kc_end == 0.80
    assert tomato.root_depth_initial_m == 0.15
    assert tomato.root_depth_max_m == 1.00
    assert tomato.depletion_fraction_p == 0.40
    assert tomato.heat_stress_threshold_c == 35.0
    assert tomato.frost_threshold_c == 2.0
    assert get_calendar("tomato").establishment == "transplant"


def test_stage_bands_change_the_condition_for_the_same_ndvi():
    wheat_mid = get_crop("wheat").expectation_for_stage("mid")
    potato_mid = get_crop("potato").expectation_for_stage("mid")
    assert sar_moisture.vegetation_condition(0.38, wheat_mid) == "moderate"
    assert sar_moisture.vegetation_condition(0.38, potato_mid) == "sparse"
    # Without bands the global class is unchanged.
    assert sar_moisture.vegetation_condition(0.38) == "moderate"


def test_stage_bands_change_the_moisture_condition_for_the_same_ndmi():
    wheat_late = get_crop("wheat").expectation_for_stage("late")
    tomato_mid = get_crop("tomato").expectation_for_stage("mid")
    assert sar_moisture.moisture_condition(0.02, wheat_late) == "moderate"
    assert sar_moisture.moisture_condition(0.02, tomato_mid) == "low"


def test_interpretation_names_the_crop_and_stage():
    bands = get_crop("potato").expectation_for_stage("mid")
    text = sar_moisture.vegetation_interpretation(
        0.55,
        0.12,
        bands=bands,
        crop_name="Potato",
        stage_name="Mid-season (tuber bulking)",
    )
    assert "potato" in text.lower()
    assert "tuber bulking" in text.lower()
    assert "disease" in text


def test_health_score_is_relative_to_the_stage():
    wheat = get_crop("wheat")
    early = wheat.expectation_for_stage("initial")
    mid = wheat.expectation_for_stage("mid")
    # Same canopy is excellent for emergence and only moderate at heading.
    assert farmer.health_percent(0.35, 0.15, early) > farmer.health_percent(0.35, 0.15, mid)
    # The no-band default is preserved for back-compatibility.
    assert farmer.health_percent(0.483, 0.148) == 53


def test_stage_context_resolves_for_a_stored_field():
    bands, crop_name, stage_name = crop_stage_context(
        "potato", date(2026, 11, 1), date(2026, 11, 15)
    )
    assert bands is not None
    assert crop_name == "Potato"
    assert stage_name is not None and stage_name.startswith("Initial")

    assert crop_stage_context("wheat", None, ASSESSED_ON) == (None, None, None)
    assert crop_stage_context("banana", ASSESSED_ON, ASSESSED_ON) == (None, None, None)
    # The last day of a season falls after harvest, so no stage band is claimed.
    late = crop_stage_context("potato", date(2026, 1, 1), date(2026, 12, 1))
    assert late == (None, "Potato", None)


def test_potato_stage_boundaries():
    potato = get_crop("potato")
    assert stage_for_day(potato, 0).code == "initial"
    assert stage_for_day(potato, 24).code == "initial"
    assert stage_for_day(potato, 25).code == "development"
    assert stage_for_day(potato, 55).code == "mid"
    assert stage_for_day(potato, 99).code == "mid"
    assert stage_for_day(potato, 100).code == "late"
    assert stage_for_day(potato, 120).code == "post_harvest"


def _timeline(crop_id: str, intent: str, days_since_planting: int | None = None):
    return farmer._timeline(
        get_calendar(crop_id),
        intent,
        days_since_planting,
        ForecastResult(available=False),
        FarmerSoil(available=False, category="unknown", advice="check_soil_moisture"),
        None,
        None,
        ASSESSED_ON,
    )


def test_potato_pre_planting_uses_tuber_advice():
    timeline = _timeline("potato", "plant_now")
    assert "plant_tubers" in timeline.actions
    assert "sow_at_depth" in timeline.actions
    assert "harden_transplants" not in timeline.actions


def test_tomato_pre_planting_uses_transplant_advice():
    timeline = _timeline("tomato", "plant_now")
    assert "harden_transplants" in timeline.actions
    assert "plant_tubers" not in timeline.actions


def test_tomato_early_growth_checks_transplants_and_stakes():
    timeline = _timeline("tomato", "already_planted", days_since_planting=10)
    assert timeline.stage == "early_growth"
    assert "check_transplants" in timeline.actions
    assert "stake_plants" in timeline.actions
    assert "check_emergence" not in timeline.actions


def test_potato_early_growth_earths_up_ridges():
    timeline = _timeline("potato", "already_planted", days_since_planting=16)
    assert timeline.stage == "early_growth"
    assert "earth_up_ridges" in timeline.actions
    assert "check_emergence" in timeline.actions
