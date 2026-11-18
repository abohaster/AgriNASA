"""
Read-only data access for RAYAN.

RAYAN never writes to the existing AgriNASA tables. This module opens a fresh
session, calls the same services the dashboard uses, builds the same
`build_field_context` object, and closes the session without committing. Any
cache rows those services flush are therefore discarded with the transaction.

Nothing here performs agronomy. FAO-56 and the stress indicators stay in
`app/services`; RAYAN only packages their outputs.
"""

from __future__ import annotations

import asyncio
import dataclasses
import json
from dataclasses import dataclass
from datetime import date
from typing import Any

from app.ai.context import build_field_context
from app.config import get_settings
from app.data_catalog import GLOBAL_LIMITATIONS, SOURCE_BY_ID, source_ref
from app.db import repository
from app.db.database import SessionLocal
from app.exceptions import NotFoundError
from app.rayyan.capabilities import build_registry
from app.rayyan.config import get_rayyan_settings
from app.services import crop_health, crop_intelligence, geocoding, history, open_meteo, soilgrids
from app.services import environment as environment_service
from app.services import forecast as forecast_service
from app.services import irrigation as irrigation_service
from app.services import vegetation as vegetation_service
from app.services.explore import polygon_area_ha

FORECAST_KEYWORDS = (
    "forecast",
    "rain",
    "rainfall",
    "tomorrow",
    "weather",
    "next days",
    "coming days",
    "wetter",
    "drier",
    "توقع",
    "توقعات",
    "مطر",
    "أمطار",
    "امطار",
    "طقس",
    "غدا",
    "غداً",
    "غدًا",
    "الأيام القادمة",
    "الايام القادمة",
    "القادمة",
)


@dataclass
class ContextBundle:
    context: dict[str, Any]
    capabilities: list[dict[str, Any]]
    sources: list[dict[str, Any]]
    is_demo: bool
    field_id: int
    field_name: str
    vegetation_available: bool | None


def wants_forecast(message: str) -> bool:
    lowered = message.casefold()
    return any(keyword in lowered for keyword in FORECAST_KEYWORDS)


def resolve_mode(requested: str | None) -> str:
    return requested or get_settings().data_mode


async def build_bundle(
    *,
    field_id: int,
    message: str,
    mode: str,
    history_turns: int = 0,
    include_forecast: bool | None = None,
) -> ContextBundle:
    with SessionLocal() as session:
        field = repository.get_field(session, field_id)
        if field is None:
            raise NotFoundError(
                "Field not found.",
                details="The field may have been deleted. Create or select another field.",
            )

        environment, _processed, series = environment_service.build_environment(
            session, field=field, mode=mode
        )
        irrigation = irrigation_service.analyze_irrigation(session, field=field, mode=mode)
        vegetation = vegetation_service.get_vegetation(session, field=field, mode=mode)
        health = crop_health.analyze_health(session, field=field, mode=mode)

        analysis_planting: date = (
            series.demo.planting_date
            if series.is_demo and series.demo is not None
            else field.planting_date
        )

        context = build_field_context(
            field=field,
            environment=environment,
            irrigation=irrigation,
            health=health,
            vegetation=vegetation,
            analysis_planting_date=analysis_planting,
            environment_latitude=series.latitude,
            environment_longitude=series.longitude,
        )

        capabilities = build_registry(
            data_mode=mode,
            vegetation_available=vegetation.available,
            vegetation_reason=vegetation.reason,
        )

        field_id_value = field.id
        field_name = field.name
        latitude = field.latitude
        longitude = field.longitude
        vegetation_available = vegetation.available
        field_crop_id = field.crop_id
        field_area_ha = field.area_ha
        field_location_label = field.location_label
        boundary = None
        if field.boundary_geojson:
            try:
                boundary = json.loads(field.boundary_geojson)
            except (TypeError, ValueError):
                boundary = None

    # Past this point the session is closed; no existing table was modified.
    forecast_payload: dict[str, Any]
    should_fetch = wants_forecast(message) if include_forecast is None else include_forecast
    if mode == "demo":
        forecast_payload = {
            "requested": should_fetch,
            "available": False,
            "reason": "Demo mode does not call the live Open-Meteo forecast service.",
            "days": [],
        }
    elif not should_fetch:
        forecast_payload = {
            "requested": False,
            "available": None,
            "reason": "Not requested for this question; no forecast call was made.",
            "days": [],
        }
    else:
        forecast_payload = await _fetch_forecast(latitude, longitude)

    context["forecast"] = forecast_payload
    location_context = await _build_location_context(
        latitude,
        longitude,
        crop_id=field_crop_id,
        label=field_location_label,
        area_ha=field_area_ha,
        boundary=boundary,
        mode=mode,
    )
    context.update(location_context["sections"])
    context["rayyan"] = {
        "assistant": "RAYAN",
        "conversation_persisted": False,
        "history_turns": history_turns,
        "data_mode": mode,
        "data_limitations": [*GLOBAL_LIMITATIONS, *location_context["limitations"]],
        "capability_status": {
            capability["id"]: capability["status"] for capability in capabilities
        },
        "limits": {
            "forecast_days": forecast_service.FORECAST_DAYS,
            "nasa_power_nominal_resolution_km": 50,
            "nasa_power_grid_degrees": [0.5, 0.625],
            "max_answer_words": get_rayyan_settings().max_answer_words,
        },
    }

    sources = [source_ref(source_id) for source_id in SOURCE_BY_ID]
    return ContextBundle(
        context=context,
        capabilities=capabilities,
        sources=sources,
        is_demo=environment.is_demo,
        field_id=field_id_value,
        field_name=field_name,
        vegetation_available=vegetation_available,
    )


async def _run(func: Any, *args: Any, **kwargs: Any) -> Any:
    """Run a blocking provider call off the event loop; never raise."""
    try:
        return await asyncio.to_thread(func, *args, **kwargs)
    except Exception as exc:  # noqa: BLE001 — providers report their own failures
        return exc


def _compact_current(raw: dict[str, Any] | None) -> dict[str, Any]:
    if not raw:
        return {
            "available": False,
            "reason": "Open-Meteo current conditions could not be reached; no values were invented.",
        }
    keys = (
        "time",
        "fetched_at",
        "weather",
        "temperature_c",
        "feels_like_c",
        "humidity_pct",
        "precipitation_mm",
        "wind_speed_ms",
        "wind_direction_deg",
        "pressure_hpa",
        "cloud_cover_pct",
        "soil_moisture_0_7cm_pct",
        "soil_temperature_6cm_c",
        "et0_today_mm",
        "rain_today_mm",
        "solar_today_mj_m2",
    )
    return {
        "available": True,
        "source_id": "open-meteo-current",
        **{key: raw.get(key) for key in keys},
        "note": "Model analysis/forecast step, not an on-farm weather station.",
    }


def _compact_soil(raw: dict[str, Any] | None) -> dict[str, Any]:
    if not raw:
        return {
            "available": False,
            "reason": "SoilGrids could not be reached; no soil values were invented.",
        }
    return {
        "available": True,
        "source_id": "soilgrids",
        "fetched_at": raw.get("fetched_at"),
        "access": raw.get("access"),
        "aggregation": raw.get("aggregation"),
        "topsoil": raw.get("topsoil"),
        "texture": raw.get("texture"),
        "note": "Modelled 250 m soil prediction, not a laboratory soil test.",
    }


def _compact_crop(assessment: dict[str, Any] | None) -> dict[str, Any] | None:
    if not assessment:
        return None
    if not assessment.get("available"):
        return {
            "available": False,
            "crop_id": assessment.get("crop_id"),
            "reason": assessment.get("reason"),
        }
    return {
        "available": True,
        "crop_id": assessment.get("crop_id"),
        "crop_name": assessment.get("crop_name"),
        "verdict": assessment.get("verdict"),
        "score": assessment.get("score"),
        "score_max": assessment.get("score_max"),
        "confidence": assessment.get("confidence"),
        "planting": assessment.get("planting"),
        "reference_temperature_c": assessment.get("reference_temperature_c"),
        "water_reference": assessment.get("water_reference"),
        "factors": assessment.get("factors"),
        "risks": assessment.get("risks"),
        "recommendations": assessment.get("recommendations"),
        "limitations": assessment.get("limitations"),
        "note": "A screening score from retrieved data, not a yield prediction.",
    }


async def _build_location_context(
    latitude: float,
    longitude: float,
    *,
    crop_id: str,
    label: str | None,
    area_ha: float | None,
    boundary: dict[str, Any] | None,
    mode: str,
) -> dict[str, Any]:
    """Location, current weather, soil, recent history and crop screening.

    These calls are independent, so they run concurrently. In demo mode the
    live environmental providers are skipped rather than mixed with the demo
    snapshot.
    """
    details_raw, current_raw, soil_raw, recent_raw = await asyncio.gather(
        _run(geocoding.reverse_details, latitude, longitude),
        _run(open_meteo.current_weather, latitude, longitude)
        if mode != "demo"
        else _run(lambda: None),
        _run(soilgrids.fetch_soil, latitude, longitude)
        if mode != "demo"
        else _run(lambda: None),
        _run(history.build_recent_context, latitude, longitude)
        if mode != "demo"
        else _run(lambda: None),
    )

    details = details_raw if isinstance(details_raw, dict) else {}
    current = current_raw if isinstance(current_raw, dict) else None
    soil = soil_raw if isinstance(soil_raw, dict) else None
    recent = recent_raw if isinstance(recent_raw, dict) else None

    location = {
        "label": label or details.get("label"),
        "country": details.get("country"),
        "country_code": details.get("country_code"),
        "region": details.get("region"),
        "county": details.get("county"),
        "nearest_place": details.get("nearest_place"),
        "latitude": round(latitude, 5),
        "longitude": round(longitude, 5),
        "area_ha": area_ha or (polygon_area_ha(boundary) if boundary else None),
        "geometry_source": "user-drawn field boundary" if boundary else "field point",
        "geocoding_attribution": details.get("attribution"),
    }

    limitations = [
        "SoilGrids is a modelled 250 m product, not a soil test.",
        "Soil moisture values from Open-Meteo and SMAP are model/satellite estimates, not depth probes.",
        "The crop suitability score is a screening of retrieved conditions, never a yield guarantee.",
        "Historical climate is reanalysis on a coarse grid and lags real time by several days.",
    ]

    if mode == "demo":
        unavailable = {
            "available": False,
            "reason": "Demo mode does not call live environmental providers; no live values are mixed in.",
        }
        sections = {
            "location": location,
            "current_weather": unavailable,
            "soil": unavailable,
            "history": unavailable,
            "crop_suitability": None,
        }
        return {"sections": sections, "limitations": limitations}

    crop_assessment = None
    if crop_id and soil and recent and recent.get("available"):
        crop_assessment = await _run(
            crop_intelligence.assess_crop,
            crop_id,
            latitude=latitude,
            longitude=longitude,
            soil=soil,
            history=recent,
            current=current,
        )
        if isinstance(crop_assessment, Exception):
            crop_assessment = None

    if recent and recent.get("available"):
        limitations.extend(recent.get("limitations", []))

    sections = {
        "location": location,
        "current_weather": _compact_current(current),
        "soil": _compact_soil(soil),
        "history": recent
        if recent and recent.get("available")
        else {
            "available": False,
            "reason": (recent or {}).get("reason")
            or "Recent history could not be reached; no values were invented.",
        },
        "crop_suitability": _compact_crop(crop_assessment)
        if crop_assessment
        else None,
    }
    return {"sections": sections, "limitations": limitations}


async def _fetch_forecast(latitude: float, longitude: float) -> dict[str, Any]:
    try:
        result = await asyncio.to_thread(forecast_service.fetch_forecast, latitude, longitude)
    except Exception:  # noqa: BLE001 — the provider reports its own failures
        return {
            "requested": True,
            "available": False,
            "reason": "The forecast service could not be reached. No forecast values were invented.",
            "days": [],
        }
    return {
        "requested": True,
        "available": result.available,
        "reason": result.reason,
        "provider": forecast_service.PROVIDER,
        "attribution": forecast_service.ATTRIBUTION,
        "days": [
            {key: (value.isoformat() if isinstance(value, date) else value) for key, value in dataclasses.asdict(day).items()}
            for day in result.days
        ],
    }


def context_as_json(context: dict[str, Any]) -> str:
    return json.dumps(context, ensure_ascii=False, default=str, sort_keys=True)


def build_capabilities(*, data_mode: str) -> list[dict[str, Any]]:
    """Registry without running an analysis (used by the capabilities endpoint)."""
    return build_registry(data_mode=data_mode)
