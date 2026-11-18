"""Sentinel-1 / Sentinel-2 analysis through Google Earth Engine.

WHAT THIS SERVICE DOES
----------------------
1. Builds an `ee.Geometry` from a user-drawn polygon or a buffered point.
2. Reads the latest Sentinel-1 GRD scene in the window, applies a focal-median
   speckle filter and reduces VV/VH backscatter over the geometry.
3. Reads the latest Sentinel-2 SR scene, masks clouds with the SCL band and
   reduces NDVI, NDMI and NDWI. A median composite is used only when the latest
   scene has almost no valid pixels, and the response says so.
4. Asks Earth Engine for display tile URLs (`getMapId`) for the index rasters.

WHAT THIS SERVICE DOES NOT DO
-----------------------------
* It does not convert backscatter into volumetric soil moisture. VV is reported
  as a relative wetness proxy with documented heuristic thresholds.
* It does not diagnose disease. NDVI/NDMI describe canopy condition.
* It does not invent values when a scene is missing; the corresponding block is
  returned as unavailable with a reason.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.config import get_settings
from app.crops import get_crop
from app.crops.base import VegetationExpectation
from app.exceptions import GEEUnavailable, ValidationFailure
from app.schemas.common import DataSourceRef
from app.schemas.satellite import (
    LayerTileOut,
    SatelliteAnalysisOut,
    SatelliteRequest,
    SatelliteTilesOut,
    SoilMoistureOut,
    VegetationIndicesOut,
)
from app.science import validation
from app.science.crop_coefficient import days_after_planting, stage_for_day
from app.science.sar_moisture import (
    VV_SCORE_MAX_DB,
    VV_SCORE_MIN_DB,
    moisture_condition,
    relative_wetness_score,
    vegetation_condition,
    vegetation_interpretation,
    wetness_category,
    wetness_interpretation,
)
from app.services import earth_engine

logger = logging.getLogger(__name__)

S1_COLLECTION = "COPERNICUS/S1_GRD"
S2_COLLECTION = "COPERNICUS/S2_SR_HARMONIZED"

# Protect the Earth Engine quota: a "field" analysis is small. 5 000 ha is far
# larger than any Egyptian wheat field and still tractable at 10 m resolution.
MAX_ANALYSIS_AREA_HA = 5_000.0
MIN_ANALYSIS_AREA_HA = 0.01
SPECKLE_RADIUS_M = 30
MIN_VALID_FRACTION = 0.15
MAX_PIXELS = 100_000_000
REDUCE_SCALE_M = 10
RETRY_DELAY_S = 2.0
MAX_TRANSIENT_RETRIES = 3

# Right after an IAM grant is applied Google answers the first computation with a
# stale denied check ("Propagation of the new permission may take a few minutes").
# The same request usually succeeds seconds later, so only these signatures retry.
TRANSIENT_ERROR_MARKERS = (
    "serviceusage",
    "propagation of the new permission",
    "backend error",
    "internal error",
    "unavailable",
    "too many requests",
    "rate limit",
    "timed out",
    "timeout",
)

S1_SOURCE = DataSourceRef(
    id="sentinel1_sar",
    name="Sentinel-1 GRD (C-band SAR)",
    nature="satellite_observation",
    resolution="10 m · relative surface signal",
    attribution="Contains modified Copernicus Sentinel-1 data, processed in Google Earth Engine",
    url="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD",
)
S2_SOURCE = DataSourceRef(
    id="sentinel2_sr",
    name="Sentinel-2 SR Harmonized",
    nature="satellite_observation",
    resolution="10–20 m · ~5-day revisit",
    attribution="Contains modified Copernicus Sentinel-2 data, processed in Google Earth Engine",
    url="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED",
)

LIMITATIONS = [
    "Sentinel-1 backscatter is a relative surface signal. Roughness, crop structure and "
    "incidence angle also change it, so the wetness class is not volumetric soil moisture.",
    "Sentinel-2 indices are cloud-masked with the SCL band. When the latest scene is "
    "mostly cloud-covered, a median composite across the window is used and mixes dates.",
    "Values are pixel averages over the selected geometry at 10 m and may include "
    "non-crop pixels such as tracks, channels or bare soil.",
    "Satellite overpasses are not continuous; the acquisition date is the most recent "
    "usable pass inside the selected window, not a real-time measurement.",
    "Earth Engine tile URLs are temporary display layers. The numeric values come from "
    "server-side reductions, not from the rendered tiles.",
]

# High-contrast display ramps. Healthy canopies are vivid green, sparse or
# stressed vegetation yellow/orange, and bare or distressed soil red. These are
# display colours only; the reported values still come from server-side
# reductions and are never read from the rendered tiles.
NDVI_VIS: dict[str, Any] = {
    "min": 0.0,
    "max": 0.85,
    "palette": [
        "b71c1c",
        "e53935",
        "fb8c00",
        "fdd835",
        "9ccc65",
        "2e7d32",
        "1b5e20",
    ],
}
NDMI_VIS: dict[str, Any] = {
    "min": -0.2,
    "max": 0.6,
    "palette": ["8c510a", "d8a552", "f5efc4", "8fd6b4", "2ca25f", "006d2c"],
}
SOIL_MOISTURE_VIS: dict[str, Any] = {
    "min": 0.0,
    "max": 1.0,
    "palette": ["8d5524", "c8912f", "f4dd8a", "8fd6c4", "1b9e9e", "0b5d7a"],
}
TRUE_COLOR_VIS: dict[str, Any] = {
    "bands": ["B4", "B3", "B2"],
    # Surface reflectance is 0–10 000. A 0–3 000 stretch plus gamma 1.4 keeps
    # fields, roads and channels readable instead of dark or washed out.
    "min": 0,
    "max": 3000,
    "gamma": 1.4,
}


def _display_palette(vis: dict[str, Any]) -> list[str]:
    return ["#" + str(value) for value in vis["palette"]]


NDVI_LAYER = LayerTileOut(
    url="",
    layer_name="NDVI",
    min=float(NDVI_VIS["min"]),
    max=float(NDVI_VIS["max"]),
    palette=_display_palette(NDVI_VIS),
    attribution=S2_SOURCE.attribution,
)
NDMI_LAYER = LayerTileOut(
    url="",
    layer_name="NDMI",
    min=float(NDMI_VIS["min"]),
    max=float(NDMI_VIS["max"]),
    palette=_display_palette(NDMI_VIS),
    attribution=S2_SOURCE.attribution,
)
SOIL_LAYER = LayerTileOut(
    url="",
    layer_name="Relative surface wetness",
    min=float(SOIL_MOISTURE_VIS["min"]),
    max=float(SOIL_MOISTURE_VIS["max"]),
    palette=_display_palette(SOIL_MOISTURE_VIS),
    attribution=S1_SOURCE.attribution,
)
TRUE_COLOR_LAYER = LayerTileOut(
    url="",
    layer_name="True colour (Sentinel-2)",
    kind="rgb",
    min=float(TRUE_COLOR_VIS["min"]),
    max=float(TRUE_COLOR_VIS["max"]),
    palette=[],
    attribution=S2_SOURCE.attribution,
)


@dataclass
class _SoilResult:
    out: SoilMoistureOut
    wetness_image: Any | None


@dataclass
class _VegetationResult:
    out: VegetationIndicesOut
    ndvi_image: Any | None
    ndmi_image: Any | None
    true_color_image: Any | None = None


@dataclass
class VegetationSnapshot:
    """Latest Sentinel-2 observation, one earlier scene for a trend, and a tile.

    `previous` is `None` when the window holds a single usable scene or when the
    latest values come from a median composite (which mixes dates).
    """

    available: bool
    reason: str | None
    area_ha: float
    geometry_source: str
    start: date
    end: date
    ndvi: float | None
    ndmi: float | None
    ndvi_condition: str
    ndmi_condition: str
    acquisition_date: date | None
    previous: tuple[date, float] | None
    cloud_cover_percent: float | None
    scene_count: int
    composite: bool
    tile: LayerTileOut | None
    interpretation: str
    generated_at: datetime
    corrections: list[str] = field(default_factory=list)


class _TTLCache:
    """Small TTL cache with single-flight computation per key."""

    def __init__(self, ttl_seconds: int):
        self.ttl = ttl_seconds
        self._store: dict[str, tuple[float, Any]] = {}
        self._locks: dict[str, threading.Lock] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            created, value = entry
            if time.monotonic() - created > self.ttl:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._store[key] = (time.monotonic(), value)

    def compute(self, key: str, factory: Any) -> Any:
        """Compute once even when several requests miss the same key together."""
        cached = self.get(key)
        if cached is not None:
            return cached
        with self._lock:
            lock = self._locks.setdefault(key, threading.Lock())
        with lock:
            cached = self.get(key)
            if cached is not None:
                return cached
            value = factory()
            self.set(key, value)
            return value


_cache = _TTLCache(get_settings().gee_cache_ttl_seconds)


def parse_stored_boundary(raw: str | None) -> dict[str, Any] | None:
    """Parse the persisted GeoJSON text; anything malformed is ignored, not faked."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or data.get("type") != "Polygon":
        return None
    return data


def crop_stage_context(
    crop_id: str | None, planting_date: date | None, on: date
) -> tuple[VegetationExpectation | None, str | None, str | None]:
    """Resolve per-stage NDVI/NDMI bands for a stored field on a given date.

    Returns ``(bands, crop_name, stage_name)``. Before planting or after
    harvest — and for crops without stage bands — the tuple falls back to the
    honest global classes rather than inventing a stage.
    """
    if not crop_id or planting_date is None:
        return None, None, None
    crop = get_crop(crop_id)
    if crop is None:
        return None, None, None
    days = days_after_planting(planting_date, on)
    stage = stage_for_day(crop, days)
    bands = crop.expectation_for_stage(stage.code)
    if bands is None:
        return None, crop.name, None
    return bands, crop.name, stage.name


def _exclusive_end(end: date) -> str:
    return (end + timedelta(days=1)).isoformat()


def _mean_value(stats: dict[str, Any] | None, key: str) -> float | None:
    if not stats:
        return None
    value = stats.get(key)
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:  # NaN
        return None
    return number


def _count_value(stats: dict[str, Any] | None, key: str) -> int | None:
    if not stats:
        return None
    value = stats.get(key)
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _date_value(raw: Any) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(str(raw))
    except ValueError:
        return None


def _mask_s2_scene(ee: Any, image: Any) -> Any:
    """Keep only SCL classes 4 (vegetation), 5 (bare), 6 (water), 7 (unclassified)."""
    scl = image.select("SCL")
    valid = (
        scl.eq(4)
        .Or(scl.eq(5))
        .Or(scl.eq(6))
        .Or(scl.eq(7))
    )
    return image.updateMask(valid)


def _s2_indices(image: Any) -> Any:
    ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
    ndmi = image.normalizedDifference(["B8", "B11"]).rename("NDMI")
    ndwi = image.normalizedDifference(["B3", "B8"]).rename("NDWI")
    valid = ndvi.mask().rename("VALID")
    return ndvi.addBands(ndmi).addBands(ndwi).addBands(valid)


def _reduce_mean(ee: Any, image: Any, geometry: Any) -> dict[str, Any] | None:
    return image.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geometry,
        scale=REDUCE_SCALE_M,
        maxPixels=MAX_PIXELS,
        bestEffort=True,
    ).getInfo()


def _build_geometry(ee: Any, request: SatelliteRequest) -> Any:
    if request.geometry is not None:
        return ee.Geometry.Polygon(request.geometry["coordinates"])
    return ee.Geometry.Point([request.longitude, request.latitude]).buffer(
        float(request.buffer_km) * 1000.0
    )


def _geometry_area_ha(geometry: Any) -> float:
    area_m2 = geometry.area(maxError=1).getInfo()
    return round(float(area_m2) / 10_000.0, 2)


def _analyse_soil_moisture(ee: Any, geometry: Any, request: SatelliteRequest) -> _SoilResult:
    collection = (
        ee.ImageCollection(S1_COLLECTION)
        .filterBounds(geometry)
        .filterDate(request.start.isoformat(), _exclusive_end(request.end))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
    )
    scene_count = int(collection.size().getInfo() or 0)
    if scene_count == 0:
        return _SoilResult(
            out=SoilMoistureOut(
                available=False,
                category="unknown",
                scene_count=0,
                reason=(
                    "No Sentinel-1 IW scene with both VV and VH polarisation intersected "
                    "the area inside the selected window."
                ),
                interpretation=wetness_interpretation(None),
            ),
            wetness_image=None,
        )

    latest = collection.sort("system:time_start", False).first()
    smoothed = latest.select(["VV", "VH"]).focal_median(
        SPECKLE_RADIUS_M, "circle", "meters"
    )
    vv = smoothed.select("VV")
    vh = smoothed.select("VH")
    stack = vv.rename("VV").addBands(vh.rename("VH")).addBands(
        vh.subtract(vv).rename("VH_MINUS_VV")
    )

    stats = _reduce_mean(ee, stack, geometry)
    counts = stack.reduceRegion(
        reducer=ee.Reducer.count(),
        geometry=geometry,
        scale=REDUCE_SCALE_M,
        maxPixels=MAX_PIXELS,
        bestEffort=True,
    ).getInfo()

    vv_db = _mean_value(stats, "VV")
    vh_db = _mean_value(stats, "VH")
    ratio_db = _mean_value(stats, "VH_MINUS_VV")
    valid_pixels = _count_value(counts, "VV")
    acquisition = _date_value(
        ee.Date(latest.get("system:time_start")).format("YYYY-MM-dd").getInfo()
    )

    available = vv_db is not None and (valid_pixels or 0) > 0
    wetness_image = vv.unitScale(VV_SCORE_MIN_DB, VV_SCORE_MAX_DB).clamp(0, 1)
    score = relative_wetness_score(vv_db)

    out = SoilMoistureOut(
        available=available,
        category=wetness_category(vv_db),
        relative_score=score,
        relative_percent=round(score * 100.0, 1) if score is not None else None,
        vv_db=round(vv_db, 2) if vv_db is not None else None,
        vh_db=round(vh_db, 2) if vh_db is not None else None,
        vh_minus_vv_db=round(ratio_db, 2) if ratio_db is not None else None,
        acquisition_date=acquisition,
        scene_count=scene_count,
        valid_pixels=valid_pixels,
        reason=None if available else "No valid Sentinel-1 pixels remained inside the geometry.",
        interpretation=wetness_interpretation(vv_db if available else None),
    )
    return _SoilResult(out=out, wetness_image=wetness_image if available else None)


def _s2_collection(ee: Any, geometry: Any, request: SatelliteRequest) -> Any:
    return (
        ee.ImageCollection(S2_COLLECTION)
        .filterBounds(geometry)
        .filterDate(request.start.isoformat(), _exclusive_end(request.end))
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", request.max_cloud_percent))
    )


def _analyse_vegetation(
    ee: Any,
    geometry: Any,
    request: SatelliteRequest,
    bands: VegetationExpectation | None = None,
    crop_name: str | None = None,
    stage_name: str | None = None,
) -> _VegetationResult:
    collection = _s2_collection(ee, geometry, request)
    scene_count = int(collection.size().getInfo() or 0)
    if scene_count == 0:
        return _VegetationResult(
            out=VegetationIndicesOut(
                available=False,
                scene_count=0,
                reason=(
                    "No Sentinel-2 scene below the cloud threshold intersected the area "
                    "inside the selected window."
                ),
                interpretation=vegetation_interpretation(None, None, bands=bands),
            ),
            ndvi_image=None,
            ndmi_image=None,
            true_color_image=None,
        )

    latest = collection.sort("system:time_start", False).first()
    latest_masked = _mask_s2_scene(ee, latest)
    latest_stack = _s2_indices(latest_masked)
    latest_stats = _reduce_mean(ee, latest_stack, geometry)
    valid_fraction = _mean_value(latest_stats, "VALID")

    acquisition = _date_value(
        ee.Date(latest.get("system:time_start")).format("YYYY-MM-dd").getInfo()
    )
    cloud_raw = latest.get("CLOUDY_PIXEL_PERCENTAGE").getInfo()
    cloud_cover = float(cloud_raw) if cloud_raw is not None else None

    composite_used = valid_fraction is None or valid_fraction < MIN_VALID_FRACTION
    if composite_used:
        masked = collection.map(lambda image: _mask_s2_scene(ee, image))
        composite = masked.median()
        valid_composite = masked.select("B8").count().gt(0).rename("VALID")
        stack = (
            _s2_indices(composite)
            .select(["NDVI", "NDMI", "NDWI"])
            .addBands(valid_composite)
        )
        stats = _reduce_mean(ee, stack, geometry)
        ndvi_image = stack.select("NDVI")
        ndmi_image = stack.select("NDMI")
        true_color_image = composite.select(["B4", "B3", "B2"])
        valid_fraction = _mean_value(stats, "VALID")
        composite_note = (
            "The latest scene had too few cloud-free pixels over the field; "
            "indices come from a median composite of the window."
        )
    else:
        stats = latest_stats
        ndvi_image = latest_stack.select("NDVI")
        ndmi_image = latest_stack.select("NDMI")
        true_color_image = latest_masked.select(["B4", "B3", "B2"])
        composite_note = None

    ndvi = _mean_value(stats, "NDVI")
    ndmi = _mean_value(stats, "NDMI")
    ndwi = _mean_value(stats, "NDWI")
    available = ndvi is not None or ndmi is not None

    if not available:
        reason = "No valid Sentinel-2 pixels remained inside the geometry after cloud masking."
    else:
        reason = composite_note

    out = VegetationIndicesOut(
        available=available,
        ndvi=round(ndvi, 3) if ndvi is not None else None,
        ndmi=round(ndmi, 3) if ndmi is not None else None,
        ndwi=round(ndwi, 3) if ndwi is not None else None,
        ndvi_condition=vegetation_condition(ndvi, bands),
        ndmi_condition=moisture_condition(ndmi, bands),
        acquisition_date=acquisition,
        scene_count=scene_count,
        cloud_cover_percent=round(cloud_cover, 1) if cloud_cover is not None else None,
        valid_fraction=round(valid_fraction, 3) if valid_fraction is not None else None,
        composite=composite_used,
        reason=reason,
        interpretation=vegetation_interpretation(
            ndvi, ndmi, bands=bands, crop_name=crop_name, stage_name=stage_name
        ),
    )
    if not available:
        return _VegetationResult(
            out=out,
            ndvi_image=None,
            ndmi_image=None,
            true_color_image=true_color_image,
        )
    return _VegetationResult(
        out=out,
        ndvi_image=ndvi_image,
        ndmi_image=ndmi_image,
        true_color_image=true_color_image,
    )


def _with_url(layer: LayerTileOut, url: str) -> LayerTileOut:
    return layer.model_copy(update={"url": url})


def _tile_url(image: Any, vis: dict[str, Any], name: str) -> str:
    """getMapId goes through the same Google authorisation path, so retry
    transient denials with the same backoff as the computations."""
    attempt = 0
    while True:
        try:
            return earth_engine.tile_url(image, vis, name)
        except GEEUnavailable as exc:
            cause = exc.__cause__
            if attempt >= MAX_TRANSIENT_RETRIES or cause is None or not _is_transient(cause):
                raise
            attempt += 1
            logger.warning("Transient tile error for %s; retry %d.", name, attempt)
            _refresh_after_stale_denial(cause)
            time.sleep(RETRY_DELAY_S * attempt)


def _build_tiles(
    soil: _SoilResult, vegetation: _VegetationResult, include_tiles: bool
) -> SatelliteTilesOut:
    if not include_tiles:
        return SatelliteTilesOut()

    tiles = SatelliteTilesOut()
    if vegetation.ndvi_image is not None:
        tiles.ndvi = _with_url(
            NDVI_LAYER,
            _tile_url(vegetation.ndvi_image, NDVI_VIS, "NDVI"),
        )
    if vegetation.ndmi_image is not None:
        tiles.ndmi = _with_url(
            NDMI_LAYER,
            _tile_url(vegetation.ndmi_image, NDMI_VIS, "NDMI"),
        )
    if soil.wetness_image is not None:
        tiles.soil_moisture = _with_url(
            SOIL_LAYER,
            _tile_url(soil.wetness_image, SOIL_MOISTURE_VIS, "relative wetness"),
        )
    if vegetation.true_color_image is not None:
        tiles.true_color = _with_url(
            TRUE_COLOR_LAYER,
            _tile_url(vegetation.true_color_image, TRUE_COLOR_VIS, "true colour"),
        )
    return tiles


def _cache_key(request: SatelliteRequest) -> str:
    if request.geometry is not None:
        spatial = json.dumps(request.geometry, sort_keys=True, separators=(",", ":"))
    else:
        spatial = f"{request.latitude:.5f}:{request.longitude:.5f}:{request.buffer_km}"
    return "|".join(
        [
            spatial,
            request.start.isoformat(),
            request.end.isoformat(),
            str(request.max_cloud_percent),
            str(request.include_tiles),
        ]
    )


def _context_key(
    bands: VegetationExpectation | None,
    crop_name: str | None,
    stage_name: str | None,
) -> str:
    """Stage context changes condition classes, so it must split the cache."""
    if bands is None:
        return "global"
    return "|".join(
        [
            crop_name or "",
            stage_name or "",
            f"{bands.ndvi_sparse_max:.3f}",
            f"{bands.ndvi_dense_min:.3f}",
            f"{bands.ndmi_low_max:.3f}",
            f"{bands.ndmi_high_min:.3f}",
        ]
    )


def _is_transient(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in TRANSIENT_ERROR_MARKERS)


def _refresh_after_stale_denial(exc: Exception) -> None:
    """A stale ``serviceusage`` denial can outlive the session that cached it."""
    text = str(exc).lower()
    if "serviceusage" not in text and "propagation of the new permission" not in text:
        return
    try:
        earth_engine.refresh()
    except GEEUnavailable:
        logger.warning("Earth Engine credential refresh failed; keeping the retry.")


def _execute_with_retry(operation: Any) -> Any:
    """Run one Earth Engine computation, retrying only transient denials.

    A fresh OAuth token can answer 403 until IAM changes propagate, which has
    been observed to take longer than a couple of seconds, so back off.
    """
    attempt = 0
    while True:
        try:
            return operation()
        except (GEEUnavailable, ValidationFailure):
            raise
        except Exception as exc:  # provider errors may contain sensitive detail
            if attempt < MAX_TRANSIENT_RETRIES and _is_transient(exc):
                attempt += 1
                logger.warning(
                    "Earth Engine reported a transient error (%s); retry %d/%d.",
                    type(exc).__name__,
                    attempt,
                    MAX_TRANSIENT_RETRIES,
                )
                _refresh_after_stale_denial(exc)
                time.sleep(RETRY_DELAY_S * attempt)
                continue
            logger.warning("Earth Engine analysis failed: %s", type(exc).__name__)
            raise GEEUnavailable(
                "Earth Engine could not complete the satellite analysis. Try again later.",
                details="GEE_PROVIDER_ERROR",
            ) from exc


def _require_configured() -> None:
    if not earth_engine.is_configured():
        raise GEEUnavailable(
            "Satellite analysis is not configured on this server. "
            "Add Earth Engine service-account credentials to enable it.",
            details="GEE_NOT_CONFIGURED",
        )


def _check_area(area_ha: float) -> None:
    if not MIN_ANALYSIS_AREA_HA <= area_ha <= MAX_ANALYSIS_AREA_HA:
        raise ValidationFailure(
            f"The selected area is {area_ha:,.2f} ha; satellite analysis accepts "
            f"between {MIN_ANALYSIS_AREA_HA} and {MAX_ANALYSIS_AREA_HA:,.0f} ha."
        )


def _run(
    ee: Any,
    request: SatelliteRequest,
    bands: VegetationExpectation | None = None,
    crop_name: str | None = None,
    stage_name: str | None = None,
) -> tuple[float, _SoilResult, _VegetationResult, SatelliteTilesOut]:
    geometry = _build_geometry(ee, request)
    area_ha = _geometry_area_ha(geometry)
    _check_area(area_ha)

    soil = _analyse_soil_moisture(ee, geometry, request)
    vegetation = _analyse_vegetation(ee, geometry, request, bands, crop_name, stage_name)
    tiles = _build_tiles(soil, vegetation, request.include_tiles)
    return area_ha, soil, vegetation, tiles


def analyze(
    request: SatelliteRequest,
    *,
    field_id: int | None = None,
    bands: VegetationExpectation | None = None,
    crop_name: str | None = None,
    stage_name: str | None = None,
) -> SatelliteAnalysisOut:
    """Run the full satellite analysis, or raise a typed `GEEUnavailable`."""
    _require_configured()

    key = _cache_key(request) + "|ctx:" + _context_key(bands, crop_name, stage_name)
    cached = _cache.get(key)
    if cached is not None:
        logger.info("Satellite cache hit")
        return cached.model_copy(update={"field_id": field_id})

    ee = earth_engine.initialize()

    def _factory() -> SatelliteAnalysisOut:
        area_ha, soil, vegetation, tiles = _execute_with_retry(
            lambda: _run(ee, request, bands, crop_name, stage_name)
        )
        soil_out, soil_corrections = validation.validate_soil(soil.out)
        vegetation_out, vegetation_corrections = validation.validate_vegetation(
            vegetation.out, bands=bands, crop_name=crop_name, stage_name=stage_name
        )
        return SatelliteAnalysisOut(
            field_id=None,
            area_ha=area_ha,
            geometry_source=request.geometry_source,
            start=request.start,
            end=request.end,
            soil_moisture=soil_out,
            vegetation=vegetation_out,
            tiles=tiles,
            sources=[S1_SOURCE, S2_SOURCE],
            limitations=LIMITATIONS,
            corrections=soil_corrections + vegetation_corrections,
            generated_at=datetime.now(timezone.utc),
        )

    result = _cache.compute(key, _factory)
    return result.model_copy(update={"field_id": field_id})


def _previous_ndvi(
    ee: Any, geometry: Any, request: SatelliteRequest, latest_date: date
) -> tuple[date, float] | None:
    """Mean NDVI of the newest scene before `latest_date` (single reduction)."""
    before = _s2_collection(ee, geometry, request).filter(
        ee.Filter.lt("system:time_start", ee.Date(latest_date.isoformat()).millis())
    )
    if int(before.size().getInfo() or 0) == 0:
        return None
    previous = before.sort("system:time_start", False).first()
    stats = _reduce_mean(ee, _s2_indices(_mask_s2_scene(ee, previous)), geometry)
    value = _mean_value(stats, "NDVI")
    day = _date_value(
        ee.Date(previous.get("system:time_start")).format("YYYY-MM-dd").getInfo()
    )
    if value is None or day is None:
        return None
    return (day, round(value, 4))


def _run_vegetation(
    ee: Any,
    request: SatelliteRequest,
    bands: VegetationExpectation | None = None,
    crop_name: str | None = None,
    stage_name: str | None = None,
) -> tuple[float, VegetationIndicesOut, tuple[date, float] | None, LayerTileOut | None]:
    geometry = _build_geometry(ee, request)
    area_ha = _geometry_area_ha(geometry)
    _check_area(area_ha)

    result = _analyse_vegetation(ee, geometry, request, bands, crop_name, stage_name)
    out = result.out
    previous = None
    if out.available and not out.composite and out.acquisition_date is not None:
        previous = _previous_ndvi(ee, geometry, request, out.acquisition_date)
    tile = None
    if request.include_tiles and result.ndvi_image is not None:
        tile = _with_url(NDVI_LAYER, _tile_url(result.ndvi_image, NDVI_VIS, "NDVI"))
    return area_ha, out, previous, tile


def vegetation_snapshot(
    request: SatelliteRequest,
    *,
    field_id: int | None = None,
    bands: VegetationExpectation | None = None,
    crop_name: str | None = None,
    stage_name: str | None = None,
) -> VegetationSnapshot:
    """Sentinel-2 NDVI/NDMI for the NDVI card, or raise a typed `GEEUnavailable`."""
    _require_configured()

    key = (
        "vegetation|"
        + _cache_key(request)
        + "|ctx:"
        + _context_key(bands, crop_name, stage_name)
    )
    cached = _cache.get(key)
    if cached is not None:
        logger.info("Vegetation cache hit")
        return cached

    ee = earth_engine.initialize()

    def _factory() -> VegetationSnapshot:
        area_ha, out, previous, tile = _execute_with_retry(
            lambda: _run_vegetation(ee, request, bands, crop_name, stage_name)
        )
        out, corrections = validation.validate_vegetation(
            out, bands=bands, crop_name=crop_name, stage_name=stage_name
        )
        return VegetationSnapshot(
            available=out.available,
            reason=out.reason,
            area_ha=area_ha,
            geometry_source=request.geometry_source,
            start=request.start,
            end=request.end,
            ndvi=out.ndvi,
            ndmi=out.ndmi,
            ndvi_condition=out.ndvi_condition,
            ndmi_condition=out.ndmi_condition,
            acquisition_date=out.acquisition_date,
            previous=previous,
            cloud_cover_percent=out.cloud_cover_percent,
            scene_count=out.scene_count,
            composite=out.composite,
            tile=tile if out.available else None,
            interpretation=out.interpretation,
            generated_at=datetime.now(timezone.utc),
            corrections=corrections,
        )

    return _cache.compute(key, _factory)
