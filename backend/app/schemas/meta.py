"""Meta endpoints: health check, data-source catalogue, demo descriptor."""

from datetime import date
from typing import Any

from pydantic import BaseModel

from app.schemas.common import DataMode, DataSourceRef


class HealthCheck(BaseModel):
    status: str
    service: str
    version: str
    data_mode: DataMode
    ai_configured: bool
    vegetation_configured: bool
    satellite_configured: bool = False
    database: str


class DataSourcesResponse(BaseModel):
    mode: DataMode
    power_endpoint: str
    sources: list[DataSourceRef]
    notes: list[str]


class DemoInfo(BaseModel):
    enabled: bool
    data_mode: DataMode
    snapshot_date: str | None
    snapshot_field: dict[str, Any] | None
    notice: str
