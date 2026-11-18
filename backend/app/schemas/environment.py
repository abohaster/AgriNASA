"""Environmental series schemas returned by /api/fields/{id}/environment."""

from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import DataSourceRef


class EnvironmentPoint(BaseModel):
    date: date
    t2m_mean_c: float | None = None
    t2m_max_c: float | None = None
    t2m_min_c: float | None = None
    rh_mean_pct: float | None = None
    precipitation_mm: float | None = None
    wind_speed_2m_ms: float | None = None
    solar_radiation_mj_m2_day: float | None = None
    pressure_kpa: float | None = None
    soil_moisture_root_fraction: float | None = None
    et0_mm_day: float | None = None


class TrendInfo(BaseModel):
    variable: str
    label: str
    unit: str
    change: float | None
    direction: Literal["up", "down", "flat", "unknown"]
    window_days: int


class EnvironmentSummary(BaseModel):
    days_returned: int
    coverage_fraction: float
    latest_date: date | None
    latest: dict[str, float | None]
    latest_dates: dict[str, str | None]
    precipitation_total_mm: float | None
    et0_total_mm: float | None
    et0_mean_mm_day: float | None
    trends: list[TrendInfo]
    missing_variables: list[str]


class EnvironmentResponse(BaseModel):
    field_id: int
    start: date
    end: date
    source: DataSourceRef
    is_demo: bool
    units: dict[str, str]
    series: list[EnvironmentPoint]
    summary: EnvironmentSummary
    missing_variables: list[str]
    limitations: list[str]
