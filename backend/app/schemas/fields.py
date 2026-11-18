"""Field profile request/response schemas with rigorous input validation."""

import math
from datetime import date, datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

SoilTexture = Literal[
    "sand", "loamy_sand", "sandy_loam", "loam", "silt_loam", "clay_loam", "clay"
]
IrrigationSystem = Literal["drip", "sprinkler", "surface", "none"]


def _validated_boundary(value: dict[str, Any] | None) -> dict[str, Any] | None:
    """
    Accept only a closed GeoJSON Polygon drawn by the user.

    A field boundary is sensitive: an invented or malformed outline would be
    presented as real geography. We therefore reject anything that is not a
    single closed ring with at least four distinct corners and a non-zero area.
    Polygon holes are not supported in this version and are rejected rather than
    silently discarded.
    """
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("Boundary must be a GeoJSON Polygon object.")
    if value.get("type") != "Polygon":
        raise ValueError('Boundary must be a GeoJSON object with type "Polygon".')

    coordinates = value.get("coordinates")
    if not isinstance(coordinates, list) or not coordinates:
        raise ValueError("Boundary coordinates are missing.")
    if len(coordinates) > 1:
        raise ValueError("Boundary holes are not supported; provide a single outer ring.")

    ring = coordinates[0]
    if not isinstance(ring, list) or len(ring) < 5:
        raise ValueError("A field boundary needs at least four corners plus a closing point.")

    normalized: list[list[float]] = []
    for position in ring:
        if not isinstance(position, (list, tuple)) or len(position) < 2:
            raise ValueError("Each boundary position must be [longitude, latitude].")
        try:
            longitude = float(position[0])
            latitude = float(position[1])
        except (TypeError, ValueError):
            raise ValueError("Boundary coordinates must be numbers.") from None
        if not (math.isfinite(longitude) and math.isfinite(latitude)):
            raise ValueError("Boundary coordinates must be finite numbers.")
        if not -180.0 <= longitude <= 180.0 or not -90.0 <= latitude <= 90.0:
            raise ValueError("Boundary coordinates are outside valid longitude/latitude ranges.")
        normalized.append([longitude, latitude])

    if normalized[0] != normalized[-1]:
        raise ValueError("The boundary ring must be closed (first and last positions identical).")
    if any(first == second for first, second in zip(normalized, normalized[1:])):
        raise ValueError("The boundary contains duplicate consecutive positions.")

    # Shoelace area in square degrees; a zero value means the outline is a line.
    twice_area = sum(
        x1 * y2 - x2 * y1
        for (x1, y1), (x2, y2) in zip(normalized, normalized[1:])
    )
    if abs(twice_area) < 1e-12:
        raise ValueError("The boundary encloses no area.")

    return {"type": "Polygon", "coordinates": [normalized]}


class FieldCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    crop_id: str = Field(default="wheat", min_length=1, max_length=40)
    planting_date: date
    area_ha: float | None = Field(default=None, gt=0, le=100_000)
    soil_texture: SoilTexture | None = None
    irrigation_system: IrrigationSystem | None = None
    location_label: str | None = Field(default=None, max_length=255)
    elevation_m: float | None = Field(default=None, ge=-500, le=6000)
    # Optional outline drawn by the user. Stored as GeoJSON text in the database.
    boundary_geojson: dict[str, Any] | None = None

    @field_validator("boundary_geojson")
    @classmethod
    def _check_boundary(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return _validated_boundary(value)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Field name cannot be blank.")
        return stripped

    @field_validator("planting_date")
    @classmethod
    def _sane_planting_date(cls, value: date) -> date:
        if value < date(1981, 1, 1):
            raise ValueError("Planting date must be on or after 1981-01-01 (NASA POWER coverage).")
        if value > date.today() + timedelta(days=365):
            raise ValueError("Planting date cannot be more than one year in the future.")
        return value

    @field_validator("location_label")
    @classmethod
    def _strip_label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class FieldUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    planting_date: date | None = None
    area_ha: float | None = Field(default=None, gt=0, le=100_000)
    soil_texture: SoilTexture | None = None
    irrigation_system: IrrigationSystem | None = None
    location_label: str | None = Field(default=None, max_length=255)
    boundary_geojson: dict[str, Any] | None = None

    @field_validator("boundary_geojson")
    @classmethod
    def _check_boundary(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return _validated_boundary(value)

    @field_validator("planting_date")
    @classmethod
    def _sane_planting_date(cls, value: date | None) -> date | None:
        if value is None:
            return None
        if value < date(1981, 1, 1):
            raise ValueError("Planting date must be on or after 1981-01-01.")
        if value > date.today() + timedelta(days=365):
            raise ValueError("Planting date cannot be more than one year in the future.")
        return value


class FieldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    crop_id: str
    crop_name: str
    planting_date: date
    latitude: float
    longitude: float
    area_ha: float | None
    soil_texture: str | None
    irrigation_system: str | None
    location_label: str | None
    elevation_m: float | None
    boundary_geojson: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("boundary_geojson", mode="before")
    @classmethod
    def _parse_boundary(cls, value: object) -> object:
        # The ORM stores GeoJSON as text; expose it as an object to the client.
        if isinstance(value, str):
            import json

            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return None
        return value


class GeocodeResult(BaseModel):
    label: str
    latitude: float
    longitude: float
    kind: str | None = None


class ReverseGeocodeResult(BaseModel):
    label: str
    latitude: float
    longitude: float
