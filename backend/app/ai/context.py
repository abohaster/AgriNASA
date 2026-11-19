"""
Structured field context for the AI assistant.

WHY THIS EXISTS
---------------
The language model is only allowed to *explain* numbers that deterministic code
already calculated. This module packages those numbers into one small, explicit
JSON object so the model never needs to look anything up, estimate, or do its own
arithmetic.

Every key below comes from an API schema produced by `app/services/*`. If a value
is missing, it is written as `null` (or listed in `missing_inputs`) so the model
can say "unavailable" instead of inventing a figure.

The same object is returned to the browser in `ChatResponse.context_used`, which
makes each answer auditable.
"""

from datetime import date
from typing import Any

from app.schemas.environment import EnvironmentResponse
from app.schemas.health import CropHealthAnalysis, VegetationResponse
from app.schemas.irrigation import IrrigationAnalysis
from app.services.processing import VARIABLE_LABELS, VARIABLE_UNITS

# Friendly labels used in the dashboard; repeated here so the context is
# self-describing to the model without importing UI code.
DEMAND_LABELS = {
    "low": "LOW",
    "moderate": "MODERATE",
    "high": "HIGH",
    "unknown": "UNKNOWN",
}


def _round(value: Any, digits: int = 2) -> Any:
    """Round numeric values for token economy; leave everything else untouched."""
    if isinstance(value, float):
        return round(value, digits)
    return value


def _latest_values(environment: EnvironmentResponse) -> list[dict[str, Any]]:
    """Turn the summary into a list that carries unit and date with each value."""
    rows: list[dict[str, Any]] = []
    latest = environment.summary.latest
    latest_dates = environment.summary.latest_dates
    for variable, label in VARIABLE_LABELS.items():
        rows.append(
            {
                "variable": variable,
                "label": label,
                "value": _round(latest.get(variable)),
                "unit": VARIABLE_UNITS.get(variable),
                "date": latest_dates.get(variable),
            }
        )
    return rows


def _recent_days(environment: EnvironmentResponse, days: int = 7) -> list[dict[str, Any]]:
    """Provide the last few daily rows so trend questions can be answered."""
    points = environment.series[-days:]
    rows: list[dict[str, Any]] = []
    for point in points:
        row = point.model_dump(mode="json")
        rows.append({key: _round(value) for key, value in row.items()})
    return rows


def _recent_precipitation(environment: EnvironmentResponse, days: int = 7) -> float | None:
    """Sum only real values in the recent window; null when none are present."""
    values = [
        point.precipitation_mm
        for point in environment.series[-days:]
        if point.precipitation_mm is not None
    ]
    return round(sum(values), 2) if values else None


def _irrigation_context(analysis: IrrigationAnalysis) -> dict[str, Any]:
    return {
        "status": analysis.status,
        "demand": analysis.demand,
        "demand_label": DEMAND_LABELS.get(analysis.demand, analysis.demand.upper()),
        "demand_reasons": analysis.demand_reasons,
        "confidence": {
            "level": analysis.confidence.level,
            "reasons": analysis.confidence.reasons,
        },
        "growth_stage": analysis.stage.model_dump() if analysis.stage else None,
        "et0_mm_per_day": _round(analysis.et0_mm_day, 3),
        "crop_coefficient_kc": _round(analysis.kc, 3),
        "etc_mm_per_day": _round(analysis.etc_mm_day, 3),
        "root_zone": analysis.balance.model_dump(),
        "robot_soil_moisture": analysis.robot_soil_moisture.model_dump(mode="json"),
        "moisture_assessment": analysis.moisture_assessment,
        "irrigation_needed": analysis.irrigation_needed,
        "water_requirement": analysis.water_requirement.model_dump(mode="json"),
        "net_refill_requirement_mm": _round(analysis.net_requirement_mm),
        "gross_refill_requirement_mm": _round(analysis.gross_requirement_mm),
        "application_efficiency": analysis.application_efficiency,
        "drivers": [driver.model_dump() for driver in analysis.drivers],
        "missing_inputs": analysis.missing_inputs,
        "limitations": analysis.limitations,
        "baseline_note": (
            "The water balance assumes no recorded irrigation events (I = 0). "
            "Net/gross refill requirements are estimates for refilling the root zone, "
            "not applied water volumes or a schedule."
        ),
    }


def _health_context(analysis: CropHealthAnalysis) -> dict[str, Any]:
    return {
        "status": analysis.status,
        "status_reason": analysis.status_reason,
        "indicators": [indicator.model_dump() for indicator in analysis.indicators],
        "summary": analysis.summary,
        "missing_inputs": analysis.missing_inputs,
        "limitations": analysis.limitations,
    }


def _vegetation_context(vegetation: VegetationResponse) -> dict[str, Any]:
    return {
        "available": vegetation.available,
        "reason": vegetation.reason,
        "latest_ndvi": vegetation.latest.ndvi if vegetation.latest else None,
        "latest_date": vegetation.latest.date.isoformat() if vegetation.latest else None,
        "trend": vegetation.trend,
        "formula": vegetation.formula,
        "note": "NDVI describes vegetation condition only; it does not identify a disease.",
    }


def _unique(items: list[str], limit: int = 10) -> list[str]:
    """Keep the context small while preserving deterministic order."""
    return list(dict.fromkeys(item for item in items if item))[:limit]


def build_field_context(
    *,
    field: Any,
    environment: EnvironmentResponse,
    irrigation: IrrigationAnalysis,
    health: CropHealthAnalysis,
    vegetation: VegetationResponse,
    analysis_planting_date: date,
    environment_latitude: float | None = None,
    environment_longitude: float | None = None,
    plant_images: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Assemble the full, auditable context sent to the model."""
    irrigation_context = _irrigation_context(irrigation)
    health_context = _health_context(health)

    limitations = _unique(
        environment.limitations + irrigation_context["limitations"] + health_context["limitations"]
    )

    context: dict[str, Any] = {
        "generated_at": date.today().isoformat(),
        "data_mode": "demo" if environment.is_demo else "live",
        "provenance": {
            "environment_source": environment.source.name,
            "environment_nature": environment.source.nature,
            "environment_resolution": environment.source.resolution,
            "calculation_source": irrigation.source.name,
            "statement": (
                "Environment values are NASA POWER reanalysis, not on-farm sensors. "
                "ET₀, ETc, water balance, demand class and health indicators are "
                "deterministic calculations performed by the backend."
            ),
        },
        "field": {
            "id": field.id,
            "name": field.name,
            "crop": field.crop_name,
            "crop_id": field.crop_id,
            "planting_date": field.planting_date.isoformat(),
            "analysis_planting_date": analysis_planting_date.isoformat(),
            "latitude": field.latitude,
            "longitude": field.longitude,
            "location_label": field.location_label,
            "area_ha": field.area_ha,
            "soil_texture": field.soil_texture,
            "irrigation_system": field.irrigation_system,
            "analysis_date": environment.end.isoformat(),
            "days_after_planting": (
                irrigation.stage.days_after_planting if irrigation.stage else None
            ),
        },
        "environment": {
            "window": {
                "start": environment.start.isoformat(),
                "end": environment.end.isoformat(),
                "days": environment.summary.days_returned,
            },
            "grid_coordinates": (
                {
                    "latitude": environment_latitude,
                    "longitude": environment_longitude,
                    "note": "Coordinates of the NASA POWER grid request. In demo mode this is Qena, not the user's field.",
                }
                if environment_latitude is not None and environment_longitude is not None
                else None
            ),
            "coverage_fraction": _round(environment.summary.coverage_fraction),
            "units": environment.units,
            "latest_values": _latest_values(environment),
            "recent_7_days": _recent_days(environment, 7),
            "recent_7_day_precipitation_mm": _recent_precipitation(environment, 7),
            "window_precipitation_mm": _round(environment.summary.precipitation_total_mm),
            "window_et0_mm": _round(environment.summary.et0_total_mm),
            "mean_et0_mm_per_day": _round(environment.summary.et0_mean_mm_day, 3),
            "trends_last_7_days": [
                trend.model_dump() for trend in environment.summary.trends
            ],
            "missing_variables": environment.missing_variables,
        },
        "irrigation": irrigation_context,
        "crop_health": health_context,
        "vegetation": _vegetation_context(vegetation),
        "plant_images": plant_images
        or {
            "available": False,
            "reason": "No plant-image review was supplied for this question.",
        },
        "limitations": limitations,
    }
    return context
