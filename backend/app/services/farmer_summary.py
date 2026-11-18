"""
Simplified farmer summary — one endpoint behind the "farmer guide" page.

WHAT IT COMBINES
----------------
* NASA POWER daily weather for the nearest grid cell (temperature, humidity,
  wind, rain, ET₀) — reanalysis, not an on-farm sensor.
* Sentinel-1 relative surface wetness and Sentinel-2 NDVI/NDMI through the
  existing Earth Engine analysis.
* An Open-Meteo daily forecast, because NASA POWER has no forecast product.

WHAT IT RETURNS
---------------
Structured codes and numbers, not scientific prose. The farmer page turns them
into one-sentence Arabic. Percentages are explicitly *descriptive* scores built
from the inputs above; they are not yield forecasts, probabilities or diagnoses.

HONESTY RULES
-------------
* No satellite reading → the health score is unavailable with a reason.
* No Open-Meteo forecast → the outlook is unavailable; observed weather is still
  shown, and the word "forecast" is never used for an observation.
* Demo mode → the whole summary is unavailable, because replaying a cached
  2025/26 POWER snapshot as today's farm advice would be misleading.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from app.crops.base import VegetationExpectation
from app.crops.calendar import CropCalendar, get_calendar, supported_crop_ids
from app.data_catalog import source_ref
from app.exceptions import GEEUnavailable, NASAUnavailable, ValidationFailure
from app.schemas.farmer import (
    FarmerCrop,
    FarmerForecast,
    FarmerForecastDay,
    FarmerOutlook,
    FarmerSoil,
    FarmerSummaryOut,
    FarmerTimeline,
    FarmerWeather,
    HealthRating,
    HealthReason,
    PlantHealth,
    PlantingAssessment,
    PlantingReason,
    SeasonVerdict,
    TimelineAction,
    TimelineRisk,
    TimelineStage,
)
from app.schemas.satellite import (
    SatelliteRequest,
    SatelliteTilesOut,
    SoilMoistureOut,
    VegetationIndicesOut,
    WetnessCategory,
)
from app.science import validation
from app.services import forecast as forecast_service
from app.services import nasa_power
from app.services import satellite as satellite_service
from app.services.processing import process_series

MONTH_SCORE_IDEAL = 100
MONTH_SCORE_ACCEPTABLE = 70
MONTH_SCORE_OUTSIDE = 20

SOIL_SCORES: dict[str, int] = {"near_normal": 100, "dry": 45, "wet": 30}

SATELLITE_WINDOW_DAYS = 60
SATELLITE_BUFFER_KM = 0.5
MAX_CLOUD_PERCENT = 30

# How long after the calendar emergence window the early-growth advice still
# applies before the crop is treated as established.
EMERGENCE_GRACE_DAYS = 7

# Descriptive health score anchors used when a crop stage supplies no bands.
# NDVI 0.03 is effectively bare ground and 0.88 is a dense, healthy canopy;
# NDMI −0.10 is dry canopy and 0.40 is well supplied. These are documented
# simplifications, not calibrated crop models.
NDVI_SCORE_MIN = 0.03
NDVI_SCORE_MAX = 0.88
NDMI_SCORE_MIN = -0.10
NDMI_SCORE_MAX = 0.40
NDVI_WEIGHT = 0.80

# With stage bands, the stage's sparse threshold maps to this share of the
# canopy score and the dense/high threshold maps to 100. A value one full band
# below the sparse threshold maps to 0. The mapping is a documented heuristic.
STAGE_SPARSE_ANCHOR = 40.0
STAGE_FLOOR_SPAN = 0.20

RAIN_ADVISORY_MM = 2.0
WIND_ADVISORY_MS = 6.0

LIMITATIONS = [
    "The readiness and health percentages are descriptive scores built from coarse weather reanalysis and satellite indices; they are not a yield forecast or a guarantee.",
    "NASA POWER values are MERRA-2 reanalysis on a roughly 50 km grid, not on-farm measurements.",
    "Sentinel-1 wetness is a relative surface signal (roughness and crop structure also change it), not volumetric soil moisture.",
    "The short forecast comes from Open-Meteo numerical weather models (CC BY 4.0), not from NASA POWER, and can change.",
    "Planting windows and temperature ranges are regional defaults for Egypt; local varieties and microclimate differ.",
    "Emergence days and sowing depths are regional extension defaults, not measurements of this field.",
    "No disease, pest or nutrient diagnosis is performed; confirm concerns with a local agronomist.",
    "Every returned value passes a plausibility check; a corrected or rejected value is listed in `corrections` and never shown as a raw broken number.",
]

DEMO_REASON = (
    "Demo mode replays a cached NASA POWER snapshot, so it cannot describe today's "
    "field. Switch to live data to use the farmer guide."
)


@dataclass
class _SatelliteReading:
    available: bool
    soil: SoilMoistureOut | None
    vegetation: VegetationIndicesOut | None
    reason_code: HealthReason
    reason: str | None
    tiles: SatelliteTilesOut = field(default_factory=SatelliteTilesOut)
    corrections: list[str] = field(default_factory=list)


# ── Scores ──────────────────────────────────────────────────────────────────


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _round(value: float | None, digits: int = 1) -> float | None:
    return round(value, digits) if value is not None else None


def _month_reason(crop: CropCalendar, month: int) -> tuple[int, PlantingReason]:
    if month in crop.ideal_planting_months:
        return MONTH_SCORE_IDEAL, "in_ideal_season"
    if month in crop.acceptable_planting_months:
        return MONTH_SCORE_ACCEPTABLE, "acceptable_season"
    return MONTH_SCORE_OUTSIDE, "outside_planting_season"


def month_score(crop: CropCalendar, month: int) -> int:
    return _month_reason(crop, month)[0]


def temperature_score(crop: CropCalendar, temperature_c: float) -> int:
    return _temperature_score_and_reason(crop, temperature_c)[0]


def _temperature_score_and_reason(
    crop: CropCalendar, temperature_c: float
) -> tuple[int, PlantingReason]:
    # 10 °C beyond the optimum removes the whole temperature component.
    if temperature_c > crop.optimal_temp_max_c:
        score = 100.0 - (temperature_c - crop.optimal_temp_max_c) * 10.0
        return int(round(_clamp(score))), "temperature_too_hot"
    if temperature_c < crop.optimal_temp_min_c:
        score = 100.0 - (crop.optimal_temp_min_c - temperature_c) * 10.0
        return int(round(_clamp(score))), "temperature_too_cold"
    return 100, "temperature_ideal"


def _soil_reason(category: str) -> PlantingReason:
    if category == "near_normal":
        return "soil_ready"
    if category == "dry":
        return "soil_dry"
    if category == "wet":
        return "soil_saturated"
    return "satellite_unavailable"


def _soil_score(category: str) -> int | None:
    return SOIL_SCORES.get(category)


def _stage_band_score(value: float, low: float, high: float) -> float:
    """Map an index to 0–100 relative to one stage's sparse/high thresholds."""
    floor = low - STAGE_FLOOR_SPAN
    if value <= floor:
        return 0.0
    if value < low:
        return (value - floor) / (low - floor) * STAGE_SPARSE_ANCHOR
    if value >= high:
        return 100.0
    return STAGE_SPARSE_ANCHOR + (value - low) / (high - low) * (100.0 - STAGE_SPARSE_ANCHOR)


def health_percent(
    ndvi: float, ndmi: float | None, bands: VegetationExpectation | None = None
) -> int:
    """Blend a canopy score from NDVI with a water score from NDMI.

    Without ``bands`` the global anchors are used. With a crop-stage band the
    same index is scored relative to that stage, so an early canopy is not
    penalised for being naturally small.
    """
    if bands is None:
        canopy = _clamp((ndvi - NDVI_SCORE_MIN) / (NDVI_SCORE_MAX - NDVI_SCORE_MIN) * 100.0)
        if ndmi is None:
            return int(round(canopy))
        water = _clamp((ndmi - NDMI_SCORE_MIN) / (NDMI_SCORE_MAX - NDMI_SCORE_MIN) * 100.0)
        return int(round(canopy * NDVI_WEIGHT + water * (1.0 - NDVI_WEIGHT)))

    canopy = _clamp(_stage_band_score(ndvi, bands.ndvi_sparse_max, bands.ndvi_dense_min))
    if ndmi is None:
        return int(round(canopy))
    water = _clamp(_stage_band_score(ndmi, bands.ndmi_low_max, bands.ndmi_high_min))
    return int(round(canopy * NDVI_WEIGHT + water * (1.0 - NDVI_WEIGHT)))


def health_rating(percent: int) -> HealthRating:
    if percent >= 80:
        return "excellent"
    if percent >= 65:
        return "good"
    if percent >= 50:
        return "fair"
    if percent >= 35:
        return "weak"
    return "poor"


def _planting_verdict(
    readiness: int, month_component: int, lowest_component: int
) -> SeasonVerdict:
    if month_component == MONTH_SCORE_OUTSIDE or lowest_component < 35:
        return "not_suitable"
    if lowest_component < 50:
        return "marginal"
    if readiness >= 75:
        return "suitable"
    if readiness >= 50:
        return "marginal"
    return "not_suitable"


# ── Data acquisition ────────────────────────────────────────────────────────


def _fetch_weather(latitude: float, longitude: float) -> FarmerWeather:
    end = date.today()
    start = end - timedelta(days=9)
    try:
        series = nasa_power.fetch_daily(
            latitude=latitude, longitude=longitude, start=start, end=end
        )
        processed = process_series(series)
    except NASAUnavailable as exc:
        return FarmerWeather(available=False, reason=exc.message)

    for point in reversed(processed.points):
        if point.get("t2m_mean_c") is None:
            continue
        return FarmerWeather(
            available=True,
            date=date.fromisoformat(point["date"]),
            temperature_mean_c=_round(point.get("t2m_mean_c")),
            temperature_max_c=_round(point.get("t2m_max_c")),
            temperature_min_c=_round(point.get("t2m_min_c")),
            humidity_pct=_round(point.get("rh_mean_pct"), 0),
            wind_ms=_round(point.get("wind_speed_2m_ms")),
            rain_mm=_round(point.get("precipitation_mm")),
            et0_mm_day=_round(point.get("et0_mm_day"), 2),
        )
    return FarmerWeather(
        available=False,
        reason="No recent NASA POWER day had a mean temperature for this location.",
    )


def _run_satellite(
    latitude: float,
    longitude: float,
    today: date,
    geometry: dict | None = None,
) -> _SatelliteReading:
    common = {
        "start": today - timedelta(days=SATELLITE_WINDOW_DAYS),
        "end": today,
        "max_cloud_percent": MAX_CLOUD_PERCENT,
        "include_tiles": True,
    }
    request = (
        SatelliteRequest(geometry=geometry, **common)
        if geometry is not None
        else SatelliteRequest(
            latitude=latitude,
            longitude=longitude,
            buffer_km=SATELLITE_BUFFER_KM,
            **common,
        )
    )
    try:
        analysis = satellite_service.analyze(request)
    except GEEUnavailable as exc:
        reason_code: HealthReason = (
            "satellite_not_configured"
            if exc.details == "GEE_NOT_CONFIGURED"
            else "satellite_unavailable"
        )
        return _SatelliteReading(
            available=False,
            soil=None,
            vegetation=None,
            reason_code=reason_code,
            reason=exc.message,
        )
    return _SatelliteReading(
        available=True,
        soil=analysis.soil_moisture,
        vegetation=analysis.vegetation,
        reason_code="ok",
        reason=None,
        tiles=analysis.tiles,
        corrections=analysis.corrections,
    )


# ── Blocks ──────────────────────────────────────────────────────────────────


def _crop_out(crop: CropCalendar) -> FarmerCrop:
    return FarmerCrop(
        id=crop.id,
        name=crop.name,
        season_days=crop.season_days,
        optimal_temp_min_c=crop.optimal_temp_min_c,
        optimal_temp_max_c=crop.optimal_temp_max_c,
        ideal_planting_months=list(crop.ideal_planting_months),
        acceptable_planting_months=list(crop.acceptable_planting_months),
    )


def _planting(
    crop: CropCalendar, weather: FarmerWeather, soil_category: str, today: date
) -> PlantingAssessment:
    month_component, month_reason = _month_reason(crop, today.month)
    temperature = weather.temperature_mean_c
    if not weather.available or temperature is None:
        return PlantingAssessment(
            verdict="unknown",
            readiness_percent=None,
            primary_reason="weather_unavailable",
            reasons=["weather_unavailable"],
            month=today.month,
            month_score=month_component,
        )

    temperature_component, temperature_reason = _temperature_score_and_reason(crop, temperature)
    soil_component = _soil_score(soil_category)
    soil_reason = _soil_reason(soil_category)

    if soil_component is None:
        weighted = [(month_component, 0.55), (temperature_component, 0.45)]
    else:
        weighted = [
            (month_component, 0.45),
            (temperature_component, 0.35),
            (soil_component, 0.20),
        ]
    weight_total = sum(weight for _, weight in weighted)
    readiness = int(round(sum(score * weight for score, weight in weighted) / weight_total))

    candidates: list[tuple[int, PlantingReason]] = [
        (month_component, month_reason),
        (temperature_component, temperature_reason),
    ]
    if soil_component is not None:
        candidates.append((soil_component, soil_reason))
    primary_reason = min(candidates, key=lambda item: item[0])[1]
    lowest_component = min(score for score, _ in candidates)

    reasons: list[PlantingReason] = [month_reason, temperature_reason, soil_reason]

    verdict = _planting_verdict(readiness, month_component, lowest_component)
    # One blocking factor (month or a component) must not leave a high gauge that
    # contradicts the traffic-light verdict, so the score is capped to match it.
    if verdict == "not_suitable":
        readiness = min(readiness, 45)
    elif verdict == "marginal":
        readiness = min(readiness, 74)

    return PlantingAssessment(
        verdict=verdict,
        readiness_percent=readiness,
        primary_reason=primary_reason,
        reasons=reasons,
        month=today.month,
        month_score=month_component,
        temperature_score=temperature_component,
        soil_score=soil_component,
        current_temperature_c=_round(temperature),
    )


def _soil_block(reading: _SatelliteReading, intent: str) -> FarmerSoil:
    soil = reading.soil
    if not reading.available or soil is None or not soil.available or soil.category == "unknown":
        reason = (
            (soil.reason if soil is not None else None)
            or reading.reason
            or "No Sentinel-1 wetness reading is available for this location."
        )
        return FarmerSoil(
            available=False,
            category="unknown",
            advice="check_soil_moisture",
            reason=reason,
        )

    category: WetnessCategory = soil.category
    if intent == "plant_now":
        advice = {
            "near_normal": "ready_to_plant",
            "dry": "irrigate_before_planting",
            "wet": "wait_for_soil_to_dry",
        }.get(category, "check_soil_moisture")
    else:
        advice = "irrigate_today" if category == "dry" else "no_irrigation_today"

    return FarmerSoil(
        available=True,
        category=category,
        relative_percent=soil.relative_percent,
        acquisition_date=soil.acquisition_date,
        advice=advice,
    )


def _health(
    reading: _SatelliteReading, bands: VegetationExpectation | None = None
) -> PlantHealth:
    if not reading.available:
        return PlantHealth(
            available=False,
            reason_code=reading.reason_code,
            reason=reading.reason,
        )

    vegetation = reading.vegetation
    if (
        vegetation is None
        or not vegetation.available
        or vegetation.ndvi is None
        or vegetation.acquisition_date is None
    ):
        return PlantHealth(
            available=False,
            reason_code="no_recent_image",
            reason=(
                vegetation.reason
                if vegetation is not None
                else "No usable Sentinel-2 observation was found for this location."
            ),
        )

    percent = health_percent(vegetation.ndvi, vegetation.ndmi, bands)
    return PlantHealth(
        available=True,
        percent=percent,
        rating=health_rating(percent),
        reason_code="ok",
        ndvi=vegetation.ndvi,
        ndmi=vegetation.ndmi,
        acquisition_date=vegetation.acquisition_date,
        scene_count=vegetation.scene_count,
        composite=vegetation.composite,
    )


def _timeline(
    crop: CropCalendar,
    intent: str,
    days_since_planting: int | None,
    forecast: forecast_service.ForecastResult,
    soil: FarmerSoil,
    health: PlantHealth | None,
    planting: PlantingAssessment | None,
    assessed_on: date,
) -> FarmerTimeline:
    """Turn the same verified inputs into stage-specific risks and actions.

    Two scenarios are covered explicitly: preparing to sow ("pre_planting")
    and the first weeks after sowing ("early_growth"). Anything older is
    "established", where only monitoring and weather protection remain.
    """
    category = soil.category if soil.available else "unknown"
    max_temp, min_temp, rain_total, max_wind = _forecast_extremes(forecast)

    if intent == "plant_now":
        stage: TimelineStage = "pre_planting"
    elif days_since_planting is None:
        stage = "established"
    else:
        early_limit = max(21, crop.emergence_days_max + EMERGENCE_GRACE_DAYS)
        stage = "early_growth" if days_since_planting <= early_limit else "established"

    planting_date: date | None = None
    emergence_from: date | None = None
    emergence_to: date | None = None
    if stage != "established" and days_since_planting is not None:
        planting_date = assessed_on - timedelta(days=days_since_planting)
        emergence_from = planting_date + timedelta(days=crop.emergence_days_min)
        emergence_to = planting_date + timedelta(days=crop.emergence_days_max)

    risks: list[TimelineRisk] = []
    actions: list[TimelineAction] = []

    def risk(code: TimelineRisk) -> None:
        if code not in risks:
            risks.append(code)

    def action(code: TimelineAction) -> None:
        if code not in actions:
            actions.append(code)

    heat = max_temp is not None and max_temp >= crop.heat_threshold_c
    frost = min_temp is not None and min_temp <= crop.frost_threshold_c
    rain = rain_total is not None and rain_total >= RAIN_ADVISORY_MM
    wind = max_wind is not None and max_wind >= WIND_ADVISORY_MS
    establishment = getattr(crop, "establishment", "seed")
    planting_suitable = planting is not None and planting.verdict in ("suitable", "marginal")
    weak_canopy = (
        health is not None
        and health.available
        and health.percent is not None
        and health.percent < 50
    )

    if stage == "pre_planting":
        action("prepare_seedbed")
        if category == "dry":
            risk("dry_seedbed")
            action("pre_irrigate")
        elif category == "wet":
            risk("wet_seedbed")
            action("wait_for_drain")
        if planting_suitable:
            action("sow_now")
        if establishment == "tuber":
            action("plant_tubers")
            action("sow_at_depth")
        elif establishment == "transplant":
            action("harden_transplants")
            if planting_suitable:
                action("transplant_seedlings")
        else:
            action("sow_at_depth")
        action("apply_basal_fertiliser")
        if rain:
            risk("rain_crusting")
        if heat:
            risk("heat_stress")
            action("irrigate_early_morning")
        if frost:
            risk("frost")
            action("protect_from_frost")
        if wind:
            risk("wind_damage")
    elif stage == "early_growth":
        action("monitor_seedbed")
        if category == "dry":
            risk("dry_seedbed")
            action("light_irrigation")
        elif category == "wet":
            risk("wet_seedbed")
            action("avoid_irrigation")
        if emergence_to is not None and assessed_on > emergence_to:
            risk("past_emergence_window")
        if establishment == "transplant":
            action("check_transplants")
        else:
            action("check_emergence")
        action("protect_young_roots")
        if establishment == "tuber":
            action("earth_up_ridges")
        if establishment == "transplant":
            action("stake_plants")
        action("scout_weeds")
        action("scout_pests")
        if weak_canopy:
            risk("canopy_stress")
        if rain:
            risk("rain_crusting")
        if heat:
            risk("heat_stress")
            action("irrigate_early_morning")
        if frost:
            risk("frost")
            action("protect_from_frost")
        if wind:
            risk("wind_damage")
    else:
        action("monitor_crop")
        action("scout_weeds")
        action("scout_pests")
        if weak_canopy:
            risk("canopy_stress")
        if heat:
            risk("heat_stress")
            action("irrigate_early_morning")
        if frost:
            risk("frost")
            action("protect_from_frost")

    return FarmerTimeline(
        stage=stage,
        days_since_planting=days_since_planting if stage != "pre_planting" else None,
        planting_date=planting_date,
        emergence_from=emergence_from,
        emergence_to=emergence_to,
        seed_depth_cm_min=(
            crop.seed_depth_cm_min if stage != "established" else None
        ),
        seed_depth_cm_max=(
            crop.seed_depth_cm_max if stage != "established" else None
        ),
        risks=risks,
        actions=actions,
    )


def _forecast_extremes(
    forecast: forecast_service.ForecastResult,
) -> tuple[float | None, float | None, float | None, float | None]:
    if not forecast.available or not forecast.days:
        return None, None, None, None
    highs = [day.temperature_max_c for day in forecast.days if day.temperature_max_c is not None]
    lows = [day.temperature_min_c for day in forecast.days if day.temperature_min_c is not None]
    rain = [day.rain_mm for day in forecast.days if day.rain_mm is not None]
    winds = [day.wind_max_ms for day in forecast.days if day.wind_max_ms is not None]
    return (
        max(highs) if highs else None,
        min(lows) if lows else None,
        sum(rain) if rain else None,
        max(winds) if winds else None,
    )


def _outlook(forecast: forecast_service.ForecastResult, crop: CropCalendar) -> FarmerOutlook:
    if not forecast.available or not forecast.days:
        return FarmerOutlook(available=False)

    max_temp, min_temp, rain_total, max_wind = _forecast_extremes(forecast)

    flags: list[str] = []
    advice: list[str] = []
    if max_temp is not None and max_temp >= crop.heat_threshold_c:
        flags.append("heat")
        advice.append("irrigate_early_morning")
    if min_temp is not None and min_temp <= crop.frost_threshold_c:
        flags.append("frost")
        advice.append("protect_from_frost")
    if rain_total is not None and rain_total >= RAIN_ADVISORY_MM:
        flags.append("rain")
        advice.append("hold_irrigation_rain")
    if max_wind is not None and max_wind >= WIND_ADVISORY_MS:
        flags.append("wind")
        advice.append("avoid_spraying_wind")

    headline = flags[0] if flags else "stable"
    if not advice:
        advice = ["good_growing_weather"]

    return FarmerOutlook(
        available=True,
        headline=headline,  # type: ignore[arg-type]
        max_temp_c=_round(max_temp),
        min_temp_c=_round(min_temp),
        rain_total_mm=_round(rain_total),
        max_wind_ms=_round(max_wind),
        advice=advice,  # type: ignore[arg-type]
    )


def _forecast_out(result: forecast_service.ForecastResult) -> FarmerForecast:
    return FarmerForecast(
        available=result.available,
        provider=forecast_service.PROVIDER if result.available else None,
        days=[
            FarmerForecastDay(
                date=day.date,
                temperature_max_c=_round(day.temperature_max_c),
                temperature_min_c=_round(day.temperature_min_c),
                rain_mm=_round(day.rain_mm),
                wind_max_ms=_round(day.wind_max_ms),
            )
            for day in result.days
        ],
        reason=result.reason,
    )


def _empty_weather(reason: str) -> FarmerWeather:
    return FarmerWeather(available=False, reason=reason)


def _empty_outlook() -> FarmerOutlook:
    return FarmerOutlook(available=False)


def _empty_soil(reason: str) -> FarmerSoil:
    return FarmerSoil(
        available=False,
        category="unknown",
        advice="check_soil_moisture",
        reason=reason,
    )


# ── Public entry point ──────────────────────────────────────────────────────


def build_farmer_summary(
    *,
    latitude: float,
    longitude: float,
    crop_id: str,
    intent: str,
    mode: str = "live",
    today: date | None = None,
    days_since_planting: int | None = None,
    geometry: dict | None = None,
) -> FarmerSummaryOut:
    crop = get_calendar(crop_id)
    if crop is None:
        raise ValidationFailure(
            f"'{crop_id}' is not in the farmer-guide crop list.",
            details=(
                "Supported crops: "
                + ", ".join(supported_crop_ids())
                + ". More crops can be added in backend/app/crops/calendar.py."
            ),
        )

    assessed_on = today or date.today()
    crop_out = _crop_out(crop)
    generated_at = datetime.now(timezone.utc)

    if mode == "demo":
        return FarmerSummaryOut(
            available=False,
            is_demo=True,
            reason_code="demo_mode_not_supported",
            reason=DEMO_REASON,
            crop=crop_out,
            intent=intent,  # type: ignore[arg-type]
            latitude=latitude,
            longitude=longitude,
            assessed_on=assessed_on,
            weather=_empty_weather(DEMO_REASON),
            forecast=FarmerForecast(available=False, reason=DEMO_REASON),
            soil=_empty_soil(DEMO_REASON),
            outlook=_empty_outlook(),
            timeline=None,
            limitations=LIMITATIONS,
            generated_at=generated_at,
        )

    weather, corrections = validation.validate_weather_values(
        _fetch_weather(latitude, longitude)
    )
    reading = _run_satellite(latitude, longitude, assessed_on, geometry)
    corrections.extend(reading.corrections)

    forecast_result = forecast_service.fetch_forecast(latitude, longitude)
    if forecast_result.available:
        days, forecast_corrections = validation.validate_forecast_days(
            forecast_result.days
        )
        corrections.extend(forecast_corrections)
        forecast_result = forecast_service.ForecastResult(available=True, days=days)

    soil = _soil_block(reading, intent)
    outlook = _outlook(forecast_result, crop)
    # NDVI/NDMI are scored relative to the crop's stage when the sowing date is
    # known; otherwise the global anchors are used.
    health_bands: VegetationExpectation | None = None
    if intent == "already_planted" and days_since_planting is not None:
        planting_day = assessed_on - timedelta(days=days_since_planting)
        health_bands, _, _ = satellite_service.crop_stage_context(
            crop.id, planting_day, assessed_on
        )
    health = _health(reading, health_bands) if intent == "already_planted" else None
    if health is not None and health.percent is not None:
        clamped = validation.clamp_percent(health.percent, "health_percent", corrections)
        if clamped != health.percent:
            health = health.model_copy(
                update={
                    "percent": clamped,
                    "rating": health_rating(clamped) if clamped is not None else "unknown",
                }
            )

    planting = (
        _planting(crop, weather, soil.category if soil.available else "unknown", assessed_on)
        if intent == "plant_now"
        else None
    )
    if planting is not None and planting.readiness_percent is not None:
        clamped = validation.clamp_percent(
            planting.readiness_percent, "readiness_percent", corrections
        )
        if clamped != planting.readiness_percent:
            planting = planting.model_copy(update={"readiness_percent": clamped})

    timeline = _timeline(
        crop,
        intent,
        days_since_planting,
        forecast_result,
        soil,
        health,
        planting,
        assessed_on,
    )

    return FarmerSummaryOut(
        available=True,
        is_demo=False,
        crop=crop_out,
        intent=intent,  # type: ignore[arg-type]
        latitude=latitude,
        longitude=longitude,
        assessed_on=assessed_on,
        planting=planting,
        health=health,
        weather=weather,
        forecast=_forecast_out(forecast_result),
        soil=soil,
        outlook=outlook,
        timeline=timeline,
        tiles=reading.tiles,
        corrections=list(dict.fromkeys(corrections)),
        sources=[
            source_ref("nasa-power-daily"),
            satellite_service.S1_SOURCE,
            satellite_service.S2_SOURCE,
            source_ref("open-meteo-forecast"),
        ],
        limitations=LIMITATIONS,
        generated_at=generated_at,
    )
