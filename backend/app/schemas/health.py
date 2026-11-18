"""Crop-health and vegetation schemas."""

from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import DataSourceRef
from app.schemas.satellite import MoistureCondition, VegetationCondition

HealthStatus = Literal["good", "moderate", "stressed", "insufficient_data"]
IndicatorStatus = Literal["good", "watch", "stress", "unknown"]
VegetationTrend = Literal["improving", "declining", "stable", "unknown"]


class IndicatorAgreementOut(BaseModel):
    """Share of available indicators that are not at stress level.

    This is a descriptive agreement statistic, not a probability of crop health
    and not a yield estimate.
    """

    percent: float | None
    known: int
    total: int
    stressed: int
    definition: str


class HealthIndicatorOut(BaseModel):
    id: str
    label: str
    value: float | int | str | None
    unit: str | None
    status: IndicatorStatus
    interpretation: str


class VegetationSummaryOut(BaseModel):
    available: bool
    ndvi: float | None
    trend: VegetationTrend
    latest_date: date | None
    note: str


class CropHealthAnalysis(BaseModel):
    status: HealthStatus
    season_complete: bool = False
    status_reason: str
    indicators: list[HealthIndicatorOut]
    indicator_agreement: IndicatorAgreementOut | None = None
    vegetation: VegetationSummaryOut
    summary: str
    missing_inputs: list[str]
    limitations: list[str]
    source: DataSourceRef
    is_demo: bool
    computed_for: date


class VegetationPoint(BaseModel):
    date: date
    ndvi: float


class VegetationLayerOut(BaseModel):
    """Display tile for the NDVI raster returned by Earth Engine."""

    url: str
    layer_name: str
    min: float
    max: float
    palette: list[str]
    attribution: str


class VegetationResponse(BaseModel):
    field_id: int
    available: bool
    reason: str | None
    provider: str | None
    series: list[VegetationPoint]
    latest: VegetationPoint | None
    trend: VegetationTrend
    ndmi: float | None = None
    ndvi_condition: VegetationCondition = "unknown"
    ndmi_condition: MoistureCondition = "unknown"
    acquisition_date: date | None = None
    cloud_cover_percent: float | None = None
    scene_count: int | None = None
    composite: bool = False
    geometry_source: str | None = None
    tile: VegetationLayerOut | None = None
    interpretation: str | None = None
    formula: str
    limitations: list[str]
    is_demo: bool
