"""
Wheat growth profile (the first supported crop).

Source of constants
-------------------
FAO Irrigation & Drainage Paper 56 (Allen et al., 1998):
* Table 12 — single crop coefficients and stage lengths for wheat.
* Table 22 — root-zone depletion fraction (p) for wheat ≈ 0.55.
* Chapter 8 — total available water from field capacity / wilting point.

Stage lengths vary strongly with climate and sowing date; these are temperate
defaults for a winter wheat season. They are explicitly documented as defaults,
not measurements. A future version can load region-specific profiles from the
crop registry without changing any calculation code.
"""

from app.crops.base import CropProfile, StageSpec, VegetationExpectation, register_crop

WHEAT = register_crop(
    CropProfile(
        id="wheat",
        name="Wheat",
        scientific_name="Triticum aestivum",
        stages=(
            # 20 days initial, 30 development, 60 mid-season, 40 late = 150 days.
            # Kc: 0.40 (initial) → 1.15 (mid) → 0.30 (late/harvest).
            StageSpec(code="initial", name="Initial (emergence–tillering)", days=20, kc_start=0.40, kc_end=0.40),
            StageSpec(code="development", name="Development (stem elongation)", days=30, kc_start=0.40, kc_end=1.15),
            StageSpec(code="mid", name="Mid-season (heading–grain fill)", days=60, kc_start=1.15, kc_end=1.15),
            StageSpec(code="late", name="Late season (ripening)", days=40, kc_start=1.15, kc_end=0.30),
        ),
        root_depth_initial_m=0.15,
        root_depth_max_m=1.5,
        depletion_fraction_p=0.55,
        runoff_coefficient=0.10,
        heat_stress_threshold_c=30.0,
        frost_threshold_c=0.0,
        notes=(
            "Winter wheat defaults. Development-stage Kc is linearly interpolated; "
            "the Kc curve is a reference value, not a canopy measurement."
        ),
        stage_expectations={
            # Documented heuristics: young wheat never reaches a dense canopy, so
            # the band rises through development and falls again at ripening.
            "initial": VegetationExpectation(0.20, 0.45, 0.00, 0.20),
            "development": VegetationExpectation(0.30, 0.65, 0.00, 0.25),
            "mid": VegetationExpectation(0.35, 0.75, 0.05, 0.30),
            "late": VegetationExpectation(0.25, 0.55, -0.05, 0.20),
        },
    )
)

# Optional spring-wheat variant, retained for future UI selection. Not registered
# yet: the first version exposes one wheat profile to keep the interface honest.
SPRING_WHEAT = CropProfile(
    id="wheat_spring",
    name="Spring wheat",
    scientific_name="Triticum aestivum",
    stages=(
        StageSpec(code="initial", name="Initial", days=25, kc_start=0.30, kc_end=0.30),
        StageSpec(code="development", name="Development", days=30, kc_start=0.30, kc_end=1.15),
        StageSpec(code="mid", name="Mid-season", days=50, kc_start=1.15, kc_end=1.15),
        StageSpec(code="late", name="Late season", days=30, kc_start=1.15, kc_end=0.30),
    ),
    root_depth_initial_m=0.15,
    root_depth_max_m=1.5,
    depletion_fraction_p=0.55,
    runoff_coefficient=0.10,
    heat_stress_threshold_c=30.0,
    frost_threshold_c=0.0,
    notes="Spring wheat defaults (FAO-56 Table 12).",
)
