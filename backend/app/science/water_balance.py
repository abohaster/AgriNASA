"""
Daily root-zone water balance (FAO-56 bucket model).

WHAT THIS FILE CALCULATES
-------------------------
A one-dimensional daily water bucket for the crop root zone:

    ΔS = P + I − ETc − D − R        (FAO-56, Chapter 8)

In terms of depletion (D = water needed to refill the root zone to field capacity):

    D_t = D_(t−1) − (P − RO) − I + ETc + DP

DEFINITIONS AND UNITS
---------------------
P     precipitation                    [mm/day]
I     irrigation                        [mm/day]  (0 in this baseline run)
ETc   crop evapotranspiration           [mm/day]  (Kc × ET₀)
RO    surface runoff                    [mm/day]
DP    deep percolation                  [mm/day]
D     root-zone depletion               [mm]  (0 = field capacity)
TAW   total available water             [mm]  = 1000 (θFC − θWP) Zr
RAW   readily available water           [mm]  = p × TAW

ASSUMPTIONS (each one is surfaced to the user)
----------------------------------------------
1. Single homogeneous soil layer; no capillary rise, no lateral flow.
2. Runoff is a fixed coefficient of daily rainfall because slope, cover and
   soil-group data are not available. It is an assumption, not a measurement.
3. Initial depletion is 50 % of TAW at planting (documented default), because
   no pre-season soil-water measurement exists.
4. Root depth grows linearly with crop progress; TAW therefore grows. Water in
   newly explored soil is assumed to be at the same depletion.
5. Irrigation events are not recorded in this first version; I = 0. The output
   is the requirement to refill the root zone, not a claim about applied water.
6. Days with missing ET₀ are simulated with zero crop water use and counted in
   `excluded_et0_days`; the service downgrades confidence or refuses the analysis
   when coverage is too low. Missing values are never interpolated here.
"""

from dataclasses import dataclass, field
from datetime import date

from app.crops.base import CropProfile
from app.science.crop_coefficient import root_depth_m, stage_for_day

# Volumetric water content at field capacity / wilting point by USDA texture
# class (typical ranges, Saxton & Rawls). These are soil-class averages, not
# measurements of the user's field.
SOIL_TEXTURES: dict[str, tuple[float, float]] = {
    "sand": (0.12, 0.05),
    "loamy_sand": (0.17, 0.07),
    "sandy_loam": (0.23, 0.10),
    "loam": (0.29, 0.14),
    "silt_loam": (0.33, 0.16),
    "clay_loam": (0.36, 0.20),
    "clay": (0.40, 0.24),
}

DEFAULT_SOIL_TEXTURE = "loam"
DEFAULT_INITIAL_DEPLETION_FRACTION = 0.50


@dataclass(frozen=True)
class SoilProperties:
    texture: str
    field_capacity: float  # volumetric, m³/m³
    wilting_point: float  # volumetric, m³/m³


@dataclass
class BalanceDayInput:
    day: date
    days_after_planting: int
    precipitation_mm: float | None
    et0_mm_day: float | None


@dataclass
class BalanceDayResult:
    day: date
    days_after_planting: int
    kc: float | None
    et0_mm_day: float | None
    etc_mm_day: float | None
    precipitation_mm: float
    runoff_mm: float
    drainage_mm: float
    depletion_mm: float
    taw_mm: float
    raw_mm: float
    stressed: bool


@dataclass
class BalanceResult:
    initial_depletion_mm: float
    final_depletion_mm: float
    taw_mm: float
    raw_mm: float
    depletion_fraction: float
    stress_days: int
    days_simulated: int
    excluded_et0_days: int
    runoff_total_mm: float
    drainage_total_mm: float
    records: list[BalanceDayResult] = field(default_factory=list)


def get_soil_properties(texture: str | None) -> SoilProperties:
    """Resolve a texture class; unknown/missing values fall back to loam."""
    key = (texture or DEFAULT_SOIL_TEXTURE).lower()
    if key not in SOIL_TEXTURES:
        key = DEFAULT_SOIL_TEXTURE
    field_capacity, wilting_point = SOIL_TEXTURES[key]
    return SoilProperties(texture=key, field_capacity=field_capacity, wilting_point=wilting_point)


def total_available_water_mm(soil: SoilProperties, root_depth_m_value: float) -> float:
    """TAW = 1000 × (θFC − θWP) × Zr  [mm]; 1000 converts m of water to mm."""
    return max(0.0, 1000.0 * (soil.field_capacity - soil.wilting_point) * root_depth_m_value)


def simulate_water_balance(
    *,
    profile: CropProfile,
    soil: SoilProperties,
    days: list[BalanceDayInput],
    irrigation_mm_by_date: dict[date, float] | None = None,
    initial_depletion_fraction: float = DEFAULT_INITIAL_DEPLETION_FRACTION,
) -> BalanceResult:
    """Run the daily bucket over a planting-to-end window.

    `days` must be sorted by date and contain days at/after planting. ET₀ may be
    missing on individual days; those days are simulated without ETc and counted.
    """
    ordered = sorted(days, key=lambda item: item.day)
    irrigation_mm_by_date = irrigation_mm_by_date or {}

    if not ordered:
        raise ValueError("Water balance requires at least one day")

    # Initialise the bucket from the first day's root-zone capacity.
    first_stage = stage_for_day(profile, ordered[0].days_after_planting)
    first_zr = root_depth_m(profile, first_stage.progress)
    first_taw = total_available_water_mm(soil, first_zr)
    depletion = initial_depletion_fraction * first_taw

    records: list[BalanceDayResult] = []
    stress_days = 0
    excluded_et0_days = 0
    runoff_total = 0.0
    drainage_total = 0.0

    for item in ordered:
        stage = stage_for_day(profile, item.days_after_planting)
        zr = root_depth_m(profile, stage.progress)
        taw = total_available_water_mm(soil, zr)
        raw = profile.depletion_fraction_p * taw

        precipitation = item.precipitation_mm if item.precipitation_mm is not None else 0.0
        # A missing precipitation value is treated as zero *only* for the bucket,
        # and the count of missing ET₀ days is reported separately. The service
        # also exposes missing precipitation coverage to the user via processing.
        runoff = profile.runoff_coefficient * precipitation
        effective_rain = precipitation - runoff

        if item.et0_mm_day is None:
            etc = None
            excluded_et0_days += 1
        elif stage.kc is None:
            # Before planting or after harvest there is no crop transpiration.
            etc = 0.0
        else:
            etc = stage.kc * item.et0_mm_day

        irrigation = irrigation_mm_by_date.get(item.day, 0.0)

        # Bucket update: rain and irrigation refill, ETc depletes.
        depletion = depletion - effective_rain - irrigation + (etc or 0.0)

        drainage = 0.0
        if depletion < 0.0:
            drainage = -depletion
            depletion = 0.0

        # Water below wilting point is not plant-available; cap depletion at TAW
        # and flag the day as stressed.
        if depletion > taw:
            depletion = taw

        stressed = depletion >= raw and stage.kc is not None
        if stressed:
            stress_days += 1

        runoff_total += runoff
        drainage_total += drainage

        records.append(
            BalanceDayResult(
                day=item.day,
                days_after_planting=item.days_after_planting,
                kc=stage.kc,
                et0_mm_day=item.et0_mm_day,
                etc_mm_day=round(etc, 4) if etc is not None else None,
                precipitation_mm=round(precipitation, 2),
                runoff_mm=round(runoff, 2),
                drainage_mm=round(drainage, 2),
                depletion_mm=round(depletion, 2),
                taw_mm=round(taw, 2),
                raw_mm=round(raw, 2),
                stressed=stressed,
            )
        )

    final_taw = records[-1].taw_mm
    final_raw = records[-1].raw_mm
    fraction = depletion / final_taw if final_taw > 0 else 0.0

    return BalanceResult(
        initial_depletion_mm=round(initial_depletion_fraction * first_taw, 2),
        final_depletion_mm=round(depletion, 2),
        taw_mm=round(final_taw, 2),
        raw_mm=round(final_raw, 2),
        depletion_fraction=round(min(1.0, max(0.0, fraction)), 4),
        stress_days=stress_days,
        days_simulated=len(records),
        excluded_et0_days=excluded_et0_days,
        runoff_total_mm=round(runoff_total, 2),
        drainage_total_mm=round(drainage_total, 2),
        records=records,
    )
