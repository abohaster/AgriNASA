"""Request/response schemas for the Sentinel-1/2 satellite analysis.

The API deliberately separates *numeric measurements* (indices, backscatter,
dates) from *qualitative classes* (wetness category). A category never claims
more precision than the underlying SAR/optical signal supports.
"""

from datetime import date, datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.config import get_settings
from app.schemas.common import DataSourceRef
from app.schemas.fields import _validated_boundary

GeometrySource = Literal["polygon", "point_buffer"]
WetnessCategory = Literal["dry", "near_normal", "wet", "unknown"]
VegetationCondition = Literal["sparse", "moderate", "dense", "unknown"]
MoistureCondition = Literal["low", "moderate", "high", "unknown"]

DEFAULT_WINDOW_DAYS = 30
DEFAULT_BUFFER_KM = 0.5


class SatelliteRequest(BaseModel):
    """Either a GeoJSON Polygon or a coordinate plus buffer.

    Dates default to the last 30 days. Only one spatial input is allowed so the
    analysed geometry is never ambiguous.
    """

    geometry: dict[str, Any] | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    buffer_km: float | None = Field(default=None, ge=0.1, le=25)
    start: date | None = None
    end: date | None = None
    max_cloud_percent: int = Field(default=30, ge=0, le=100)
    include_tiles: bool = True

    @model_validator(mode="after")
    def _normalise(self) -> "SatelliteRequest":
        has_polygon = self.geometry is not None
        has_point = self.latitude is not None or self.longitude is not None or self.buffer_km is not None

        if has_polygon and has_point:
            raise ValueError("Provide either a GeoJSON polygon or latitude/longitude, not both.")
        if not has_polygon and not has_point:
            raise ValueError("Provide a GeoJSON polygon or a latitude/longitude pair.")
        if has_polygon:
            self.geometry = _validated_boundary(self.geometry)
        else:
            if self.latitude is None or self.longitude is None:
                raise ValueError("Both latitude and longitude are required for a point buffer.")
            if self.buffer_km is None:
                self.buffer_km = DEFAULT_BUFFER_KM

        end = self.end or date.today()
        start = self.start or end - timedelta(days=DEFAULT_WINDOW_DAYS)
        if start > end:
            raise ValueError("Start date must be on or before the end date.")
        if end > date.today():
            raise ValueError("End date cannot be in the future.")
        if (end - start).days > get_settings().gee_max_date_range_days:
            raise ValueError(
                f"Date range must be {get_settings().gee_max_date_range_days} days or fewer."
            )
        self.start, self.end = start, end
        return self

    @property
    def geometry_source(self) -> GeometrySource:
        return "polygon" if self.geometry is not None else "point_buffer"


class SatelliteFieldRequest(BaseModel):
    """Options for analysing a stored field.

    The geometry comes from the saved four-corner boundary when one exists;
    otherwise the field centre plus `buffer_km` is used.
    """

    start: date | None = None
    end: date | None = None
    buffer_km: float = Field(default=DEFAULT_BUFFER_KM, ge=0.1, le=25)
    max_cloud_percent: int = Field(default=30, ge=0, le=100)
    include_tiles: bool = True


class SoilMoistureOut(BaseModel):
    available: bool
    category: WetnessCategory
    relative_score: float | None = None
    relative_percent: float | None = None
    vv_db: float | None = None
    vh_db: float | None = None
    vh_minus_vv_db: float | None = None
    acquisition_date: date | None = None
    scene_count: int = 0
    valid_pixels: int | None = None
    reason: str | None = None
    interpretation: str


class VegetationIndicesOut(BaseModel):
    available: bool
    ndvi: float | None = None
    ndmi: float | None = None
    ndwi: float | None = None
    ndvi_condition: VegetationCondition = "unknown"
    ndmi_condition: MoistureCondition = "unknown"
    acquisition_date: date | None = None
    scene_count: int = 0
    cloud_cover_percent: float | None = None
    valid_fraction: float | None = None
    composite: bool = False
    reason: str | None = None
    interpretation: str


class LayerTileOut(BaseModel):
    url: str
    layer_name: str
    # "palette" layers are stretched through a colour ramp; "rgb" layers are a
    # true-colour composite whose palette is empty and must not show a legend.
    kind: Literal["palette", "rgb"] = "palette"
    min: float
    max: float
    palette: list[str]
    attribution: str


class SatelliteTilesOut(BaseModel):
    ndvi: LayerTileOut | None = None
    ndmi: LayerTileOut | None = None
    soil_moisture: LayerTileOut | None = None
    true_color: LayerTileOut | None = None


class SatelliteAnalysisOut(BaseModel):
    field_id: int | None = None
    area_ha: float
    geometry_source: GeometrySource
    start: date
    end: date
    soil_moisture: SoilMoistureOut
    vegetation: VegetationIndicesOut
    tiles: SatelliteTilesOut
    sources: list[DataSourceRef]
    limitations: list[str]
    # Plausibility guardrail codes such as "ndvi:clamped". Empty means every
    # returned value passed its bounds check unchanged.
    corrections: list[str] = Field(default_factory=list)
    generated_at: datetime
