"""
Vegetation index service backed by Google Earth Engine Sentinel-2.

NDVI/NDMI are reduced server-side over the field geometry by the same satellite
service that powers `/api/satellite/analyze-field`. No Earthdata/AppEEARS
provider is involved: Sentinel-2 surface reflectance comes from
`COPERNICUS/S2_SR_HARMONIZED` through the configured Earth Engine project.

Two honest caveats shape this response:

* the values are scene means over the geometry, not a crop-stage measurement;
* a trend needs at least two usable acquisitions. When only one exists, the
  trend stays "unknown" and the note says so instead of inventing a direction.

When Earth Engine is not configured (or the call fails), the endpoint reports
`available: false` with the safe reason — it never fabricates NDVI values.
"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.db.models import Field
from app.exceptions import GEEUnavailable, ValidationFailure
from app.schemas.health import (
    VegetationLayerOut,
    VegetationPoint,
    VegetationResponse,
)
from app.schemas.satellite import SatelliteRequest
from app.science.vegetation_indices import two_scene_trend
from app.services import satellite as satellite_service

NDVI_FORMULA = "NDVI = (B8 − B4) / (B8 + B4)"
WINDOW_DAYS = 60
MAX_CLOUD_PERCENT = 30
BUFFER_KM = 0.5
PROVIDER = "Google Earth Engine · Sentinel-2 SR"

LIMITATIONS = [
    "NDVI indicates vegetation condition; it does not identify a specific disease, pest or nutrient deficiency.",
    "Sentinel-2 indices are cloud-masked with the SCL band. When the latest scene is mostly cloud-covered, a median composite across the window is used and mixes dates.",
    "Values are pixel averages over the selected geometry at 10 m and may include non-crop pixels such as tracks, channels or bare soil.",
    "Satellite overpasses are not continuous; the acquisition date is the most recent usable pass inside the selected window, not a real-time measurement.",
]

DEMO_REASON = (
    "Demo mode does not call Google Earth Engine; switch to live data to read "
    "Sentinel-2 NDVI for this field."
)


def _build_request(field: Field) -> SatelliteRequest:
    boundary = satellite_service.parse_stored_boundary(field.boundary_geojson)
    end = date.today()
    common = {
        "start": end - timedelta(days=WINDOW_DAYS),
        "end": end,
        "max_cloud_percent": MAX_CLOUD_PERCENT,
        "include_tiles": True,
    }
    if boundary is not None:
        return SatelliteRequest(geometry=boundary, **common)
    return SatelliteRequest(
        latitude=field.latitude,
        longitude=field.longitude,
        buffer_km=BUFFER_KM,
        **common,
    )


def _unavailable(field: Field, reason: str, *, is_demo: bool) -> VegetationResponse:
    return VegetationResponse(
        field_id=field.id,
        available=False,
        reason=reason,
        provider=None,
        series=[],
        latest=None,
        trend="unknown",
        formula=NDVI_FORMULA,
        limitations=LIMITATIONS,
        is_demo=is_demo,
    )


def get_vegetation(session: Session, *, field: Field, mode: str = "live") -> VegetationResponse:
    """Return the latest Sentinel-2 NDVI/NDMI, or an honest unavailable result."""
    if mode == "demo":
        return _unavailable(field, DEMO_REASON, is_demo=True)

    try:
        bands, crop_name, stage_name = satellite_service.crop_stage_context(
            field.crop_id, field.planting_date, date.today()
        )
        snapshot = satellite_service.vegetation_snapshot(
            _build_request(field),
            field_id=field.id,
            bands=bands,
            crop_name=crop_name,
            stage_name=stage_name,
        )
    except (GEEUnavailable, ValidationFailure) as exc:
        return _unavailable(field, exc.message, is_demo=False)

    if not snapshot.available or snapshot.acquisition_date is None or snapshot.ndvi is None:
        return _unavailable(
            field,
            snapshot.reason or "No usable Sentinel-2 observation was found for this field.",
            is_demo=False,
        )

    series: list[VegetationPoint] = []
    if snapshot.previous is not None and not snapshot.composite:
        series.append(VegetationPoint(date=snapshot.previous[0], ndvi=round(snapshot.previous[1], 3)))
    if not snapshot.composite:
        series.append(
            VegetationPoint(date=snapshot.acquisition_date, ndvi=round(snapshot.ndvi, 3))
        )

    trend = (
        two_scene_trend(snapshot.previous[1], snapshot.ndvi)
        if snapshot.previous is not None and not snapshot.composite
        else "unknown"
    )

    tile = (
        VegetationLayerOut(**snapshot.tile.model_dump())
        if snapshot.tile is not None
        else None
    )

    return VegetationResponse(
        field_id=field.id,
        available=True,
        reason=snapshot.reason,
        provider=PROVIDER,
        series=series,
        latest=VegetationPoint(
            date=snapshot.acquisition_date, ndvi=round(snapshot.ndvi, 3)
        ),
        trend=trend,
        ndmi=snapshot.ndmi,
        ndvi_condition=snapshot.ndvi_condition,
        ndmi_condition=snapshot.ndmi_condition,
        acquisition_date=snapshot.acquisition_date,
        cloud_cover_percent=snapshot.cloud_cover_percent,
        scene_count=snapshot.scene_count,
        composite=snapshot.composite,
        geometry_source=snapshot.geometry_source,
        tile=tile,
        interpretation=snapshot.interpretation,
        formula=NDVI_FORMULA,
        limitations=LIMITATIONS,
        is_demo=False,
    )
