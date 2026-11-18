"""
Vegetation indices.

NDVI = (NIR − Red) / (NIR + Red)

* NIR and Red are surface reflectances (0–1) in the near-infrared and red bands.
* NDVI ranges from −1 to +1. Healthy, dense vegetation reflects much more NIR than
  red and therefore has high positive values; bare soil is near 0; water is negative.
* The index indicates vegetation condition — it does NOT identify a specific
  disease, pest or nutrient deficiency. Any such claim would require a validated
  classification model and suitable imagery, which this version does not have.

This module is pure and unit-tested. The provider that retrieves real satellite
reflectances is optional and configured separately (see services/vegetation.py).
"""

from typing import Literal

VegetationTrend = Literal["improving", "declining", "stable", "unknown"]

# A change smaller than this is treated as noise rather than a trend.
TREND_THRESHOLD = 0.03


def normalized_difference(nir: float, red: float) -> float | None:
    """Generic normalized difference, used for NDVI and future indices."""
    denominator = nir + red
    if denominator == 0:
        return None
    value = (nir - red) / denominator
    return round(max(-1.0, min(1.0, value)), 4)


def ndvi(nir_reflectance: float, red_reflectance: float) -> float | None:
    """NDVI from band reflectances; returns None for invalid inputs."""
    if not (0.0 <= nir_reflectance <= 1.0 and 0.0 <= red_reflectance <= 1.0):
        return None
    return normalized_difference(nir_reflectance, red_reflectance)


def ndvi_trend(values: list[float]) -> VegetationTrend:
    """
    Compare the mean of the first third with the mean of the last third.

    This is deliberately simple and explainable. It is not a phenology model and
    does not account for cloud contamination or compositing gaps.
    """
    clean = [value for value in values if -1.0 <= value <= 1.0]
    if len(clean) < 4:
        return "unknown"

    window = max(1, len(clean) // 3)
    first_mean = sum(clean[:window]) / window
    last_mean = sum(clean[-window:]) / window
    change = last_mean - first_mean

    if change > TREND_THRESHOLD:
        return "improving"
    if change < -TREND_THRESHOLD:
        return "declining"
    return "stable"


def two_scene_trend(previous: float, latest: float) -> VegetationTrend:
    """Direction between two consecutive Sentinel-2 acquisitions.

    Uses the same noise threshold as `ndvi_trend`, but two dates cannot describe
    a seasonal trend — it is the most recent change only.
    """
    if not (-1.0 <= previous <= 1.0 and -1.0 <= latest <= 1.0):
        return "unknown"
    change = latest - previous
    if change > TREND_THRESHOLD:
        return "improving"
    if change < -TREND_THRESHOLD:
        return "declining"
    return "stable"
