"""ISRIC SoilGrids 2.0 soil properties for a point or field.

SoilGrids is a global 250 m machine-learning prediction of standard soil
properties, not a laboratory test of the selected field. Values are converted
to conventional units (pH, %, g/kg, g/cm³) and the response says so explicitly.

Two access paths share the same output:
* Earth Engine hosts the official ISRIC assets and answers one combined query in
  a couple of seconds, so it is preferred whenever Earth Engine is configured.
* The public REST API needs no key and remains the fallback. It is slow and
  occasionally flaky, so its result is cached for 30 days.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import get_settings
from app.exceptions import GEEUnavailable
from app.services.http_cache import cached_get_json

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 30 * 24 * 60 * 60
# Topsoil layers only: the public API becomes very slow when all six standard
# depths are requested, and 0-30 cm is the interval crop screening needs.
DEPTHS = ["0-5cm", "5-15cm", "15-30cm"]
PROPERTIES = ["phh2o", "soc", "clay", "sand", "silt", "bdod", "cec", "nitrogen"]

# SoilGrids publishes scaled integers; these convert to conventional units.
_SCALE = {
    "phh2o": 0.1,   # pH × 10
    "soc": 0.1,     # dg/kg → g/kg
    "clay": 0.1,    # g/kg → %
    "sand": 0.1,    # g/kg → %
    "silt": 0.1,    # g/kg → %
    "bdod": 0.01,   # cg/cm³ → g/cm³
    "cec": 0.1,     # mmol(c)/kg → cmol(c)/kg
    "nitrogen": 0.01,  # cg/kg → g/kg
}

# Earth Engine stores nitrogen in mg/kg, unlike the REST API's cg/kg.
_GEE_SCALE = {**_SCALE, "nitrogen": 0.001}
_GEE_DEPTHS = {"0-5cm": "0-5cm_mean", "5-15cm": "5-15cm_mean", "15-30cm": "15-30cm_mean"}


def usda_texture_class(clay_pct: float, sand_pct: float, silt_pct: float) -> str:
    """Approximate USDA texture class from modelled clay/sand/silt fractions."""
    total = clay_pct + sand_pct + silt_pct
    if total <= 0:
        return "unknown"
    clay = clay_pct * 100.0 / total
    sand = sand_pct * 100.0 / total
    silt = silt_pct * 100.0 / total

    if clay >= 40 and silt < 40 and sand <= 45:
        return "clay"
    if clay >= 35 and sand > 45:
        return "sandy clay"
    if clay >= 35 and silt >= 40:
        return "silty clay"
    if 27 <= clay < 40 and sand <= 45 and silt <= 40:
        return "clay loam"
    if 20 <= clay < 35 and sand > 45:
        return "sandy clay loam"
    if 20 <= clay < 35 and silt >= 40:
        return "silty clay loam"
    if silt >= 80 and clay < 12:
        return "silt"
    if silt >= 50 and clay < 27:
        return "silt loam"
    if sand >= 85 and clay < 10:
        return "sand"
    if sand >= 70 and clay < 15:
        return "loamy sand"
    if sand >= 50 and clay < 20:
        return "sandy loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "loam"
    return "loam"


def _mean(layer: dict[str, Any], depth: str) -> float | None:
    for entry in layer.get("depths", []):
        if entry.get("label") == depth:
            value = (entry.get("values") or {}).get("mean")
            try:
                return float(value)
            except (TypeError, ValueError):
                return None
    return None


def _scaled(value: float | None, prop: str, scale: dict[str, float] | None = None) -> float | None:
    if value is None:
        return None
    return round(value * (scale or _SCALE)[prop], 2)


def _weighted(values: dict[str, float | None], weights: dict[str, float]) -> float | None:
    pairs = [(values[depth], weights[depth]) for depth in weights if values.get(depth) is not None]
    if not pairs:
        return None
    total_weight = sum(weight for _, weight in pairs)
    return sum(value * weight for value, weight in pairs) / total_weight  # type: ignore[operator]


def _assemble(
    per_depth: list[dict[str, Any]],
    *,
    fetched_at: str,
    aggregation: str,
    access: str,
) -> dict[str, Any]:
    weights = {"0-5cm": 5.0, "5-15cm": 10.0, "15-30cm": 15.0}
    top: dict[str, float | None] = {
        prop: _weighted({row["depth"]: row.get(prop) for row in per_depth}, weights)
        for prop in PROPERTIES
    }
    clay = top.get("clay")
    sand = top.get("sand")
    silt = top.get("silt")
    texture = (
        usda_texture_class(clay, sand, silt) if None not in (clay, sand, silt) else "unknown"
    )
    return {
        "fetched_at": fetched_at,
        "source_id": "soilgrids",
        "access": access,
        "aggregation": aggregation,
        "topsoil": {
            "ph": round(top["phh2o"], 1) if top.get("phh2o") is not None else None,
            "organic_carbon_g_kg": round(top["soc"], 1) if top.get("soc") is not None else None,
            "clay_pct": round(clay, 1) if clay is not None else None,
            "sand_pct": round(sand, 1) if sand is not None else None,
            "silt_pct": round(silt, 1) if silt is not None else None,
            "bulk_density_g_cm3": round(top["bdod"], 2) if top.get("bdod") is not None else None,
            "cec_cmol_kg": round(top["cec"], 1) if top.get("cec") is not None else None,
            "nitrogen_g_kg": round(top["nitrogen"], 2) if top.get("nitrogen") is not None else None,
        },
        "texture": {
            "class": texture,
            "clay_pct": round(clay, 1) if clay is not None else None,
            "sand_pct": round(sand, 1) if sand is not None else None,
            "silt_pct": round(silt, 1) if silt is not None else None,
            "method": "approximate USDA class from modelled fractions",
        },
        "layers": per_depth,
    }


def _fetch_gee(
    latitude: float, longitude: float, geometry: dict[str, Any] | None
) -> dict[str, Any] | None:
    from app.services import earth_engine  # local import keeps `ee` optional

    ee = earth_engine.initialize()
    images = []
    for prop in PROPERTIES:
        source = ee.Image(f"projects/soilgrids-isric/{prop}_mean")
        bands = [f"{prop}_{suffix}" for suffix in _GEE_DEPTHS.values()]
        images.append(source.select(bands))
    combined = ee.Image.cat(images)

    if geometry:
        polygon = ee.Geometry.Polygon(geometry["coordinates"])
        # A small field can sit entirely on SoilGrids' masked urban/water
        # pixels, so widen around the field centre until data appears.
        centre = polygon.centroid(1)
        regions = [(polygon, "the selected field polygon")] + [
            (centre.buffer(radius), f"a {radius} m buffer around the field centre")
            for radius in (250, 1000, 2500, 5000)
        ]
    else:
        # SoilGrids has masked urban/water pixels; a small ring can fall entirely
        # inside one. Widen until at least one layer has data and say how wide.
        point = ee.Geometry.Point([longitude, latitude])
        regions = [
            (point.buffer(radius), f"a {radius} m buffer around the point")
            for radius in (250, 1000, 2500, 5000)
        ]

    values: dict[str, Any] | None = None
    area_note = regions[0][1]
    for region, note in regions:
        candidate = combined.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=region,
            scale=250,
            crs="EPSG:4326",
            bestEffort=True,
            maxPixels=10_000_000,
        ).getInfo()
        if candidate and any(value is not None for value in candidate.values()):
            values = candidate
            area_note = note
            break
    if not values:
        return None

    per_depth: list[dict[str, Any]] = []
    for depth, suffix in _GEE_DEPTHS.items():
        row: dict[str, Any] = {"depth": depth}
        for prop in PROPERTIES:
            raw = values.get(f"{prop}_{suffix}")
            row[prop] = _scaled(raw, prop, _GEE_SCALE) if raw is not None else None
        per_depth.append(row)

    if all(value is None for row in per_depth for prop, value in row.items() if prop != "depth"):
        return None

    return _assemble(
        per_depth,
        fetched_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        aggregation=f"0-30 cm thickness-weighted mean over {area_note}",
        access="Earth Engine SoilGrids assets (projects/soilgrids-isric)",
    )


def _fetch_rest(latitude: float, longitude: float) -> dict[str, Any] | None:
    settings = get_settings()
    params: list[tuple[str, str]] = [
        ("lon", f"{longitude:.5f}"),
        ("lat", f"{latitude:.5f}"),
        ("value", "mean"),
    ]
    params += [("property", prop) for prop in PROPERTIES]
    params += [("depth", depth) for depth in DEPTHS]

    try:
        payload, fetched_at = cached_get_json(
            f"{settings.soilgrids_base_url}/properties/query",
            params,
            namespace="soilgrids",
            ttl_seconds=CACHE_TTL_SECONDS,
            timeout_seconds=settings.soilgrids_timeout_seconds,
            prefer_direct=True,
        )
    except (httpx.HTTPError, TypeError, ValueError) as exc:
        logger.warning("SoilGrids REST unavailable: %s", type(exc).__name__)
        return None

    layers = (payload.get("properties") or {}).get("layers") or []
    by_property = {layer.get("name"): layer for layer in layers}
    if not by_property:
        return None

    per_depth: list[dict[str, Any]] = []
    for depth in DEPTHS:
        row: dict[str, Any] = {"depth": depth}
        for prop in PROPERTIES:
            raw = _mean(by_property.get(prop, {}), depth)
            row[prop] = _scaled(raw, prop)
        per_depth.append(row)

    if all(value is None for row in per_depth for prop, value in row.items() if prop != "depth"):
        logger.info("SoilGrids REST returned an empty pixel for this point")
        return None

    return _assemble(
        per_depth,
        fetched_at=datetime.fromtimestamp(fetched_at, timezone.utc).isoformat(timespec="seconds"),
        aggregation="0-30 cm thickness-weighted mean of 0-5, 5-15 and 15-30 cm layers",
        access="ISRIC SoilGrids REST API",
    )


def fetch_soil(
    latitude: float,
    longitude: float,
    geometry: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Return converted soil properties, or ``None`` when every source fails."""
    try:
        result = _fetch_gee(latitude, longitude, geometry)
        if result is not None:
            return result
    except GEEUnavailable as exc:
        logger.info("SoilGrids via Earth Engine unavailable: %s", exc.details)
    except Exception as exc:  # provider errors must not leak or break the page
        logger.warning("SoilGrids via Earth Engine failed: %s", type(exc).__name__)

    return _fetch_rest(latitude, longitude)
