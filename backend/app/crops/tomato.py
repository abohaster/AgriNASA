"""
Tomato growth profile (transplanted winter crop, Egypt).

Source of constants
-------------------
FAO Irrigation & Drainage Paper 56 (Allen et al., 1998):
* Table 12 — single crop coefficients and stage lengths for tomato. The table
  lists Kc ini ≈ 0.60, Kc mid ≈ 1.15 and Kc end ≈ 0.70–0.90; 0.80 is used here.
* Table 22 — root-zone depletion fraction (p) for tomato ≈ 0.40.
* Chapter 8 — total available water from field capacity / wilting point.

The season is counted from transplanting into the field, which is how Egyptian
extension calendars describe the main August–September tomato crop. Stage
lengths (30 / 40 / 40 / 30 = 140 days) are regional defaults, not measurements.

NDVI/NDMI expectations (``stage_expectations``) are documented heuristics from
canopy-development guidance, not calibrated per-variety bands.
"""

from app.crops.base import CropProfile, StageSpec, VegetationExpectation, register_crop

TOMATO = register_crop(
    CropProfile(
        id="tomato",
        name="Tomato",
        scientific_name="Solanum lycopersicum",
        stages=(
            # 30 initial + 40 development + 40 mid-season + 30 late = 140 days.
            # Kc: 0.60 (establishment) → 1.15 (fruit set) → 0.80 (final harvest).
            StageSpec(code="initial", name="Initial (transplant establishment)", days=30, kc_start=0.60, kc_end=0.60),
            StageSpec(code="development", name="Development (vegetative–flowering)", days=40, kc_start=0.60, kc_end=1.15),
            StageSpec(code="mid", name="Mid-season (fruit set–harvest)", days=40, kc_start=1.15, kc_end=1.15),
            StageSpec(code="late", name="Late season (final harvest)", days=30, kc_start=1.15, kc_end=0.80),
        ),
        root_depth_initial_m=0.15,
        root_depth_max_m=1.00,
        depletion_fraction_p=0.40,
        runoff_coefficient=0.10,
        heat_stress_threshold_c=35.0,
        frost_threshold_c=2.0,
        notes=(
            "Transplanted winter tomato defaults. Fruit set is sensitive to heat "
            "above ~35 °C and to night temperatures below ~2 °C. Season length is "
            "counted from transplanting."
        ),
        stage_expectations={
            "initial": VegetationExpectation(0.20, 0.45, 0.00, 0.20),
            "development": VegetationExpectation(0.30, 0.65, 0.05, 0.25),
            "mid": VegetationExpectation(0.40, 0.80, 0.05, 0.30),
            "late": VegetationExpectation(0.30, 0.65, 0.00, 0.25),
        },
    )
)
