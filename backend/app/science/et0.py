"""
Reference evapotranspiration (ET₀) — FAO-56 Penman–Monteith, daily time step.

WHAT THIS FILE CALCULATES
-------------------------
ET₀ (mm/day) is the evaporative demand of a well-watered grass reference crop.
It is the meteorological driver behind crop water use (ETc = Kc × ET₀).

FORMULA (FAO-56, eq. 6)
-----------------------
ET₀ = [0.408 Δ (Rn − G) + γ (900/(T + 273)) u₂ (es − ea)]
      / [Δ + γ (1 + 0.34 u₂)]

VARIABLES AND UNITS
-------------------
Δ    slope of saturation vapour-pressure curve          [kPa/°C]
Rn   net radiation at the crop surface                  [MJ/m²/day]
G    soil heat flux density (≈ 0 for daily steps)      [MJ/m²/day]
γ    psychrometric constant                             [kPa/°C]
T    mean daily air temperature                         [°C]
u₂   wind speed at 2 m                                  [m/s]
es   saturation vapour pressure                         [kPa]
ea   actual vapour pressure                             [kPa]
0.408 converts MJ/m²/day to an equivalent water depth  [mm/MJ·m²]

WHY THIS METHOD
---------------
FAO-56 Penman–Monteith is the internationally accepted reference method and is
explicitly recommended by the prompt. It combines radiative and aerodynamic
terms, so it responds to both sunshine and wind/humidity.

ASSUMPTIONS AND LIMITATIONS
---------------------------
* Daily time step: G is approximated as zero (FAO-56 eq. 42 and 44).
* The reference surface has an assumed albedo of 0.23 and a fixed surface
  resistance of 70 s/m, built into the coefficients of eq. 6.
* ea is derived from mean relative humidity: ea = RH/100 × es. FAO-56 allows
  this when dew point is unavailable; it is an approximation, not a measurement.
* Atmospheric pressure is taken from POWER's PS when available; otherwise it is
  estimated from elevation using the standard atmosphere (FAO-56 eq. 7).
* If a required input is missing, the function returns `et0_mm_day=None` and
  reports the missing item. It never substitutes an invented number.

NASA POWER provides T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN and PS. The
processing layer converts units into the units used here before calling this
function.
"""

from dataclasses import dataclass, field
from datetime import date

import math

from app.science.validation import is_finite

# Stefan–Boltzmann constant [MJ K⁻⁴ m⁻² day⁻¹] (FAO-56 eq. 37).
STEFAN_BOLTZMANN = 4.903e-9
SOLAR_CONSTANT = 0.0820  # MJ m⁻² min⁻¹
GSC_MM_PER_MJ = 0.408
ALBEDO_REFERENCE_GRASS = 0.23


@dataclass
class Et0Inputs:
    """One day of weather inputs, already converted to FAO units."""

    day: date
    latitude_deg: float
    elevation_m: float | None
    tmax_c: float | None
    tmin_c: float | None
    rh_mean_pct: float | None
    wind_speed_2m_ms: float | None
    solar_radiation_mj_m2_day: float | None
    pressure_kpa: float | None = None


@dataclass
class Et0Result:
    """Result plus enough intermediate terms to make the calculation auditable."""

    et0_mm_day: float | None
    missing_inputs: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    components: dict[str, float | None] = field(default_factory=dict)


def saturation_vapour_pressure(temp_c: float) -> float:
    """e°(T) = 0.6108 · exp(17.27T / (T + 237.3))  [kPa] — FAO-56 eq. 11."""
    return 0.6108 * pow(2.718281828, (17.27 * temp_c) / (temp_c + 237.3))


def slope_saturation_curve(temp_c: float) -> float:
    """Δ = 4098 · e°(T) / (T + 237.3)²  [kPa/°C] — FAO-56 eq. 13."""
    return 4098.0 * saturation_vapour_pressure(temp_c) / pow(temp_c + 237.3, 2)


def psychrometric_constant(pressure_kpa: float) -> float:
    """γ = 0.000665 · P  [kPa/°C] — FAO-56 eq. 8 (P in kPa)."""
    return 0.000665 * pressure_kpa


def pressure_from_elevation(elevation_m: float) -> float:
    """P = 101.3 · ((293 − 0.0065z) / 293)^5.26  [kPa] — FAO-56 eq. 7."""
    return 101.3 * pow((293.0 - 0.0065 * elevation_m) / 293.0, 5.26)


def extraterrestrial_radiation(latitude_deg: float, day_of_year: int) -> float:
    """
    Ra [MJ/m²/day] — FAO-56 eq. 21.

    Ra is the radiation reaching the top of the atmosphere; it is needed only to
    estimate clear-sky radiation (Rso) for the net-longwave term.
    """
    phi = latitude_deg * 3.141592653589793 / 180.0
    dr = 1.0 + 0.033 * _cos(2.0 * 3.141592653589793 * day_of_year / 365.0)
    declination = 0.409 * _sin(2.0 * 3.141592653589793 * day_of_year / 365.0 - 1.39)

    cos_arg = -_tan(phi) * _tan(declination)
    # Polar day/night guard: arccos is undefined outside [-1, 1].
    cos_arg = max(-1.0, min(1.0, cos_arg))
    sunset_angle = _acos(cos_arg)

    return (
        (24.0 * 60.0 / 3.141592653589793)
        * SOLAR_CONSTANT
        * dr
        * (
            sunset_angle * _sin(phi) * _sin(declination)
            + _cos(phi) * _cos(declination) * _sin(sunset_angle)
        )
    )


def compute_et0(inputs: Et0Inputs) -> Et0Result:
    """Compute daily ET₀ from the six required meteorological inputs."""
    missing: list[str] = []
    notes: list[str] = []

    required = {
        "Maximum temperature": inputs.tmax_c,
        "Minimum temperature": inputs.tmin_c,
        "Relative humidity": inputs.rh_mean_pct,
        "Wind speed at 2 m": inputs.wind_speed_2m_ms,
        "Solar radiation": inputs.solar_radiation_mj_m2_day,
    }
    missing = [label for label, value in required.items() if not is_finite(value)]
    if missing:
        return Et0Result(et0_mm_day=None, missing_inputs=missing)

    tmax = float(inputs.tmax_c)
    tmin = float(inputs.tmin_c)
    rh = float(inputs.rh_mean_pct)
    wind = float(inputs.wind_speed_2m_ms)
    solar = float(inputs.solar_radiation_mj_m2_day)

    # Physically invalid pairs are rejected rather than silently corrected.
    if tmax < tmin:
        return Et0Result(
            et0_mm_day=None,
            notes=["Maximum temperature is below minimum temperature; the day was excluded."],
        )
    if not 0.0 <= rh <= 100.0:
        return Et0Result(
            et0_mm_day=None,
            notes=["Relative humidity is outside 0–100 %; the day was excluded."],
        )

    elevation = inputs.elevation_m
    if not is_finite(elevation):
        elevation = 0.0
        notes.append("Elevation unavailable; sea level (0 m) assumed for pressure and Ra.")
    elevation = float(elevation)

    if is_finite(inputs.pressure_kpa):
        pressure = float(inputs.pressure_kpa)
    else:
        pressure = pressure_from_elevation(elevation)
        notes.append("Pressure unavailable; estimated from elevation (standard atmosphere).")

    tmean = (tmax + tmin) / 2.0
    vapour_slope = slope_saturation_curve(tmean)
    gamma = psychrometric_constant(pressure)

    es = (saturation_vapour_pressure(tmax) + saturation_vapour_pressure(tmin)) / 2.0
    ea = (rh / 100.0) * es
    vpd = max(0.0, es - ea)

    doy = inputs.day.timetuple().tm_yday
    ra = extraterrestrial_radiation(inputs.latitude_deg, doy)
    rso = (0.75 + 2e-5 * elevation) * ra

    # Net shortwave (albedo 0.23 for the grass reference surface).
    rns = (1.0 - ALBEDO_REFERENCE_GRASS) * solar

    # Net longwave. Rs/Rso is capped at 1.0 (FAO-56 footnote to eq. 39) because
    # measured Rs can slightly exceed the clear-sky estimate.
    if rso > 0:
        rs_rso = min(1.0, max(0.0, solar / rso))
    else:
        rs_rso = 1.0
    tmax_k = tmax + 273.16
    tmin_k = tmin + 273.16
    rnl = (
        STEFAN_BOLTZMANN
        * ((pow(tmax_k, 4) + pow(tmin_k, 4)) / 2.0)
        * (0.34 - 0.14 * pow(max(0.0, ea), 0.5))
        * (1.35 * rs_rso - 0.35)
    )
    rn = rns - rnl

    # Daily soil heat flux is negligible at this time step (FAO-56 eq. 42).
    g = 0.0

    numerator = GSC_MM_PER_MJ * vapour_slope * (rn - g) + gamma * (900.0 / (tmean + 273.0)) * wind * vpd
    denominator = vapour_slope + gamma * (1.0 + 0.34 * wind)
    et0 = numerator / denominator if denominator else 0.0
    if et0 < 0:
        # Negative values can appear on rare cold, cloudy days; ET₀ is defined
        # as a non-negative demand.
        notes.append("Computed ET₀ was negative and has been set to zero.")
        et0 = 0.0

    return Et0Result(
        et0_mm_day=round(et0, 4),
        missing_inputs=[],
        notes=notes,
        components={
            "delta_kpa_per_c": round(vapour_slope, 5),
            "gamma_kpa_per_c": round(gamma, 5),
            "es_kpa": round(es, 4),
            "ea_kpa": round(ea, 4),
            "vpd_kpa": round(vpd, 4),
            "rn_mj_m2_day": round(rn, 4),
            "rso_mj_m2_day": round(rso, 4),
            "wind_ms": round(wind, 3),
            "pressure_kpa": round(pressure, 3),
        },
    )


# Local trig helpers keep the equations readable.
def _sin(value: float) -> float:
    return math.sin(value)


def _cos(value: float) -> float:
    return math.cos(value)


def _tan(value: float) -> float:
    return math.tan(value)


def _acos(value: float) -> float:
    return math.acos(value)
