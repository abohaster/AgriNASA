"""Irrigation analysis schema — the scientific output of the platform."""

from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import DataSourceRef

DemandLevel = Literal["low", "moderate", "high", "unknown"]
ConfidenceLevel = Literal["high", "medium", "low"]
StageCode = Literal["pre_planting", "initial", "development", "mid", "late", "post_harvest"]


class GrowthStageOut(BaseModel):
    code: StageCode
    name: str
    days_after_planting: int | None
    progress: float | None
    kc: float | None


class ConfidenceOut(BaseModel):
    level: ConfidenceLevel
    reasons: list[str]


class BalanceDayOut(BaseModel):
    date: date
    depletion_mm: float
    taw_mm: float
    raw_mm: float
    etc_mm_day: float | None
    precipitation_mm: float
    stressed: bool


class WaterBalanceSummary(BaseModel):
    depletion_mm: float | None
    taw_mm: float | None
    raw_mm: float | None
    depletion_fraction: float | None
    stress_days: int
    initial_depletion_mm: float | None
    runoff_mm: float | None
    drainage_mm: float | None
    days_simulated: int
    excluded_et0_days: int = 0


class Driver(BaseModel):
    key: str
    label: str
    value: float | str | None
    unit: str | None
    interpretation: str


class IrrigationAnalysis(BaseModel):
    status: Literal["ok", "insufficient_data"]
    season_complete: bool = False
    demand: DemandLevel
    demand_reasons: list[str]
    confidence: ConfidenceOut
    computed_for: date
    stage: GrowthStageOut | None
    et0_mm_day: float | None
    kc: float | None
    etc_mm_day: float | None
    balance: WaterBalanceSummary
    balance_series: list[BalanceDayOut]
    net_requirement_mm: float | None
    gross_requirement_mm: float | None
    application_efficiency: float | None
    drivers: list[Driver]
    missing_inputs: list[str]
    limitations: list[str]
    source: DataSourceRef
    is_demo: bool
