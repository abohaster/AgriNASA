"""
Crop coefficient (Kc) and growth-stage model.

WHAT THIS FILE CALCULATES
-------------------------
Given a planting date and a day, it returns the wheat growth stage and the Kc
value for that day. Kc connects reference ET to crop ET:

    ETc = Kc × ET₀            (FAO-56 eq. 69)

WHY Kc VARIES
-------------
Wheat does not use the same amount of water all season. FAO-56 defines four
stages with different Kc values:
    initial → development → mid-season → late season
Using one constant Kc for the whole cycle would misrepresent both early
establishment and ripening.

INTERPOLATION (FAO-56 eq. 66–68)
--------------------------------
Kc is constant in the initial and mid-season stages, then changes linearly
during development and late season:

    Kc(d) = Kc_start + (d − d_stage_start) / L_stage × (Kc_end − Kc_start)

UNITS
-----
Kc is dimensionless; days are calendar days after planting (DAP).

ASSUMPTIONS
-----------
* Stage lengths come from the crop registry (temperate winter-wheat defaults).
* No water-stress adjustment (FAO-56 eq. 80) is applied to Kc here; stress is
  handled explicitly by the root-zone water balance and reported separately.
* Before planting and after harvest, Kc is returned as None because the crop is
  not transpiring. Callers must treat ETc as unavailable on those days.
"""

from dataclasses import dataclass
from datetime import date

from app.crops.base import CropProfile


@dataclass(frozen=True)
class GrowthStageInfo:
    """Stage + coefficient for one day after planting."""

    code: str
    name: str
    days_after_planting: int
    progress: float | None
    kc: float | None


def days_after_planting(planting_date: date, day: date) -> int:
    return (day - planting_date).days


def stage_for_day(profile: CropProfile, dap: int) -> GrowthStageInfo:
    """Resolve the stage and Kc for a day-after-planting value."""
    if dap < 0:
        return GrowthStageInfo(
            code="pre_planting",
            name="Before planting",
            days_after_planting=dap,
            progress=None,
            kc=None,
        )

    total_days = profile.season_length_days
    if dap >= total_days:
        return GrowthStageInfo(
            code="post_harvest",
            name="After harvest",
            days_after_planting=dap,
            progress=1.0,
            kc=None,
        )

    progress = dap / total_days
    stage_start = 0
    for stage in profile.stages:
        stage_end = stage_start + stage.days
        if dap < stage_end:
            day_in_stage = dap - stage_start
            if stage.kc_start == stage.kc_end:
                kc = stage.kc_start
            else:
                fraction = day_in_stage / stage.days
                kc = stage.kc_start + fraction * (stage.kc_end - stage.kc_start)
            return GrowthStageInfo(
                code=stage.code,
                name=stage.name,
                days_after_planting=dap,
                progress=round(progress, 4),
                kc=round(kc, 4),
            )
        stage_start = stage_end

    # Defensive fallback; the loop above covers every dap < total_days.
    return GrowthStageInfo(
        code="post_harvest",
        name="After harvest",
        days_after_planting=dap,
        progress=1.0,
        kc=None,
    )


def root_depth_m(profile: CropProfile, progress: float | None) -> float:
    """
    Rooting depth grows linearly from emergence to maximum depth.

    This matters for the water balance: a young wheat crop has a much smaller
    root-zone bucket than a mature one, so TAW changes as the season advances.
    """
    if progress is None:
        return profile.root_depth_initial_m
    clamped = max(0.0, min(1.0, progress))
    return profile.root_depth_initial_m + clamped * (
        profile.root_depth_max_m - profile.root_depth_initial_m
    )


def crop_evapotranspiration(kc: float | None, et0_mm_day: float | None) -> float | None:
    """ETc = Kc × ET₀ [mm/day]. Returns None if either input is unavailable."""
    if kc is None or et0_mm_day is None:
        return None
    return round(kc * et0_mm_day, 4)
