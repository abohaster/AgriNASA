"""Request/response schemas for the simplified farmer guide.

The endpoint returns codes plus numbers rather than long English paragraphs.
The farmer page composes its own one-sentence Arabic, so the same response can
be read in either language without translating backend prose at runtime.
Reasons that only exist as free text (missing satellite scene, unused demo mode)
are reported as a `reason` string as well.
"""

from datetime import date as Date
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import DataSourceRef
from app.schemas.fields import _validated_boundary
from app.schemas.satellite import SatelliteTilesOut, WetnessCategory

FarmerIntent = Literal["plant_now", "already_planted"]
SeasonVerdict = Literal["suitable", "marginal", "not_suitable", "unknown"]
HealthRating = Literal["excellent", "good", "fair", "weak", "poor", "unknown"]
OutlookKind = Literal["heat", "frost", "rain", "wind", "stable", "unknown"]
TimelineStage = Literal["pre_planting", "early_growth", "established"]

TimelineRisk = Literal[
    "dry_seedbed",
    "wet_seedbed",
    "rain_crusting",
    "heat_stress",
    "frost",
    "wind_damage",
    "canopy_stress",
    "past_emergence_window",
]

TimelineAction = Literal[
    "prepare_seedbed",
    "pre_irrigate",
    "wait_for_drain",
    "sow_now",
    "sow_at_depth",
    "plant_tubers",
    "harden_transplants",
    "transplant_seedlings",
    "apply_basal_fertiliser",
    "irrigate_early_morning",
    "hold_irrigation_rain",
    "monitor_seedbed",
    "light_irrigation",
    "avoid_irrigation",
    "check_emergence",
    "check_transplants",
    "earth_up_ridges",
    "stake_plants",
    "protect_young_roots",
    "scout_weeds",
    "scout_pests",
    "monitor_crop",
    "protect_from_frost",
]

PlantingReason = Literal[
    "weather_unavailable",
    "in_ideal_season",
    "acceptable_season",
    "outside_planting_season",
    "temperature_ideal",
    "temperature_too_hot",
    "temperature_too_cold",
    "soil_ready",
    "soil_dry",
    "soil_saturated",
    "satellite_unavailable",
]

HealthReason = Literal[
    "ok",
    "satellite_not_configured",
    "satellite_unavailable",
    "no_recent_image",
]

SoilAdvice = Literal[
    "irrigate_today",
    "no_irrigation_today",
    "check_soil_moisture",
    "irrigate_before_planting",
    "wait_for_soil_to_dry",
    "ready_to_plant",
]

WeatherAdvice = Literal[
    "irrigate_early_morning",
    "protect_from_frost",
    "hold_irrigation_rain",
    "avoid_spraying_wind",
    "good_growing_weather",
]


class FarmerSummaryRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    crop_id: str = Field(min_length=2, max_length=40)
    intent: FarmerIntent
    # Used by the "planted a few days ago" timeline. None means the crop is
    # established or the farmer does not know the exact date.
    days_since_planting: int | None = Field(default=None, ge=0, le=180)
    # Optional real polygon (the demo fields send one). The satellite analysis
    # then uses the field outline instead of a buffer around the pin.
    geometry: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _normalise(self) -> "FarmerSummaryRequest":
        if self.geometry is not None:
            self.geometry = _validated_boundary(self.geometry)
        if self.intent == "plant_now":
            self.days_since_planting = None
        return self


class FarmerCrop(BaseModel):
    id: str
    name: str
    season_days: int
    optimal_temp_min_c: float
    optimal_temp_max_c: float
    ideal_planting_months: list[int]
    acceptable_planting_months: list[int]


class FarmerWeather(BaseModel):
    available: bool
    # `Date` avoids the field name shadowing the type inside the class body.
    date: Date | None = None
    temperature_mean_c: float | None = None
    temperature_max_c: float | None = None
    temperature_min_c: float | None = None
    humidity_pct: float | None = None
    wind_ms: float | None = None
    rain_mm: float | None = None
    et0_mm_day: float | None = None
    reason: str | None = None


class FarmerForecastDay(BaseModel):
    date: Date
    temperature_max_c: float | None = None
    temperature_min_c: float | None = None
    rain_mm: float | None = None
    wind_max_ms: float | None = None


class FarmerForecast(BaseModel):
    available: bool
    provider: str | None = None
    days: list[FarmerForecastDay] = Field(default_factory=list)
    reason: str | None = None


class FarmerSoil(BaseModel):
    available: bool
    category: WetnessCategory = "unknown"
    relative_percent: float | None = None
    acquisition_date: Date | None = None
    advice: SoilAdvice
    reason: str | None = None


class PlantingAssessment(BaseModel):
    verdict: SeasonVerdict
    readiness_percent: int | None = None
    primary_reason: PlantingReason
    reasons: list[PlantingReason] = Field(default_factory=list)
    month: int
    month_score: int
    temperature_score: int | None = None
    soil_score: int | None = None
    current_temperature_c: float | None = None


class PlantHealth(BaseModel):
    available: bool
    percent: int | None = None
    rating: HealthRating = "unknown"
    reason_code: HealthReason
    reason: str | None = None
    ndvi: float | None = None
    ndmi: float | None = None
    acquisition_date: Date | None = None
    scene_count: int = 0
    composite: bool = False
    formula: str = "health% = 80% × canopy score (NDVI) + 20% × water score (NDMI)"


class FarmerOutlook(BaseModel):
    available: bool
    headline: OutlookKind = "unknown"
    max_temp_c: float | None = None
    min_temp_c: float | None = None
    rain_total_mm: float | None = None
    max_wind_ms: float | None = None
    advice: list[WeatherAdvice] = Field(default_factory=list)


class FarmerTimeline(BaseModel):
    """Stage-specific guidance for the two planting-timeline scenarios."""

    stage: TimelineStage
    days_since_planting: int | None = None
    planting_date: Date | None = None
    emergence_from: Date | None = None
    emergence_to: Date | None = None
    seed_depth_cm_min: float | None = None
    seed_depth_cm_max: float | None = None
    risks: list[TimelineRisk] = Field(default_factory=list)
    actions: list[TimelineAction] = Field(default_factory=list)


class FarmerSummaryOut(BaseModel):
    available: bool
    is_demo: bool = False
    reason_code: str | None = None
    reason: str | None = None
    crop: FarmerCrop
    intent: FarmerIntent
    latitude: float
    longitude: float
    assessed_on: Date
    planting: PlantingAssessment | None = None
    health: PlantHealth | None = None
    weather: FarmerWeather
    forecast: FarmerForecast
    soil: FarmerSoil
    outlook: FarmerOutlook
    timeline: FarmerTimeline | None = None
    tiles: SatelliteTilesOut = Field(default_factory=SatelliteTilesOut)
    # Plausibility guardrail codes; each entry means a value was clamped,
    # recomputed or rejected before the response was built.
    corrections: list[str] = Field(default_factory=list)
    sources: list[DataSourceRef] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    generated_at: datetime


class DemoFieldOut(BaseModel):
    """A real Egyptian farm location offered as a one-tap example."""

    id: str
    name: str
    name_ar: str
    description: str
    description_ar: str
    latitude: float
    longitude: float
    geometry: dict[str, Any]
    crop_id: str
    intent: FarmerIntent
    days_since_planting: int | None = None
