"""
Potato growth profile (winter / Nili crop, Egypt).

Source of constants
-------------------
FAO Irrigation & Drainage Paper 56 (Allen et al., 1998):
* Table 12 — single crop coefficients and stage lengths for potato. The table
  lists Kc ini ≈ 0.50, Kc mid ≈ 1.15 and Kc end ≈ 0.75 for the 120-day default.
* Table 22 — root-zone depletion fraction (p) for potato ≈ 0.35; potato is more
  sensitive to water stress during tuber bulking than wheat.
* Chapter 8 — total available water from field capacity / wilting point.

Stage lengths are regional defaults for an autumn-planted (October–November)
winter crop, not measurements from a specific field. Local varieties and the
planting date shift them by one to three weeks.

NDVI/NDMI expectations (``stage_expectations``) are documented heuristics from
extension guidance on canopy development, not calibrated per-variety bands. They
are used to read an index value relative to the growth stage.
"""

from app.crops.base import CropProfile, StageSpec, VegetationExpectation, register_crop

POTATO = register_crop(
    CropProfile(
        id="potato",
        name="Potato",
        scientific_name="Solanum tuberosum",
        stages=(
            # 25 initial + 30 development + 45 mid-season + 20 late = 120 days.
            # Kc: 0.50 (initial) → 1.15 (tuber bulking) → 0.75 (maturation).
            StageSpec(code="initial", name="Initial (sprouting–emergence)", days=25, kc_start=0.50, kc_end=0.50),
            StageSpec(code="development", name="Development (leaf growth)", days=30, kc_start=0.50, kc_end=1.15),
            StageSpec(code="mid", name="Mid-season (tuber bulking)", days=45, kc_start=1.15, kc_end=1.15),
            StageSpec(code="late", name="Late season (maturation)", days=20, kc_start=1.15, kc_end=0.75),
        ),
        root_depth_initial_m=0.15,
        root_depth_max_m=0.50,
        depletion_fraction_p=0.35,
        runoff_coefficient=0.10,
        heat_stress_threshold_c=30.0,
        frost_threshold_c=0.0,
        notes=(
            "Winter (Nili) potato defaults. Potato roots are shallow and its "
            "depletion fraction is low, so the root-zone bucket is smaller than "
            "wheat's and frequent light irrigation matters more."
        ),
        stage_expectations={
            "initial": VegetationExpectation(0.20, 0.40, 0.00, 0.20),
            "development": VegetationExpectation(0.30, 0.65, 0.05, 0.25),
            "mid": VegetationExpectation(0.40, 0.80, 0.05, 0.30),
            "late": VegetationExpectation(0.25, 0.60, -0.05, 0.25),
        },
    )
)
