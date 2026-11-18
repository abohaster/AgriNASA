"""
Capability registry — what RAYAN can honestly claim, derived from the running
service rather than from project documentation.

Statuses:
  AVAILABLE             the backend can execute it now
  PARTIALLY_AVAILABLE   some inputs are missing or the data is demo-only
  CONFIGURATION_REQUIRED credentials are absent (no value is invented)
  DATA_UNAVAILABLE      configured, but this field/date has no usable result
  DEMO_ONLY             only the cached demo snapshot is available
  NOT_IMPLEMENTED       AgriNASA has no such feature

The registry is recomputed per request. It never promotes a documented feature
to AVAILABLE when the code cannot execute it.
"""

from __future__ import annotations

from typing import TypedDict

from app.services import earth_engine


class Capability(TypedDict):
    id: str
    label: str
    status: str
    detail: str
    source_id: str | None


def _cap(
    identifier: str,
    label: str,
    status: str,
    detail: str,
    source_id: str | None = None,
) -> Capability:
    return {
        "id": identifier,
        "label": label,
        "status": status,
        "detail": detail,
        "source_id": source_id,
    }


NEVER_IMPLEMENTED: list[Capability] = [
    _cap(
        "disease_diagnosis",
        "Disease diagnosis",
        "NOT_IMPLEMENTED",
        "AgriNASA reports environmental stress indicators only. No disease model, "
        "image classifier or laboratory input exists, so no diagnosis can be given.",
    ),
    _cap(
        "pest_identification",
        "Pest identification",
        "NOT_IMPLEMENTED",
        "There is no pest dataset, trap data or image model in the project.",
    ),
    _cap(
        "nutrient_deficiency",
        "Nutrient-deficiency diagnosis",
        "NOT_IMPLEMENTED",
        "Soil tests and tissue analysis are not part of AgriNASA; soil texture is a "
        "user-entered profile field, not a measurement.",
    ),
    _cap(
        "yield_prediction",
        "Yield prediction",
        "NOT_IMPLEMENTED",
        "AgriNASA contains no yield model, historical yield records or trained "
        "machine-learning estimator.",
    ),
    _cap(
        "machine_learning",
        "Machine-learning inference",
        "NOT_IMPLEMENTED",
        "Every number in the platform comes from deterministic FAO-56 calculations, "
        "reanalysis data or Earth Engine reductions. No ML model is deployed.",
    ),
    _cap(
        "continuous_monitoring",
        "Continuous farm monitoring",
        "NOT_IMPLEMENTED",
        "AgriNASA is request-driven. It does not poll, stream or watch a field, and "
        "it sends no alerts. Each analysis runs when a page or API call asks for it.",
    ),
    _cap(
        "on_farm_sensors",
        "On-farm sensor data",
        "NOT_IMPLEMENTED",
        "No soil-moisture probes, weather stations or IoT feeds are connected. NASA "
        "POWER values are reanalysis, not sensor readings.",
    ),
    _cap(
        "soil_lab_tests",
        "Soil laboratory tests",
        "NOT_IMPLEMENTED",
        "Only a soil-texture category supplied by the user is stored; no laboratory "
        "results exist.",
    ),
    _cap(
        "irrigation_schedule",
        "Irrigation scheduling",
        "NOT_IMPLEMENTED",
        "AgriNASA estimates a root-zone refill requirement. It has no irrigation-event "
        "records, calendar or scheduling engine.",
    ),
    _cap(
        "pesticide_prescription",
        "Pesticide or fertiliser prescription",
        "NOT_IMPLEMENTED",
        "No product, dosage or regulatory recommendation capability exists.",
    ),
    _cap(
        "satellite_visual_interpretation",
        "Photograph / satellite image interpretation",
        "NOT_IMPLEMENTED",
        "No vision model is used. NASA GIBS tiles are displayed as visual context only; "
        "no values are read from pixels by an AI.",
    ),
    _cap(
        "historical_ndvi_trends",
        "Long-term NDVI trend analysis",
        "NOT_IMPLEMENTED",
        "The vegetation endpoint returns the latest usable Sentinel-2 pass (plus the "
        "previous pass when available), not a multi-season time series.",
    ),
    _cap(
        "forecast_beyond_five_days",
        "Forecast beyond 5 days",
        "NOT_IMPLEMENTED",
        "The Open-Meteo integration requests a 5-day daily outlook. No longer-range "
        "seasonal forecast is available.",
    ),
    _cap(
        "field_comparison",
        "Cross-field comparison",
        "NOT_IMPLEMENTED",
        "The API analyses one field at a time; no ranking or multi-field comparison "
        "endpoint exists.",
    ),
]


def build_registry(
    *,
    data_mode: str,
    vegetation_available: bool | None = None,
    vegetation_reason: str | None = None,
) -> list[Capability]:
    demo = data_mode == "demo"
    gee_ready = earth_engine.is_configured()

    weather_status = "DEMO_ONLY" if demo else "AVAILABLE"
    weather_detail = (
        "Demo mode replays a cached NASA POWER snapshot for Qena, Egypt. It is not "
        "live data and not necessarily this field."
        if demo
        else "Live NASA POWER daily point data, fetched by the backend on request."
    )

    if demo:
        ndvi_status = "DEMO_ONLY"
        ndvi_detail = (
            "Demo mode never calls Google Earth Engine, so NDVI/NDMI is explicitly "
            "unavailable in the demo snapshot."
        )
    elif not gee_ready:
        ndvi_status = "CONFIGURATION_REQUIRED"
        ndvi_detail = (
            "Sentinel-2 NDVI/NDMI requires Earth Engine service-account credentials on "
            "the server. None are configured, so this stays unavailable."
        )
    elif vegetation_available is True:
        ndvi_status = "AVAILABLE"
        ndvi_detail = "Latest usable Sentinel-2 pass reduced over the field geometry."
    elif vegetation_available is False:
        ndvi_status = "DATA_UNAVAILABLE"
        ndvi_detail = (
            vegetation_reason
            or "Earth Engine is configured but returned no usable observation for this field."
        )
    else:
        ndvi_status = "AVAILABLE"
        ndvi_detail = (
            "Earth Engine is configured. Availability per field is confirmed when an "
            "analysis runs."
        )

    capabilities: list[Capability] = [
        _cap("nasa_power", "NASA POWER daily weather", weather_status, weather_detail, "nasa-power-daily"),
        _cap(
            "fao56_irrigation",
            "FAO-56 irrigation analysis",
            "DEMO_ONLY" if demo else "AVAILABLE",
            (
                "Deterministic water balance (ET₀, ETc, demand, root-zone refill) computed "
                "from the cached demo snapshot."
                if demo
                else "Deterministic FAO-56 water balance (ET₀, ETc, demand, root-zone refill) "
                "computed from NASA POWER inputs. It is not a sensor reading or a prescription."
            ),
            "derived-power",
        ),
        _cap(
            "crop_health_indicators",
            "Environmental stress indicators",
            "DEMO_ONLY" if demo else "AVAILABLE",
            (
                "Heat, frost, water-stress and rainfall-anomaly indicators computed from the "
                "cached snapshot. No disease diagnosis."
                if demo
                else "Heat, frost, water-stress and rainfall-anomaly indicators computed "
                "deterministically. No disease, pest or nutrient diagnosis."
            ),
            "derived-power",
        ),
        _cap("sentinel2_ndvi", "Sentinel-2 NDVI / NDMI", ndvi_status, ndvi_detail, "gee-ndvi"),
        _cap(
            "nasa_gibs",
            "NASA GIBS satellite imagery",
            "AVAILABLE",
            "Browser-rendered satellite tiles for visual context. AgriNASA reads no values "
            "from the imagery.",
            "nasa-gibs",
        ),
        _cap(
            "open_meteo_forecast",
            "5-day weather forecast",
            "DEMO_ONLY" if demo else "AVAILABLE",
            (
                "Demo mode does not call the live Open-Meteo service, so no forecast is "
                "shown."
                if demo
                else "Keyless Open-Meteo daily forecast. When the provider is unreachable "
                "the forecast is reported unavailable; it is never replaced with observations."
            ),
            "open-meteo-forecast",
        ),
        _cap(
            "geocoding",
            "Place search and reverse geocoding",
            "AVAILABLE",
            "Nominatim proxy used to locate a field. Coordinates remain user-confirmed.",
        ),
        _cap(
            "farmer_guide",
            "Simplified farmer guide",
            "DEMO_ONLY" if demo else "PARTIALLY_AVAILABLE",
            (
                "The farmer summary is unavailable in demo mode by design."
                if demo
                else "Combines weather, the irrigation refill estimate and, when configured, "
                "satellite condition. Satellite inputs may be unavailable."
            ),
        ),
        _cap(
            "demo_snapshot",
            "Cached demo dataset",
            "AVAILABLE" if demo else "PARTIALLY_AVAILABLE",
            (
                "Active: analyses replay the committed Qena snapshot (2025-11-01 to 2026-03-10)."
                if demo
                else "Present but inactive; live mode is selected."
            ),
        ),
    ]

    return capabilities + [dict(entry) for entry in NEVER_IMPLEMENTED]  # type: ignore[list-item]


def unavailable_ids(capabilities: list[Capability]) -> list[str]:
    return [
        capability["id"]
        for capability in capabilities
        if capability["status"] not in {"AVAILABLE"}
    ]
