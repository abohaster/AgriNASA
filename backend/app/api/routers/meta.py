"""
Meta endpoints: service health, data-source catalogue and demo descriptor.

The catalogue is the machine-readable half of the platform's provenance story.
The frontend renders `DataSourceBadge` components from the same entries.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.data_catalog import SOURCE_CATALOGUE, source_ref
from app.db.database import get_session
from app.schemas.common import DataSourceRef
from app.schemas.meta import DataSourcesResponse, DemoInfo, HealthCheck
from app.services.demo import load_demo_snapshot

router = APIRouter(tags=["meta"])


@router.get("/health", response_model=HealthCheck)
def health(session: Session = Depends(get_session)) -> HealthCheck:
    settings = get_settings()
    database = "ok"
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        database = "unavailable"

    return HealthCheck(
        status="ok" if database == "ok" else "degraded",
        service=settings.app_name,
        version=settings.app_version,
        data_mode=settings.data_mode,
        ai_configured=settings.ai_configured,
        vegetation_configured=settings.vegetation_configured,
        satellite_configured=settings.gee_configured,
        database=database,
    )


@router.get("/data-sources", response_model=DataSourcesResponse)
def data_sources() -> DataSourcesResponse:
    settings = get_settings()
    return DataSourcesResponse(
        mode=settings.data_mode,
        power_endpoint=settings.nasa_power_base_url,
        sources=[DataSourceRef(**source_ref(entry["id"])) for entry in SOURCE_CATALOGUE],
        notes=[
            "NASA POWER requires no API key.",
            "Most POWER variables are MERRA-2 reanalysis on a coarse grid, not on-farm sensors.",
            "NASA GIBS map tiles are visual context only; no values are read from imagery.",
            "NDVI and NDMI come from Google Earth Engine Sentinel-2 and are reported as unavailable until Earth Engine is configured.",
            "Robot soil-moisture and camera readings are measured point observations; they do not represent the whole field.",
            "Irrigation and crop-health values are deterministic calculations, and AI image review is an advisory visual assessment.",
        ],
    )


@router.get("/demo", response_model=DemoInfo)
def demo() -> DemoInfo:
    settings = get_settings()
    series = load_demo_snapshot()
    if series is None or series.demo is None:
        return DemoInfo(
            enabled=False,
            data_mode=settings.data_mode,
            snapshot_date=None,
            snapshot_field=None,
            notice="The demo snapshot could not be loaded. Live data mode is still available.",
        )

    demo = series.demo
    return DemoInfo(
        enabled=True,
        data_mode=settings.data_mode,
        snapshot_date=series.end.isoformat(),
        snapshot_field={
            "name": f"Demo wheat — {demo.location_label}",
            "latitude": series.latitude,
            "longitude": series.longitude,
            "planting_date": demo.planting_date.isoformat(),
            "location_label": demo.location_label,
        },
        notice=demo.notice,
    )
