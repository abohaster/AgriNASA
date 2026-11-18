"""Additional Earth Engine products for location intelligence.

Adds EVI, land cover, SMAP surface soil moisture, GPM IMERG monthly rainfall and
a short NDVI history on top of the existing Sentinel-2 NDVI/NDMI analysis.

Every product is optional: if a collection or permission is unavailable the
response marks that block ``unavailable`` instead of failing the request. Values
are area means over a real polygon or a disclosed 500 m buffer, never a claim
about a single plant or a soil probe.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.exceptions import GEEUnavailable
from app.services import earth_engine

logger = logging.getLogger(__name__)

S2_COLLECTION = "COPERNICUS/S2_SR_HARMONIZED"
LAND_COVER_COLLECTION = "GOOGLE/DYNAMICWORLD/V1"
SMAP_COLLECTION = "NASA/SMAP/SPL4SMGP/008"
IMERG_MONTHLY_COLLECTION = "NASA/GPM_L3/IMERG_MONTHLY_V07"

LAND_COVER_CLASSES = {
    0: "Water",
    1: "Trees",
    2: "Grass",
    3: "Flooded vegetation",
    4: "Crops",
    5: "Shrub and scrub",
    6: "Built area",
    7: "Bare ground",
    8: "Snow and ice",
}


def _geometry(ee: Any, latitude: float, longitude: float, geometry: dict[str, Any] | None) -> Any:
    if geometry:
        return ee.Geometry.Polygon(geometry["coordinates"])
    return ee.Geometry.Point([longitude, latitude]).buffer(500)


def _mask_clouds(image: Any) -> Any:
    scl = image.select("SCL")
    clear = (
        scl.neq(3)
        .And(scl.neq(8))
        .And(scl.neq(9))
        .And(scl.neq(10))
        .And(scl.neq(11))
    )
    return image.updateMask(clear).divide(10000)


def _reduce(ee: Any, image: Any, geometry: Any, scale: int, reducer: Any = None) -> dict[str, Any]:
    dictionary = image.reduceRegion(
        reducer=reducer or ee.Reducer.mean(),
        geometry=geometry,
        scale=scale,
        maxPixels=1_000_000_000,
        bestEffort=True,
    )
    return dictionary.getInfo() or {}


def _number(stats: dict[str, Any], key: str, digits: int = 3) -> float | None:
    value = stats.get(key)
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if number != number else round(number, digits)


def _date_window(start: date, end: date) -> tuple[str, str]:
    return start.isoformat(), (end + timedelta(days=1)).isoformat()


def _composite(ee: Any, geometry: Any, start: date, end: date) -> Any:
    return (
        ee.ImageCollection(S2_COLLECTION)
        .filterBounds(geometry)
        .filterDate(*_date_window(start, end))
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 70))
        .map(_mask_clouds)
        .median()
    )


def _monthly_ndvi(ee: Any, geometry: Any, months: int) -> list[dict[str, Any]]:
    today = date.today()
    start = date(today.year, today.month, 1)
    series: list[dict[str, Any]] = []
    for offset in range(months - 1, -1, -1):
        month_index = start.year * 12 + (start.month - 1) - offset
        month_start = date(month_index // 12, month_index % 12 + 1, 1)
        next_month = date((month_index + 1) // 12, (month_index + 1) % 12 + 1, 1)
        try:
            image = _composite(ee, geometry, month_start, next_month - timedelta(days=1))
            count = (
                ee.ImageCollection(S2_COLLECTION)
                .filterBounds(geometry)
                .filterDate(month_start.isoformat(), next_month.isoformat())
                .size()
                .getInfo()
            )
            if not count:
                continue
            index = image.normalizedDifference(["B8", "B4"]).rename("ndvi")
            stats = _reduce(ee, index, geometry, 20)
            value = _number(stats, "ndvi")
            if value is not None:
                series.append({"month": month_start.isoformat()[:7], "ndvi": value, "scenes": int(count)})
        except Exception as exc:  # a single missing month must not fail the block
            logger.info("Monthly NDVI unavailable for %s: %s", month_start, type(exc).__name__)
    return series


def observe(
    latitude: float,
    longitude: float,
    *,
    geometry: dict[str, Any] | None = None,
    history_months: int = 6,
) -> dict[str, Any]:
    """Latest vegetation, land-cover, SMAP and IMERG values for the area."""
    try:
        ee = earth_engine.initialize()
    except GEEUnavailable as exc:
        return {"available": False, "reason": exc.message, "sources": []}

    area = _geometry(ee, latitude, longitude, geometry)
    try:
        area_ha = float(area.area(1).getInfo()) / 10_000.0
    except Exception:
        area_ha = None

    today = date.today()
    latest_start = today - timedelta(days=60)
    previous_end = latest_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=59)

    result: dict[str, Any] = {
        "available": True,
        "geometry_source": "polygon" if geometry else "point_buffer",
        "area_ha": round(area_ha, 1) if area_ha is not None else None,
        "buffer_m": None if geometry else 500,
        "period": {
            "latest_start": latest_start.isoformat(),
            "latest_end": today.isoformat(),
        },
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sources": [],
        "limitations": [
            "Satellite indices are area means, not a measurement of one plant.",
            "Optical indices need a cloud-free Sentinel-2 pass; long gaps reduce confidence.",
            "SMAP soil moisture represents the top ~5 cm at ~9-11 km and is not a probe reading at depth.",
            "Land cover is a per-pixel classification aggregated to the dominant class.",
        ],
    }

    try:
        latest = _composite(ee, area, latest_start, today)
        previous = _composite(ee, area, previous_start, previous_end)
        ndvi_image = latest.normalizedDifference(["B8", "B4"]).rename("ndvi")
        ndmi_image = latest.normalizedDifference(["B8", "B11"]).rename("ndmi")
        evi_image = latest.expression(
            "2.5 * (NIR - RED) / (NIR + 6 * RED + 7.5 * BLUE + 1)",
            {"NIR": latest.select("B8"), "RED": latest.select("B4"), "BLUE": latest.select("B2")},
        ).rename("evi")
        previous_ndvi = previous.normalizedDifference(["B8", "B4"]).rename("ndvi")

        ndvi = _number(_reduce(ee, ndvi_image, area, 10), "ndvi")
        ndmi = _number(_reduce(ee, ndmi_image, area, 20), "ndmi")
        evi = _number(_reduce(ee, evi_image, area, 10), "evi")
        prior_ndvi = _number(_reduce(ee, previous_ndvi, area, 10), "ndvi")

        result["vegetation"] = {
            "ndvi": ndvi,
            "evi": evi,
            "ndmi": ndmi,
            "ndvi_previous": prior_ndvi,
            "ndvi_change": round(ndvi - prior_ndvi, 3) if ndvi is not None and prior_ndvi is not None else None,
            "previous_period": {"start": previous_start.isoformat(), "end": previous_end.isoformat()},
        }
        result["sources"].append("gee-ndvi")
        if evi is not None:
            result["sources"].append("gee-evi")
        result["monthly_ndvi"] = _monthly_ndvi(ee, area, max(0, min(history_months, 12)))
    except Exception as exc:
        logger.warning("Sentinel-2 indices unavailable: %s", type(exc).__name__)
        result["vegetation"] = {"unavailable": True, "reason": "No usable Sentinel-2 composite in the window."}

    try:
        land_cover_image = (
            ee.ImageCollection(LAND_COVER_COLLECTION)
            .filterBounds(area)
            .filterDate((today - timedelta(days=120)).isoformat(), today.isoformat())
            .sort("system:time_start", False)
            .first()
        )
        stats = land_cover_image.select("label").reduceRegion(
            reducer=ee.Reducer.mode(),
            geometry=area,
            scale=10,
            maxPixels=1_000_000_000,
            bestEffort=True,
        ).getInfo() or {}
        code = stats.get("label")
        code_int = int(code) if code is not None else None
        result["land_cover"] = {
            "class": LAND_COVER_CLASSES.get(code_int, "Unknown") if code_int is not None else "Unavailable",
            "confidence": None,
            "note": "Dominant Dynamic World class over the area; class probabilities are not averaged here.",
        }
        result["sources"].append("gee-landcover")
    except Exception as exc:
        logger.info("Dynamic World land cover unavailable: %s", type(exc).__name__)
        result["land_cover"] = {"class": "Unavailable", "note": "No recent land-cover image for the area."}

    try:
        smap = (
            ee.ImageCollection(SMAP_COLLECTION)
            .filterBounds(area)
            .filterDate((today - timedelta(days=7)).isoformat(), today.isoformat())
            .select("sm_surface")
            .mean()
        )
        stats = _reduce(ee, smap, area, 11000)
        value = _number(stats, "sm_surface", 4)
        result["soil_moisture_smap"] = {
            "percent_by_volume": round(value * 100.0, 1) if value is not None else None,
            "depth_note": "SMAP L4 surface (~0-5 cm) at ~9-11 km; not a field probe.",
        }
        if value is not None:
            result["sources"].append("gee-smap")
    except Exception as exc:
        logger.info("SMAP unavailable: %s", type(exc).__name__)
        result["soil_moisture_smap"] = {"percent_by_volume": None, "reason": "SMAP could not be read."}

    try:
        first_of_month = date(today.year, today.month, 1)
        last_month_end = first_of_month - timedelta(days=1)
        last_month_start = date(last_month_end.year, last_month_end.month, 1)
        imerg = (
            ee.ImageCollection(IMERG_MONTHLY_COLLECTION)
            .filterBounds(area)
            .filterDate(last_month_start.isoformat(), first_of_month.isoformat())
            .select("precipitation")
            .mean()
        )
        stats = _reduce(ee, imerg, area, 11000)
        value = _number(stats, "precipitation", 1)
        result["gpm_monthly"] = {
            "month": last_month_start.isoformat()[:7],
            "precipitation_mm": value,
            "note": "NASA GPM IMERG monthly satellite estimate (~0.1°), not a rain gauge.",
        }
        if value is not None:
            result["sources"].append("gee-imerg")
    except Exception as exc:
        logger.info("GPM IMERG unavailable: %s", type(exc).__name__)
        result["gpm_monthly"] = {"precipitation_mm": None, "reason": "IMERG could not be read."}

    return result
