"""Satellite analysis endpoints (Google Earth Engine, Sentinel-1/2).

Two entry points share one service:
* `POST /satellite/analyze-field` takes an explicit polygon or point + buffer.
* `POST /satellite/fields/{field_id}` reuses the saved field boundary, falling
  back to the field centre with a buffer when no boundary was drawn.
"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import repository
from app.db.database import get_session
from app.exceptions import NotFoundError
from app.schemas.satellite import (
    SatelliteAnalysisOut,
    SatelliteFieldRequest,
    SatelliteRequest,
)
from app.services import satellite as satellite_service

router = APIRouter(prefix="/satellite", tags=["satellite"])

# Public alias requested by external clients. Same handler and payload as
# /satellite/analyze-field; kept separate so the prefixed API stays stable.
alias_router = APIRouter(tags=["satellite"])


@router.post("/analyze-field", response_model=SatelliteAnalysisOut)
def analyze_field(payload: SatelliteRequest) -> SatelliteAnalysisOut:
    return satellite_service.analyze(payload)


@alias_router.post("/analyze-field", response_model=SatelliteAnalysisOut)
def analyze_field_alias(payload: SatelliteRequest) -> SatelliteAnalysisOut:
    return satellite_service.analyze(payload)


@router.post("/fields/{field_id}", response_model=SatelliteAnalysisOut)
def analyze_stored_field(
    field_id: int,
    options: SatelliteFieldRequest | None = None,
    session: Session = Depends(get_session),
) -> SatelliteAnalysisOut:
    field = repository.get_field(session, field_id)
    if field is None:
        raise NotFoundError(
            "Field not found.",
            details="The field may have been deleted. Create a new field to continue.",
        )

    opts = options or SatelliteFieldRequest()
    boundary = satellite_service.parse_stored_boundary(field.boundary_geojson)
    if boundary is not None:
        request = SatelliteRequest(
            geometry=boundary,
            start=opts.start,
            end=opts.end,
            max_cloud_percent=opts.max_cloud_percent,
            include_tiles=opts.include_tiles,
        )
    else:
        request = SatelliteRequest(
            latitude=field.latitude,
            longitude=field.longitude,
            buffer_km=opts.buffer_km,
            start=opts.start,
            end=opts.end,
            max_cloud_percent=opts.max_cloud_percent,
            include_tiles=opts.include_tiles,
        )
    bands, crop_name, stage_name = satellite_service.crop_stage_context(
        field.crop_id, field.planting_date, opts.end or date.today()
    )
    return satellite_service.analyze(
        request,
        field_id=field.id,
        bands=bands,
        crop_name=crop_name,
        stage_name=stage_name,
    )
