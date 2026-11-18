"""Relative surface-wetness and optical-condition classes.

SCOPE
-----
Sentinel-1 backscatter is a *relative* surface signal, not a measurement of
volumetric soil moisture. It changes with soil moisture, but also with surface
roughness, vegetation cover, crop structure and incidence angle. This module
therefore reports a bounded relative score and a three-class category, both
documented as heuristics, and never converts backscatter to mm or % volumetric
water.

THRESHOLDS (documented heuristics for irrigated cropland)
---------------------------------------------------------
VV backscatter (dB)   dry         < -17
                      near normal -17 … -12
                      wet         > -12
These cut-points come from published Sentinel-1 soil-moisture work on bare and
sparsely covered agricultural fields. They are not calibrated to this field and
must not be read as a moisture percentage.

NDVI                  sparse       < 0.20
                      moderate     0.20 … 0.50
                      dense        > 0.50
NDMI                  low          < 0.00
                      moderate     0.00 … 0.20
                      high         > 0.20
NDVI/NDMI classes describe canopy amount and canopy water content; neither is a
disease diagnosis.

STAGE-AWARE BANDS
-----------------
The classes above are the fallback for a location without crop context. When a
crop profile supplies per-stage bands (`app.crops.base.VegetationExpectation`),
the same index value is classified against that stage: NDVI 0.35 is dense for
emerging wheat and sparse for a bulking potato canopy. The bands are documented
agronomic heuristics, not variety-specific calibration.
"""

from typing import Literal

from app.crops.base import VegetationExpectation

WetnessCategory = Literal["dry", "near_normal", "wet", "unknown"]
VegetationCondition = Literal["sparse", "moderate", "dense", "unknown"]
MoistureCondition = Literal["low", "moderate", "high", "unknown"]

VV_DRY_THRESHOLD_DB = -17.0
VV_WET_THRESHOLD_DB = -12.0
VV_SCORE_MIN_DB = -22.0
VV_SCORE_MAX_DB = -5.0

NDVI_SPARSE_MAX = 0.20
NDVI_DENSE_MIN = 0.50
NDMI_LOW_MAX = 0.00
NDMI_HIGH_MIN = 0.20

# Fallback bands used when the caller has no crop/stage context.
GLOBAL_BANDS = VegetationExpectation(
    ndvi_sparse_max=NDVI_SPARSE_MAX,
    ndvi_dense_min=NDVI_DENSE_MIN,
    ndmi_low_max=NDMI_LOW_MAX,
    ndmi_high_min=NDMI_HIGH_MIN,
)

WETNESS_LABELS: dict[str, str] = {
    "dry": "Dry",
    "near_normal": "Near normal",
    "wet": "Wet",
    "unknown": "Unknown",
}
VEGETATION_LABELS: dict[str, str] = {
    "sparse": "Sparse canopy",
    "moderate": "Moderate canopy",
    "dense": "Dense canopy",
    "unknown": "Unknown",
}
MOISTURE_LABELS: dict[str, str] = {
    "low": "Low canopy water",
    "moderate": "Moderate canopy water",
    "high": "High canopy water",
    "unknown": "Unknown",
}


def relative_wetness_score(vv_db: float | None) -> float | None:
    """Map VV backscatter to a bounded 0–1 relative wetness score.

    The score is a linear stretch of the documented heuristic band
    (−22 dB → 0, −5 dB → 1). It is relative to that band, not to field capacity.
    """
    if vv_db is None:
        return None
    span = VV_SCORE_MAX_DB - VV_SCORE_MIN_DB
    score = (vv_db - VV_SCORE_MIN_DB) / span
    return round(min(1.0, max(0.0, score)), 3)


def wetness_category(vv_db: float | None) -> WetnessCategory:
    if vv_db is None:
        return "unknown"
    if vv_db < VV_DRY_THRESHOLD_DB:
        return "dry"
    if vv_db > VV_WET_THRESHOLD_DB:
        return "wet"
    return "near_normal"


def vegetation_condition(
    ndvi: float | None, bands: VegetationExpectation | None = None
) -> VegetationCondition:
    if ndvi is None:
        return "unknown"
    expected = bands or GLOBAL_BANDS
    if ndvi < expected.ndvi_sparse_max:
        return "sparse"
    if ndvi > expected.ndvi_dense_min:
        return "dense"
    return "moderate"


def moisture_condition(
    ndmi: float | None, bands: VegetationExpectation | None = None
) -> MoistureCondition:
    if ndmi is None:
        return "unknown"
    expected = bands or GLOBAL_BANDS
    if ndmi < expected.ndmi_low_max:
        return "low"
    if ndmi > expected.ndmi_high_min:
        return "high"
    return "moderate"


def wetness_interpretation(vv_db: float | None) -> str:
    category = wetness_category(vv_db)
    if category == "dry":
        return (
            "VV backscatter is in the dry band for this heuristic. The surface "
            "return suggests low near-surface wetness; confirm with the irrigation "
            "balance before irrigating."
        )
    if category == "wet":
        return (
            "VV backscatter is in the wet band for this heuristic. The surface "
            "return suggests high near-surface wetness, which may also reflect "
            "roughness or dense canopy rather than water alone."
        )
    if category == "near_normal":
        return (
            "VV backscatter sits inside the mid band. Surface wetness is not "
            "anomalous in either direction for this heuristic."
        )
    return "Sentinel-1 backscatter is unavailable, so surface wetness is not classified."


def vegetation_interpretation(
    ndvi: float | None,
    ndmi: float | None,
    *,
    bands: VegetationExpectation | None = None,
    crop_name: str | None = None,
    stage_name: str | None = None,
) -> str:
    if ndvi is None and ndmi is None:
        return (
            "Sentinel-2 indices are unavailable for the selected window, so "
            "canopy condition is not classified."
        )
    expected = bands or GLOBAL_BANDS
    if crop_name and stage_name:
        context = f"for {crop_name.lower()} at the {stage_name.lower()} stage"
    elif stage_name:
        context = f"for the {stage_name.lower()} stage"
    else:
        context = "for the all-stage classes"

    parts: list[str] = []
    if ndvi is not None:
        condition = vegetation_condition(ndvi, expected)
        if condition == "sparse":
            parts.append(
                f"NDVI {ndvi:.2f} is below the {expected.ndvi_sparse_max:.2f} "
                f"sparse-canopy threshold {context}."
            )
        elif condition == "dense":
            parts.append(
                f"NDVI {ndvi:.2f} is above the {expected.ndvi_dense_min:.2f} "
                f"dense-canopy threshold {context}."
            )
        else:
            parts.append(
                f"NDVI {ndvi:.2f} sits between the {expected.ndvi_sparse_max:.2f} "
                f"and {expected.ndvi_dense_min:.2f} thresholds {context}."
            )
    if ndmi is not None:
        condition = moisture_condition(ndmi, expected)
        if condition == "low":
            parts.append(
                f"NDMI {ndmi:.2f} is below the {expected.ndmi_low_max:.2f} "
                f"low-canopy-water threshold {context}."
            )
        elif condition == "high":
            parts.append(
                f"NDMI {ndmi:.2f} is above the {expected.ndmi_high_min:.2f} "
                f"high-canopy-water threshold {context}."
            )
        else:
            parts.append(
                f"NDMI {ndmi:.2f} sits between the {expected.ndmi_low_max:.2f} "
                f"and {expected.ndmi_high_min:.2f} thresholds {context}."
            )
    parts.append("These indices describe canopy condition only and do not diagnose disease.")
    return " ".join(parts)
