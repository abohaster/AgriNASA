"""
Irrigation demand classification, refill requirement and confidence.

WHAT THIS FILE CALCULATES
-------------------------
1. A demand class (LOW / MODERATE / HIGH / UNKNOWN) from computed depletion,
   recent rainfall and current crop water use.
2. The net water needed to refill the root zone to field capacity, and a gross
   requirement after application efficiency.
3. A qualitative confidence label with explicit reasons.

WHY THRESHOLDS ARE CODE (NOT AI)
--------------------------------
A farmer may act on this output. Every class boundary is visible below and is
covered by tests. The language model may *explain* these numbers but cannot
compute or change them.

THRESHOLD RATIONALE
-------------------
* RAW (readily available water) = p × TAW. Depletion at/below RAW is the usual
  trigger zone for irrigation scheduling.
* MODERATE begins at the crop's FAO-56 p value (55 % of TAW for wheat, 35 % for
  potato, 40 % for tomato), the point where readily available water is used up.
* HIGH begins at 80 % of TAW, or at 65 % when the last 7 days were dry and the
  current ETc is high (≥ 4.5 mm/day). This second condition captures a rapidly
  growing deficit that will cross 80 % within a few days.
These are transparent agronomic heuristics, not a validated prescription for a
specific field.

CONFIDENCE
----------
No percentage is invented. The label is assembled from documented factors:
input completeness, whether soil properties were user-supplied, simulation
length and data resolution. With NASA POWER alone the maximum is MEDIUM because
a ~50 km grid cannot resolve field-scale soil water.
"""

from dataclasses import dataclass

from app.science.interfaces import ConfidenceResult, DemandClassification

DEMAND_MODERATE_FRACTION = 0.55
DEMAND_HIGH_FRACTION = 0.80
DEMAND_HIGH_ACCELERATED_FRACTION = 0.65
DRY_WEEK_MM = 2.0
HIGH_ETC_MM_DAY = 4.5

# Typical application efficiency by system, used only to convert net → gross.
IRRIGATION_EFFICIENCY: dict[str, float] = {
    "drip": 0.90,
    "sprinkler": 0.75,
    "surface": 0.60,
}


def classify_demand(
    *,
    depletion_fraction: float | None,
    precipitation_last_7d_mm: float | None,
    etc_mm_day: float | None,
    stress_days: int,
    moderate_fraction: float = DEMAND_MODERATE_FRACTION,
    crop_name: str = "the crop",
) -> DemandClassification:
    """Return the demand class and the numerical reasons behind it.

    ``moderate_fraction`` is the crop's FAO-56 depletion fraction p, the point
    where readily available water is exhausted. The default matches wheat.
    """
    if depletion_fraction is None:
        return DemandClassification(
            level="unknown",
            reasons=["Root-zone depletion could not be computed from the available data."],
        )

    reasons: list[str] = [
        f"Root-zone depletion is {depletion_fraction * 100:.0f}% of total available water "
        f"(moderate threshold {moderate_fraction * 100:.0f}%, high {DEMAND_HIGH_FRACTION * 100:.0f}%)."
    ]

    if precipitation_last_7d_mm is None:
        reasons.append("Recent rainfall is unavailable, so only depletion was used.")
        recent_dry = False
    else:
        recent_dry = precipitation_last_7d_mm < DRY_WEEK_MM
        reasons.append(
            f"Rainfall in the last 7 days: {precipitation_last_7d_mm:.1f} mm "
            f"({'dry' if recent_dry else 'some recharge'})."
        )

    if etc_mm_day is not None:
        reasons.append(f"Current crop water use (ETc) is {etc_mm_day:.2f} mm/day.")
    if stress_days > 0:
        reasons.append(f"{stress_days} day(s) at or below the readily available water limit.")

    if depletion_fraction >= DEMAND_HIGH_FRACTION:
        reasons.append("Depletion has crossed the high-demand threshold.")
        return DemandClassification(level="high", reasons=reasons)

    accelerated = (
        depletion_fraction >= DEMAND_HIGH_ACCELERATED_FRACTION
        and recent_dry
        and etc_mm_day is not None
        and etc_mm_day >= HIGH_ETC_MM_DAY
    )
    if accelerated:
        reasons.append(
            "Depletion is above 65% while rainfall is negligible and atmospheric demand is high; "
            "the deficit is likely to cross the high threshold soon."
        )
        return DemandClassification(level="high", reasons=reasons)

    if depletion_fraction >= moderate_fraction:
        reasons.append(f"Depletion has passed the readily available water fraction for {crop_name.lower()}.")
        return DemandClassification(level="moderate", reasons=reasons)

    reasons.append(f"Depletion remains below the readily available water fraction for {crop_name.lower()}.")
    return DemandClassification(level="low", reasons=reasons)


def refill_requirements(
    *, depletion_mm: float | None, irrigation_system: str | None
) -> tuple[float | None, float | None, float | None]:
    """Return (net_mm, gross_mm, efficiency). Gross is None when efficiency is unknown."""
    if depletion_mm is None:
        return None, None, None

    net = max(0.0, depletion_mm)
    efficiency = IRRIGATION_EFFICIENCY.get((irrigation_system or "").lower())
    if efficiency is None or efficiency <= 0:
        return round(net, 1), None, None

    return round(net, 1), round(net / efficiency, 1), efficiency


@dataclass
class ConfidenceFactors:
    et0_coverage: float  # 0–1 fraction of days with a valid ET₀
    precipitation_coverage: float  # 0–1
    soil_provided: bool
    irrigation_system_provided: bool
    days_simulated: int
    vegetation_available: bool = False


def assess_confidence(factors: ConfidenceFactors) -> ConfidenceResult:
    """
    Build the qualitative confidence label.

    Scores start at 3 and lose one point per documented weakness. NASA POWER's
    coarse grid caps the result at MEDIUM (2) in this version; HIGH is reserved
    for analyses that include field-level observations.
    """
    score = 3
    reasons: list[str] = [
        "NASA POWER is a ~50 km reanalysis product; field-scale soil water cannot be resolved, "
        "so this analysis is capped at medium confidence."
    ]
    score = min(score, 2)

    if factors.et0_coverage < 0.98:
        score -= 1
        reasons.append(
            f"Only {factors.et0_coverage * 100:.0f}% of days had complete ET₀ inputs; "
            "those gaps reduce certainty."
        )
    if factors.precipitation_coverage < 0.95:
        score -= 1
        reasons.append(
            f"Precipitation was missing on some days "
            f"({factors.precipitation_coverage * 100:.0f}% coverage)."
        )
    if not factors.soil_provided:
        score -= 1
        reasons.append("Soil texture was not provided; loam values were assumed for field capacity and wilting point.")
    else:
        reasons.append("Soil texture was supplied, but class-average water capacity is still an approximation.")
    if factors.days_simulated < 14:
        score -= 1
        reasons.append("Fewer than 14 days were simulated, so the bucket has little time to adjust.")
    if not factors.irrigation_system_provided:
        reasons.append("No irrigation system was specified, so only a net refill requirement is reported.")
    if not factors.vegetation_available:
        reasons.append("NDVI is unavailable, so vegetation condition cannot confirm the water balance.")

    level = "high" if score >= 3 else "medium" if score >= 2 else "low"
    return ConfidenceResult(level=level, reasons=_dedupe(reasons))


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result
