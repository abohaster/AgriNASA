"""
Input and output validation for scientific calculations.

The first group of checks protects the models from physically impossible or
malformed *inputs* (e.g. RH = 140 %, wind = -2). They are intentionally
*permissive* within realistic bounds so unusual but valid climates are not
rejected.

The second group is the post-calculation guardrail: before a satellite index,
wetness estimate or weather value leaves the backend it is compared with its
plausibility bounds. A small overshoot (floating-point drift, rounding at a
unit edge) is clamped; a value far outside the range is rejected and the block
is marked unavailable instead of being displayed. Every change appends a short
code such as ``ndvi:clamped`` or ``relative_percent:recomputed`` to the
response, and a warning is written to the server log.
"""

import logging
import math
from dataclasses import replace
from typing import Any, Iterable

from app.schemas.satellite import SoilMoistureOut, VegetationIndicesOut
from app.science.sar_moisture import (
    moisture_condition,
    relative_wetness_score,
    vegetation_condition,
    vegetation_interpretation,
    wetness_category,
    wetness_interpretation,
)

logger = logging.getLogger(__name__)

# Accepted physical ranges for daily meteorological inputs.
TEMPERATURE_RANGE = (-60.0, 60.0)  # °C
HUMIDITY_RANGE = (0.0, 100.0)  # %
WIND_RANGE = (0.0, 60.0)  # m/s at 2 m
SOLAR_RANGE = (0.0, 45.0)  # MJ m-2 day-1
PRESSURE_RANGE = (50.0, 112.0)  # kPa
ELEVATION_RANGE = (-500.0, 6000.0)  # m
LATITUDE_RANGE = (-90.0, 90.0)  # degrees

INDEX_RANGE = (-1.0, 1.0)
VV_RANGE = (-45.0, 15.0)  # dB, wider than the heuristic band used for advice
VH_MINUS_VV_RANGE = (-40.0, 10.0)  # dB
RAIN_RANGE = (0.0, 500.0)  # mm per day
ET0_RANGE = (0.0, 30.0)  # mm per day
PERCENT_RANGE = (0.0, 100.0)
FRACTION_RANGE = (0.0, 1.0)

# Tolerances only absorb unit-edge rounding, never a real computation error.
# Percentages are clamped across a wide band because every percentage in this
# app is a bounded display score; beyond that band the value is a real anomaly.
INDEX_TOLERANCE = 0.02
DECIBEL_TOLERANCE = 0.5
PERCENT_TOLERANCE = 100.0
FRACTION_TOLERANCE = 0.01
TEMPERATURE_TOLERANCE = 2.0
WIND_TOLERANCE = 1.0
RAIN_TOLERANCE = 1.0
ET0_TOLERANCE = 0.5


def is_finite(value: float | None) -> bool:
    return value is not None and math.isfinite(value)


def in_range(value: float | None, bounds: tuple[float, float]) -> bool:
    return is_finite(value) and bounds[0] <= float(value) <= bounds[1]


def missing_labels(values: dict[str, float | None], labels: Iterable[str]) -> list[str]:
    """Return the human labels of the required inputs that are absent."""
    return [label for label in labels if not is_finite(values.get(label))]


def validate_coordinates(latitude: float, longitude: float) -> list[str]:
    problems: list[str] = []
    if not in_range(latitude, LATITUDE_RANGE):
        problems.append("Latitude must be between -90 and 90 degrees.")
    if not in_range(longitude, (-180.0, 180.0)):
        problems.append("Longitude must be between -180 and 180 degrees.")
    return problems


# ── Output guardrail ────────────────────────────────────────────────────────


def _record(field: str, action: str, corrections: list[str]) -> None:
    code = f"{field}:{action}"
    corrections.append(code)
    logger.warning("Plausibility guardrail corrected %s", code)


def _checked(
    value: float | None,
    bounds: tuple[float, float],
    tolerance: float,
    field: str,
    corrections: list[str],
) -> float | None:
    """Clamp a small overshoot, reject a gross outlier, leave valid values alone."""
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        _record(field, "rejected", corrections)
        return None
    if not math.isfinite(number):
        _record(field, "rejected", corrections)
        return None
    low, high = bounds
    if low <= number <= high:
        return number
    if low - tolerance <= number <= high + tolerance:
        _record(field, "clamped", corrections)
        return min(high, max(low, number))
    _record(field, "rejected", corrections)
    return None


def clamp_percent(
    value: float | None, field: str, corrections: list[str]
) -> int | None:
    checked = _checked(value, PERCENT_RANGE, PERCENT_TOLERANCE, field, corrections)
    return int(round(checked)) if checked is not None else None


def validate_vegetation(
    out: VegetationIndicesOut,
    *,
    bands: Any | None = None,
    crop_name: str | None = None,
    stage_name: str | None = None,
) -> tuple[VegetationIndicesOut, list[str]]:
    if not out.available:
        return out, []

    corrections: list[str] = []
    ndvi = _checked(out.ndvi, INDEX_RANGE, INDEX_TOLERANCE, "ndvi", corrections)
    ndmi = _checked(out.ndmi, INDEX_RANGE, INDEX_TOLERANCE, "ndmi", corrections)
    ndwi = _checked(out.ndwi, INDEX_RANGE, INDEX_TOLERANCE, "ndwi", corrections)
    cloud = _checked(
        out.cloud_cover_percent, PERCENT_RANGE, PERCENT_TOLERANCE, "cloud_cover_percent", corrections
    )
    fraction = _checked(
        out.valid_fraction, FRACTION_RANGE, FRACTION_TOLERANCE, "valid_fraction", corrections
    )

    if ndvi is None and ndmi is None:
        return (
            out.model_copy(
                update={
                    "available": False,
                    "ndvi": None,
                    "ndmi": None,
                    "ndwi": None,
                    "ndvi_condition": "unknown",
                    "ndmi_condition": "unknown",
                    "reason": (
                        "The satellite indices failed the plausibility check, so no "
                        "value is shown. Try again with a new acquisition."
                    ),
                    "interpretation": vegetation_interpretation(
                        None, None, bands=bands, crop_name=crop_name, stage_name=stage_name
                    ),
                }
            ),
            corrections,
        )

    ndvi_condition = vegetation_condition(ndvi, bands)
    ndmi_condition = moisture_condition(ndmi, bands)
    if out.ndvi_condition != ndvi_condition:
        _record("ndvi_condition", "recomputed", corrections)
    if out.ndmi_condition != ndmi_condition:
        _record("ndmi_condition", "recomputed", corrections)

    return (
        out.model_copy(
            update={
                "ndvi": round(ndvi, 3) if ndvi is not None else None,
                "ndmi": round(ndmi, 3) if ndmi is not None else None,
                "ndwi": round(ndwi, 3) if ndwi is not None else None,
                "ndvi_condition": ndvi_condition,
                "ndmi_condition": ndmi_condition,
                "cloud_cover_percent": round(cloud, 1) if cloud is not None else None,
                "valid_fraction": round(fraction, 3) if fraction is not None else None,
                "interpretation": vegetation_interpretation(
                    ndvi, ndmi, bands=bands, crop_name=crop_name, stage_name=stage_name
                ),
            }
        ),
        corrections,
    )


def validate_soil(out: SoilMoistureOut) -> tuple[SoilMoistureOut, list[str]]:
    if not out.available:
        return out, []

    corrections: list[str] = []
    vv = _checked(out.vv_db, VV_RANGE, DECIBEL_TOLERANCE, "vv_db", corrections)
    vh = _checked(out.vh_db, VV_RANGE, DECIBEL_TOLERANCE, "vh_db", corrections)
    ratio = _checked(
        out.vh_minus_vv_db, VH_MINUS_VV_RANGE, DECIBEL_TOLERANCE, "vh_minus_vv_db", corrections
    )
    score = _checked(out.relative_score, FRACTION_RANGE, FRACTION_TOLERANCE, "relative_score", corrections)
    percent = _checked(out.relative_percent, PERCENT_RANGE, PERCENT_TOLERANCE, "relative_percent", corrections)
    pixels = out.valid_pixels
    if pixels is not None and pixels < 0:
        pixels = None
        _record("valid_pixels", "rejected", corrections)

    if vv is None or (pixels or 0) <= 0:
        return (
            out.model_copy(
                update={
                    "available": False,
                    "category": "unknown",
                    "relative_score": None,
                    "relative_percent": None,
                    "vv_db": None,
                    "vh_db": None,
                    "vh_minus_vv_db": None,
                    "valid_pixels": pixels,
                    "reason": (
                        "The radar wetness calculation failed the plausibility check, "
                        "so no value is shown. Try again with a new acquisition."
                    ),
                    "interpretation": wetness_interpretation(None),
                }
            ),
            corrections,
        )

    # Recompute every derived value from the verified backscatter so a stored or
    # upstream inconsistency can never reach the client.
    expected_score = relative_wetness_score(vv)
    if expected_score is not None and (score is None or abs(score - expected_score) > FRACTION_TOLERANCE):
        if out.relative_score is not None:
            _record("relative_score", "recomputed", corrections)
        score = expected_score
    if score is not None:
        expected_percent = round(score * 100.0, 1)
        if percent is None or abs(percent - expected_percent) > PERCENT_TOLERANCE:
            if out.relative_percent is not None:
                _record("relative_percent", "recomputed", corrections)
            percent = expected_percent

    category = wetness_category(vv)
    if category != out.category:
        _record("category", "recomputed", corrections)

    return (
        out.model_copy(
            update={
                "category": category,
                "relative_score": round(score, 3) if score is not None else None,
                "relative_percent": round(percent, 1) if percent is not None else None,
                "vv_db": round(vv, 2),
                "vh_db": round(vh, 2) if vh is not None else None,
                "vh_minus_vv_db": round(ratio, 2) if ratio is not None else None,
                "valid_pixels": pixels,
                "interpretation": wetness_interpretation(vv),
            }
        ),
        corrections,
    )


def validate_weather_values(weather: Any) -> tuple[Any, list[str]]:
    """Return a corrected copy of a FarmerWeather-like object."""
    if not weather.available:
        return weather, []

    corrections: list[str] = []
    mean = _checked(
        weather.temperature_mean_c, TEMPERATURE_RANGE, TEMPERATURE_TOLERANCE, "temperature_mean_c", corrections
    )
    high = _checked(
        weather.temperature_max_c, TEMPERATURE_RANGE, TEMPERATURE_TOLERANCE, "temperature_max_c", corrections
    )
    low = _checked(
        weather.temperature_min_c, TEMPERATURE_RANGE, TEMPERATURE_TOLERANCE, "temperature_min_c", corrections
    )
    humidity = _checked(weather.humidity_pct, HUMIDITY_RANGE, PERCENT_TOLERANCE, "humidity_pct", corrections)
    wind = _checked(weather.wind_ms, WIND_RANGE, WIND_TOLERANCE, "wind_ms", corrections)
    rain = _checked(weather.rain_mm, RAIN_RANGE, RAIN_TOLERANCE, "rain_mm", corrections)
    et0 = _checked(weather.et0_mm_day, ET0_RANGE, ET0_TOLERANCE, "et0_mm_day", corrections)

    if high is not None and low is not None and high < low:
        high, low = low, high
        _record("temperature_range", "recomputed", corrections)
    if mean is not None and high is not None and low is not None and not (low - 1.0 <= mean <= high + 1.0):
        mean = (high + low) / 2.0
        _record("temperature_mean_c", "recomputed", corrections)

    if mean is None:
        return (
            weather.model_copy(
                update={
                    "available": False,
                    "date": None,
                    "temperature_mean_c": None,
                    "temperature_max_c": None,
                    "temperature_min_c": None,
                    "humidity_pct": None,
                    "wind_ms": None,
                    "rain_mm": None,
                    "et0_mm_day": None,
                    "reason": (
                        "The weather values failed the plausibility check, so today's "
                        "weather is not shown."
                    ),
                }
            ),
            corrections,
        )

    return (
        weather.model_copy(
            update={
                "temperature_mean_c": round(mean, 1),
                "temperature_max_c": round(high, 1) if high is not None else None,
                "temperature_min_c": round(low, 1) if low is not None else None,
                "humidity_pct": round(humidity, 0) if humidity is not None else None,
                "wind_ms": round(wind, 1) if wind is not None else None,
                "rain_mm": round(rain, 1) if rain is not None else None,
                "et0_mm_day": round(et0, 2) if et0 is not None else None,
            }
        ),
        corrections,
    )


def validate_forecast_days(days: list[Any]) -> tuple[list[Any], list[str]]:
    corrections: list[str] = []
    cleaned: list[Any] = []
    for index, day in enumerate(days):
        prefix = f"forecast_day[{index}]"
        high = _checked(
            day.temperature_max_c, TEMPERATURE_RANGE, TEMPERATURE_TOLERANCE, f"{prefix}.temperature_max_c", corrections
        )
        low = _checked(
            day.temperature_min_c, TEMPERATURE_RANGE, TEMPERATURE_TOLERANCE, f"{prefix}.temperature_min_c", corrections
        )
        rain = _checked(day.rain_mm, RAIN_RANGE, RAIN_TOLERANCE, f"{prefix}.rain_mm", corrections)
        wind = _checked(day.wind_max_ms, WIND_RANGE, WIND_TOLERANCE, f"{prefix}.wind_max_ms", corrections)
        if high is not None and low is not None and high < low:
            high, low = low, high
            _record(f"{prefix}.temperature_range", "recomputed", corrections)
        cleaned.append(
            replace(
                day,
                temperature_max_c=round(high, 1) if high is not None else None,
                temperature_min_c=round(low, 1) if low is not None else None,
                rain_mm=round(rain, 1) if rain is not None else None,
                wind_max_ms=round(wind, 1) if wind is not None else None,
            )
        )
    return cleaned, corrections
