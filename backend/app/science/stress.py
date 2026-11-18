"""
Environmental crop-stress indicators.

SCOPE
-----
This module describes heat, frost, water and rainfall-anomaly stress using
weather data. It does NOT diagnose disease, pests or nutrient deficiency, and
labels itself accordingly in every response. Crop-specific thresholds (heat,
frost, depletion fraction) are supplied by the crop registry; the defaults
below match wheat.

INDICATORS AND THRESHOLDS
-------------------------
Heat   : daily Tmax ≥ 30 °C during the recent 14 days. Wheat grain fill is
         sensitive to temperatures above ~30 °C. 0 days = good, 1–2 = watch,
         ≥ 3 = stress.
Frost  : daily Tmin ≤ 0 °C in the recent 14 days. Any frost = watch, ≥ 3 = stress.
Water  : final root-zone depletion fraction. < 0.55 good, 0.55–0.80 watch,
         ≥ 0.80 stress (consistent with the irrigation thresholds).
Rain   : last-30-day rainfall compared with the POWER climatological normal for
         the same month. −30 % = watch, −50 % = stress, +100 % = watch (excess).

The thresholds are documented agronomic heuristics with references in the README;
they are not calibrated against yield observations.
"""

from dataclasses import dataclass
from datetime import date
from typing import Literal

HealthStatus = Literal["good", "moderate", "stressed", "insufficient_data"]
IndicatorStatus = Literal["good", "watch", "stress", "unknown"]

HEAT_WINDOW_DAYS = 14
FROST_WINDOW_DAYS = 14
HEAT_THRESHOLD_C = 30.0
FROST_THRESHOLD_C = 0.0
HEAT_STRESS_DAYS = 3
FROST_STRESS_DAYS = 3
WATER_WATCH_FRACTION = 0.55
WATER_STRESS_FRACTION = 0.80
RAIN_DEFICIT_WATCH_PCT = -30.0
RAIN_DEFICIT_STRESS_PCT = -50.0
RAIN_EXCESS_WATCH_PCT = 100.0


@dataclass(frozen=True)
class HealthIndicator:
    id: str
    label: str
    value: float | int | str | None
    unit: str | None
    status: IndicatorStatus
    interpretation: str


@dataclass(frozen=True)
class DailyTemperature:
    day: date
    tmax_c: float | None
    tmin_c: float | None


@dataclass(frozen=True)
class HealthAssessment:
    status: HealthStatus
    status_reason: str
    indicators: list[HealthIndicator]


@dataclass(frozen=True)
class IndicatorAgreement:
    percent: float | None
    known: int
    total: int
    stressed: int


def summarise_indicator_agreement(indicators: list[HealthIndicator]) -> IndicatorAgreement:
    """Share of known indicators without a stress flag.

    This is deliberately not a "crop health percentage": it is a transparent
    description of the available indicators, and it stays None when no indicator
    could be computed.
    """
    known = [indicator for indicator in indicators if indicator.status != "unknown"]
    stressed = [indicator for indicator in known if indicator.status == "stress"]
    if not known:
        return IndicatorAgreement(percent=None, known=0, total=len(indicators), stressed=0)
    percent = round((1.0 - len(stressed) / len(known)) * 100.0, 1)
    return IndicatorAgreement(
        percent=percent,
        known=len(known),
        total=len(indicators),
        stressed=len(stressed),
    )


def heat_stress_indicator(
    days: list[DailyTemperature], threshold_c: float = HEAT_THRESHOLD_C
) -> HealthIndicator:
    recent = days[-HEAT_WINDOW_DAYS:]
    values = [d.tmax_c for d in recent if d.tmax_c is not None]
    if not values:
        return HealthIndicator(
            id="heat",
            label=f"Heat-stress days (Tmax ≥ {threshold_c:.0f} °C)",
            value=None,
            unit="days",
            status="unknown",
            interpretation="Maximum temperature is unavailable, so heat stress cannot be assessed.",
        )

    count = sum(1 for value in values if value >= threshold_c)
    hottest = max(values)
    if count >= HEAT_STRESS_DAYS:
        status: IndicatorStatus = "stress"
        interpretation = (
            f"{count} of the last {len(values)} days exceeded {threshold_c:.0f} °C "
            f"(hottest {hottest:.1f} °C). Sustained heat can reduce yield."
        )
    elif count > 0:
        status = "watch"
        interpretation = (
            f"{count} day(s) exceeded {threshold_c:.0f} °C (hottest {hottest:.1f} °C). "
            "Watch the forecast around flowering."
        )
    else:
        status = "good"
        interpretation = (
            f"No day exceeded {threshold_c:.0f} °C in the last {len(values)} days "
            f"(hottest {hottest:.1f} °C)."
        )

    return HealthIndicator(
        id="heat",
        label=f"Heat-stress days (Tmax ≥ {threshold_c:.0f} °C)",
        value=count,
        unit="days",
        status=status,
        interpretation=interpretation,
    )


def frost_indicator(
    days: list[DailyTemperature], threshold_c: float = FROST_THRESHOLD_C
) -> HealthIndicator:
    recent = days[-FROST_WINDOW_DAYS:]
    values = [d.tmin_c for d in recent if d.tmin_c is not None]
    if not values:
        return HealthIndicator(
            id="frost",
            label=f"Frost days (Tmin ≤ {threshold_c:.0f} °C)",
            value=None,
            unit="days",
            status="unknown",
            interpretation="Minimum temperature is unavailable, so frost cannot be assessed.",
        )

    count = sum(1 for value in values if value <= threshold_c)
    coldest = min(values)
    if count >= FROST_STRESS_DAYS:
        status: IndicatorStatus = "stress"
        interpretation = f"{count} frost days in the last {len(values)}; coldest {coldest:.1f} °C."
    elif count > 0:
        status = "watch"
        interpretation = f"{count} frost day(s) in the last {len(values)}; coldest {coldest:.1f} °C."
    else:
        status = "good"
        interpretation = f"No frost in the last {len(values)} days (coldest {coldest:.1f} °C)."

    return HealthIndicator(
        id="frost",
        label=f"Frost days (Tmin ≤ {threshold_c:.0f} °C)",
        value=count,
        unit="days",
        status=status,
        interpretation=interpretation,
    )


def water_stress_indicator(
    depletion_fraction: float | None,
    stress_days: int,
    watch_fraction: float = WATER_WATCH_FRACTION,
) -> HealthIndicator:
    if depletion_fraction is None:
        return HealthIndicator(
            id="water",
            label="Root-zone water stress",
            value=None,
            unit=None,
            status="unknown",
            interpretation="The water balance could not be computed, so water stress is unknown.",
        )

    if depletion_fraction >= WATER_STRESS_FRACTION:
        status: IndicatorStatus = "stress"
        interpretation = (
            f"Depletion is {depletion_fraction * 100:.0f}% of total available water "
            f"({stress_days} stressed day(s))."
        )
    elif depletion_fraction >= watch_fraction:
        status = "watch"
        interpretation = (
            f"Depletion is {depletion_fraction * 100:.0f}% of total available water; "
            "approaching the stress threshold."
        )
    else:
        status = "good"
        interpretation = (
            f"Depletion is {depletion_fraction * 100:.0f}% of total available water; "
            "adequate for the crop stage."
        )

    return HealthIndicator(
        id="water",
        label="Root-zone water stress",
        value=round(depletion_fraction, 3),
        unit="fraction of TAW",
        status=status,
        interpretation=interpretation,
    )


def rainfall_anomaly_indicator(
    recent_30d_mm: float | None,
    normal_30d_mm: float | None,
    *,
    available_days: int | None = None,
) -> HealthIndicator:
    if recent_30d_mm is None or normal_30d_mm is None or normal_30d_mm <= 0:
        if recent_30d_mm is None and available_days is not None and available_days < 24:
            reason = (
                f"A 30-day anomaly needs at least 24 days of rainfall records; only "
                f"{available_days} day(s) are available since planting."
            )
        else:
            reason = (
                "A climatological normal is unavailable, so the rainfall anomaly cannot be computed."
            )
        return HealthIndicator(
            id="rain_anomaly",
            label="Rainfall anomaly (30 days)",
            value=None,
            unit="%",
            status="unknown",
            interpretation=reason,
        )

    anomaly_pct = ((recent_30d_mm - normal_30d_mm) / normal_30d_mm) * 100.0
    if anomaly_pct <= RAIN_DEFICIT_STRESS_PCT:
        status: IndicatorStatus = "stress"
        interpretation = (
            f"Rainfall is {abs(anomaly_pct):.0f}% below the climatological normal "
            f"({recent_30d_mm:.1f} mm vs {normal_30d_mm:.1f} mm)."
        )
    elif anomaly_pct <= RAIN_DEFICIT_WATCH_PCT:
        status = "watch"
        interpretation = (
            f"Rainfall is {abs(anomaly_pct):.0f}% below normal "
            f"({recent_30d_mm:.1f} mm vs {normal_30d_mm:.1f} mm)."
        )
    elif anomaly_pct >= RAIN_EXCESS_WATCH_PCT:
        status = "watch"
        interpretation = (
            f"Rainfall is {anomaly_pct:.0f}% above normal; waterlogging and runoff risk may increase."
        )
    else:
        status = "good"
        interpretation = (
            f"Rainfall is near normal ({anomaly_pct:+.0f}%; "
            f"{recent_30d_mm:.1f} mm vs {normal_30d_mm:.1f} mm)."
        )

    return HealthIndicator(
        id="rain_anomaly",
        label="Rainfall anomaly (30 days)",
        value=round(anomaly_pct, 1),
        unit="% vs normal",
        status=status,
        interpretation=interpretation,
    )


def vegetation_indicator(
    *, available: bool, latest_ndvi: float | None, trend: str
) -> HealthIndicator:
    if not available or latest_ndvi is None:
        return HealthIndicator(
            id="vegetation",
            label="Vegetation index (NDVI)",
            value=None,
            unit=None,
            status="unknown",
            interpretation=(
                "No NDVI observation is available for this field, so vegetation condition is "
                "not assessed rather than guessed."
            ),
        )

    if trend == "declining":
        status: IndicatorStatus = "watch"
        interpretation = f"NDVI is {latest_ndvi:.2f} and declining; inspect the field for stress or damage."
    elif trend == "improving":
        status = "good"
        interpretation = f"NDVI is {latest_ndvi:.2f} and improving."
    elif trend == "unknown":
        status = "good"
        interpretation = (
            f"NDVI is {latest_ndvi:.2f} in the latest usable scene. A single acquisition "
            "does not establish a trend."
        )
    else:
        status = "good"
        interpretation = f"NDVI is {latest_ndvi:.2f} with a stable trend. NDVI indicates condition, not disease."

    return HealthIndicator(
        id="vegetation",
        label="Vegetation index (NDVI)",
        value=round(latest_ndvi, 3),
        unit="index",
        status=status,
        interpretation=interpretation,
    )


def assess_health(indicators: list[HealthIndicator]) -> HealthAssessment:
    """
    Combine indicators into an overall status.

    At least two known indicators are required; otherwise the honest answer is
    "insufficient data". A single stressed indicator is enough to mark the field
    as stressed, because stress is actionable and should not be averaged away.
    """
    known = [indicator for indicator in indicators if indicator.status != "unknown"]
    if len(known) < 2:
        return HealthAssessment(
            status="insufficient_data",
            status_reason=(
                f"Only {len(known)} environmental indicator(s) could be computed; "
                "at least two are required for a defensible assessment."
            ),
            indicators=indicators,
        )

    stressed = [indicator for indicator in known if indicator.status == "stress"]
    watch = [indicator for indicator in known if indicator.status == "watch"]

    if stressed:
        ids = ", ".join(indicator.id for indicator in stressed)
        return HealthAssessment(
            status="stressed",
            status_reason=f"Stress-level indicator(s): {ids}.",
            indicators=indicators,
        )
    if watch:
        ids = ", ".join(indicator.id for indicator in watch)
        return HealthAssessment(
            status="moderate",
            status_reason=f"Watch-level indicator(s): {ids}.",
            indicators=indicators,
        )
    return HealthAssessment(
        status="good",
        status_reason="All computable environmental indicators are within their acceptable ranges.",
        indicators=indicators,
    )
