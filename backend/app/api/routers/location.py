"""Location intelligence endpoints used by Explore Map and Location Analysis.

Every endpoint accepts a point; the POST variants additionally accept the field
polygon. Values are only returned when a provider supplied them, and each block
carries its source, period and limitations for the UI to display.
"""

from datetime import date
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field, field_validator

from app.crops import list_calendars
from app.schemas.fields import _validated_boundary
from app.services import explore

router = APIRouter(prefix="/location", tags=["location"])


class PolygonRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    geometry: dict[str, Any] | None = None
    crop_id: str | None = Field(default=None, max_length=40)
    label: str | None = Field(default=None, max_length=255)

    @field_validator("geometry")
    @classmethod
    def _check_geometry(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return _validated_boundary(value)


class HistoryRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    end: date | None = None
    years: int | None = Field(default=None, ge=3, le=10)


class VegetationRequest(PolygonRequest):
    months: int = Field(default=6, ge=1, le=24)


class CropRequest(PolygonRequest):
    crop_id: str = Field(min_length=1, max_length=40)


@router.get("/crops")
def crops() -> dict[str, Any]:
    """Crops with a planting calendar and environmental requirements on file."""
    entries = [
        {
            "id": calendar.id,
            "name": calendar.name,
            "ideal_months": list(calendar.ideal_planting_months),
            "acceptable_months": list(calendar.acceptable_planting_months),
            "season_days": calendar.season_days,
            "establishment": calendar.establishment,
            "note": calendar.note,
        }
        for calendar in list_calendars()
    ]
    return {
        "crops": entries,
        "note": (
            "Calendars are regional Egyptian extension defaults. Suitability is a "
            "screening score from retrieved soil and climate data, not a yield forecast."
        ),
    }


@router.get("/overview")
def overview_point(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    crop_id: str | None = Query(default=None, max_length=40),
    label: str | None = Query(default=None, max_length=255),
) -> dict[str, Any]:
    return explore.build_overview(lat, lon, crop_id=crop_id, label=label)


@router.post("/overview")
def overview_area(body: PolygonRequest) -> dict[str, Any]:
    return explore.build_overview(
        body.latitude,
        body.longitude,
        geometry=body.geometry,
        crop_id=body.crop_id,
        label=body.label,
    )


@router.get("/soil")
def soil_point(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
) -> dict[str, Any]:
    return explore.build_soil(lat, lon)


@router.post("/soil")
def soil_area(body: PolygonRequest) -> dict[str, Any]:
    return explore.build_soil(
        body.latitude, body.longitude, geometry=body.geometry
    )


@router.get("/history")
def historical_point(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    end: date | None = Query(default=None),
    years: int | None = Query(default=None, ge=3, le=10),
) -> dict[str, Any]:
    return explore.build_history(lat, lon, end=end, years=years)


@router.post("/history")
def historical_area(body: HistoryRequest) -> dict[str, Any]:
    return explore.build_history(
        body.latitude, body.longitude, end=body.end, years=body.years
    )


@router.get("/vegetation")
def vegetation_point(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    months: int = Query(default=6, ge=1, le=24),
) -> dict[str, Any]:
    # A point is analysed over a small buffer so a single pixel is not mistaken
    # for a field average; the response states the buffer and area.
    return explore.build_vegetation(lat, lon, history_months=months)


@router.post("/vegetation")
def vegetation_area(body: VegetationRequest) -> dict[str, Any]:
    return explore.build_vegetation(
        body.latitude, body.longitude, geometry=body.geometry, history_months=body.months
    )


@router.get("/crop")
def crop_point(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    crop_id: str = Query(min_length=1, max_length=40),
) -> dict[str, Any]:
    return explore.build_crop(lat, lon, crop_id)


@router.post("/crop")
def crop_area(body: CropRequest) -> dict[str, Any]:
    return explore.build_crop(
        body.latitude, body.longitude, body.crop_id, geometry=body.geometry
    )
