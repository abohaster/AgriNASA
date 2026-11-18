"""Location intelligence orchestrator.

Combines independent providers into one honest payload: Open-Meteo current and
recent conditions, ISRIC SoilGrids properties, historical comparisons and, on
request, crop suitability. A failing provider marks only its own section
unavailable; it never silently replaces a value with a default.
"""

from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.data_catalog import source_ref
from app.services import crop_intelligence, gee_observations, geocoding, history, nasa_power, open_meteo, soilgrids

logger = logging.getLogger(__name__)

RECENT_WINDOW_DAYS = 30


def _round(value: float | None, digits: int = 1) -> float | None:
    return round(value, digits) if value is not None else None


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _reading(
    key: str,
    label: str,
    value: float | str | None,
    unit: str | None,
    source_id: str,
    *,
    observed_at: str | None = None,
    period: str | None = None,
    confidence: str = "medium",
    note: str | None = None,
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "value": _round(value) if isinstance(value, float) else value,
        "unit": unit,
        "status": "available" if value is not None else "unavailable",
        "source_id": source_id,
        "observed_at": observed_at,
        "period": period,
        "confidence": confidence if value is not None else "unknown",
        "note": note,
    }


def polygon_area_ha(geometry: dict[str, Any]) -> float | None:
    """Equirectangular polygon area; adequate for field-scale screening."""
    try:
        ring = geometry["coordinates"][0]
        if len(ring) < 4:
            return None
        mean_lat = sum(point[1] for point in ring) / len(ring)
        m_per_deg_lat = 110_540.0
        m_per_deg_lon = 111_320.0 * math.cos(math.radians(mean_lat))
        area = 0.0
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            area += x1 * m_per_deg_lon * y2 * m_per_deg_lat - x2 * m_per_deg_lon * y1 * m_per_deg_lat
        return round(abs(area) / 2.0 / 10_000.0, 2)
    except (KeyError, IndexError, TypeError, ValueError):
        return None


def centroid(geometry: dict[str, Any]) -> tuple[float, float] | None:
    try:
        ring = geometry["coordinates"][0]
        return (
            sum(point[1] for point in ring) / len(ring),
            sum(point[0] for point in ring) / len(ring),
        )
    except (KeyError, IndexError, TypeError, ValueError):
        return None


def _recent_from_power(
    latitude: float, longitude: float, start: date, end: date
) -> dict[str, Any] | None:
    """Fallback recent window when the Open-Meteo archive is unavailable."""
    try:
        series = nasa_power.fetch_daily(
            latitude=latitude, longitude=longitude, start=start, end=end, mode="live"
        )
    except Exception as exc:
        logger.warning("NASA POWER fallback unavailable: %s", type(exc).__name__)
        return None

    def values(name: str) -> list[float]:
        return [value for value in series.values.get(name, {}).values() if value is not None]

    daily = []
    for day in series.days:
        daily.append(
            {
                "date": day.isoformat(),
                "t_mean_c": series.values.get("t2m_mean_c", {}).get(day),
                "t_max_c": series.values.get("t2m_max_c", {}).get(day),
                "t_min_c": series.values.get("t2m_min_c", {}).get(day),
                "precipitation_mm": series.values.get("precipitation_mm", {}).get(day),
                "wind_max_ms": series.values.get("wind_speed_2m_ms", {}).get(day),
                "wind_from_deg": None,
                "solar_mj_m2": series.values.get("solar_radiation_mj_m2_day", {}).get(day),
                "et0_mm": None,
            }
        )
    return {
        "days": daily,
        "start": series.start.isoformat(),
        "end": series.end.isoformat(),
        "timezone": "NASA POWER daily",
        "humidity": {day.isoformat(): value for day, value in series.values.get("rh_mean_pct", {}).items()},
        "soil_wetness": {
            day.isoformat(): value for day, value in series.values.get("soil_moisture_root_fraction", {}).items()
        },
        "source_id": "nasa-power-daily",
        "limitations": [
            "Recent conditions fell back to NASA POWER (0.5° reanalysis) because the Open-Meteo archive was unavailable.",
        ],
    }


def _water_summary(daily: list[dict[str, Any]], humidity: dict[str, dict[str, float]] | None) -> dict[str, Any]:
    rain_values = [day["precipitation_mm"] for day in daily if day.get("precipitation_mm") is not None]
    et0_values = [day["et0_mm"] for day in daily if day.get("et0_mm") is not None]
    rain_total = sum(rain_values) if rain_values else None
    et0_total = sum(et0_values) if et0_values else None
    balance = _round(rain_total - et0_total) if rain_total is not None and et0_total is not None else None
    if balance is None:
        category = "unknown"
    elif balance >= 20:
        category = "surplus"
    elif balance >= -20:
        category = "near_balance"
    elif balance >= -60:
        category = "deficit"
    else:
        category = "severe_deficit"
    humidity_values = [
        humidity[day["date"]]["humidity_pct"]
        for day in daily
        if humidity and humidity.get(day["date"], {}).get("humidity_pct") is not None
    ]
    return {
        "rain_total_mm": _round(rain_total),
        "et0_total_mm": _round(et0_total),
        "balance_mm": balance,
        "category": category,
        "humidity_mean_pct": _round(_mean(humidity_values)),
        "method": "Rainfall minus reference ET₀ over the window; an indicator, not an irrigation schedule.",
    }


def _alerts(
    current: dict[str, Any] | None,
    daily: list[dict[str, Any]],
    water: dict[str, Any],
    soil: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    if current:
        temperature = current.get("temperature_c")
        wind = current.get("wind_speed_ms")
        if temperature is not None and temperature >= 38:
            alerts.append(
                {
                    "key": "heat",
                    "level": "high",
                    "title": "Heat stress possible",
                    "detail": f"Current temperature is {temperature:.1f}°C. Protect seedlings and irrigate early or late.",
                    "sources": ["open-meteo-current"],
                }
            )
        if wind is not None and wind >= 10:
            alerts.append(
                {
                    "key": "wind",
                    "level": "moderate",
                    "title": "Strong wind",
                    "detail": f"Wind is about {wind:.1f} m/s; avoid spraying and check young plants.",
                    "sources": ["open-meteo-current"],
                }
            )
    rain_values = [day["precipitation_mm"] for day in daily if day.get("precipitation_mm") is not None]
    if rain_values and max(rain_values) >= 20:
        alerts.append(
            {
                "key": "heavy_rain",
                "level": "moderate",
                "title": "Heavy rain in the recent window",
                "detail": f"A daily total of {max(rain_values):.0f} mm occurred; check drainage and runoff.",
                "sources": ["open-meteo-archive"],
            }
        )
    if water.get("category") in {"deficit", "severe_deficit"}:
        alerts.append(
            {
                "key": "water_deficit",
                "level": "high" if water["category"] == "severe_deficit" else "moderate",
                "title": "Water deficit",
                "detail": f"Rainfall minus ET₀ is {water['balance_mm']:.0f} mm over the window; irrigation is likely needed.",
                "sources": ["open-meteo-archive"],
            }
        )
    if soil:
        topsoil = soil.get("topsoil") or {}
        ph = topsoil.get("ph")
        if ph is not None and (ph < 5.5 or ph > 8.2):
            alerts.append(
                {
                    "key": "soil_ph",
                    "level": "moderate",
                    "title": "Soil pH outside common crop range",
                    "detail": f"Modelled topsoil pH is {ph:.1f}; confirm with a soil test before selecting a sensitive crop.",
                    "sources": ["soilgrids"],
                }
            )
        soc = topsoil.get("organic_carbon_g_kg")
        if soc is not None and soc < 10:
            alerts.append(
                {
                    "key": "low_organic_carbon",
                    "level": "info",
                    "title": "Low organic carbon",
                    "detail": f"Modelled organic carbon is {soc:.1f} g/kg; organic matter can improve structure and water holding.",
                    "sources": ["soilgrids"],
                }
            )
    return alerts


def _sources(ids: set[str]) -> list[dict[str, Any]]:
    return [source_ref(source_id) for source_id in sorted(ids) if source_id]


def build_overview(
    latitude: float,
    longitude: float,
    *,
    geometry: dict[str, Any] | None = None,
    crop_id: str | None = None,
    label: str | None = None,
) -> dict[str, Any]:
    """Current conditions, soil, recent water balance and alerts for a point/field."""
    center_lat, center_lon = latitude, longitude
    if geometry:
        center = centroid(geometry)
        if center:
            center_lat, center_lon = center

    details = geocoding.reverse_details(center_lat, center_lon)
    location = {
        **details,
        "label": label or details.get("label"),
        "latitude": round(latitude, 5),
        "longitude": round(longitude, 5),
        "analysis_latitude": round(center_lat, 5),
        "analysis_longitude": round(center_lon, 5),
        "area_ha": polygon_area_ha(geometry) if geometry else None,
        "geometry_source": "polygon" if geometry else "point",
    }

    source_ids: set[str] = {"open-meteo-current", "open-meteo-archive"}
    limitations: list[str] = []

    current_raw = open_meteo.current_weather(center_lat, center_lon)
    if current_raw is None:
        current = {"available": False, "reason": "Open-Meteo current conditions could not be reached."}
        source_ids.discard("open-meteo-current")
    else:
        observed = current_raw.get("time")
        current = {
            "available": True,
            "time": observed,
            "weather": current_raw.get("weather"),
            "weather_code": current_raw.get("weather_code"),
            "elevation_m": current_raw.get("elevation_m"),
            "readings": [
                _reading("temperature_c", "Temperature", current_raw.get("temperature_c"), "°C", "open-meteo-current", observed_at=observed, confidence="high"),
                _reading("feels_like_c", "Feels like", current_raw.get("feels_like_c"), "°C", "open-meteo-current", observed_at=observed),
                _reading("humidity_pct", "Relative humidity", current_raw.get("humidity_pct"), "%", "open-meteo-current", observed_at=observed),
                _reading("precipitation_mm", "Precipitation (current step)", current_raw.get("precipitation_mm"), "mm", "open-meteo-current", observed_at=observed),
                _reading("wind_speed_ms", "Wind speed", current_raw.get("wind_speed_ms"), "m/s", "open-meteo-current", observed_at=observed),
                _reading("wind_direction_deg", "Wind direction", current_raw.get("wind_direction_deg"), "°", "open-meteo-current", observed_at=observed),
                _reading("pressure_hpa", "Surface pressure", current_raw.get("pressure_hpa"), "hPa", "open-meteo-current", observed_at=observed),
                _reading("cloud_cover_pct", "Cloud cover", current_raw.get("cloud_cover_pct"), "%", "open-meteo-current", observed_at=observed),
                _reading("soil_moisture_0_7cm_pct", "Soil moisture (0-7 cm, model)", current_raw.get("soil_moisture_0_7cm_pct"), "% vol", "open-meteo-current", observed_at=observed, confidence="low", note="ERA5-Land model value, not a probe."),
                _reading("soil_temperature_6cm_c", "Soil temperature (6 cm, model)", current_raw.get("soil_temperature_6cm_c"), "°C", "open-meteo-current", observed_at=observed, confidence="low", note="ERA5-Land model value, not a probe."),
                _reading("et0_today_mm", "Reference ET₀ today", current_raw.get("et0_today_mm"), "mm/day", "open-meteo-current", observed_at=observed, note="FAO-56 reference evapotranspiration computed by Open-Meteo."),
                _reading("solar_today_mj_m2", "Solar radiation today", current_raw.get("solar_today_mj_m2"), "MJ/m²", "open-meteo-current", observed_at=observed),
            ],
        }

    archive_end = date.today() - timedelta(days=8)
    recent_start = archive_end - timedelta(days=RECENT_WINDOW_DAYS - 1)
    archive = open_meteo.daily_series(center_lat, center_lon, recent_start, archive_end)
    humidity = open_meteo.hourly_daily_means(center_lat, center_lon, recent_start, archive_end) or {}
    recent_source = "open-meteo-archive"
    if archive is None:
        fallback = _recent_from_power(center_lat, center_lon, recent_start, archive_end)
        if fallback:
            daily = fallback["days"]
            humidity = {
                day: {"humidity_pct": value}
                for day, value in fallback["humidity"].items()
            }
            recent_source = "nasa-power-daily"
            source_ids.discard("open-meteo-archive")
            source_ids.add("nasa-power-daily")
            limitations.extend(fallback["limitations"])
        else:
            daily = []
            source_ids.discard("open-meteo-archive")
            limitations.append("Recent archive conditions were unavailable, so the 30-day block is missing.")
    else:
        daily = archive["days"]

    water = _water_summary(daily, humidity)
    window = f"{recent_start.isoformat()} to {archive_end.isoformat()}"
    water["readings"] = [
        _reading("rain_total_mm", "Rainfall total", water["rain_total_mm"], "mm", recent_source, period=window),
        _reading("et0_total_mm", "Reference ET₀ total", water["et0_total_mm"], "mm", recent_source, period=window),
        _reading("balance_mm", "Rainfall minus ET₀", water["balance_mm"], "mm", recent_source, period=window, note=water["method"]),
        _reading("humidity_mean_pct", "Mean humidity", water["humidity_mean_pct"], "%", recent_source, period=window, confidence="low", note="Daily mean from hourly data."),
    ]

    weather = {
        "period_start": recent_start.isoformat(),
        "period_end": archive_end.isoformat(),
        "source_id": recent_source,
        "days": len(daily),
        "daily": daily,
        "readings": [
            _reading("temp_mean_c", "Mean temperature", _mean([day["t_mean_c"] for day in daily if day.get("t_mean_c") is not None]), "°C", recent_source, period=window),
            _reading("temp_max_mean_c", "Mean daily maximum", _mean([day["t_max_c"] for day in daily if day.get("t_max_c") is not None]), "°C", recent_source, period=window),
            _reading("temp_min_mean_c", "Mean daily minimum", _mean([day["t_min_c"] for day in daily if day.get("t_min_c") is not None]), "°C", recent_source, period=window),
        ],
    }

    alerts = _alerts(current_raw, daily, water, None)
    limitations.extend(
        [
            "A point analysis uses the nearest model cell; a field polygon is analysed by its centroid here and by its full area on the vegetation tab.",
            "Alerts are screening flags from these datasets, not a diagnosis.",
        ]
    )

    return {
        "available": True,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "location": location,
        "crop_id": crop_id,
        "current": current,
        "weather": weather,
        "water": water,
        "alerts": alerts,
        "sources": _sources(source_ids),
        "limitations": limitations,
    }


def build_soil(
    latitude: float, longitude: float, *, geometry: dict[str, Any] | None = None
) -> dict[str, Any]:
    """ISRIC SoilGrids topsoil properties, kept separate because it is slow.

    The public SoilGrids API can take tens of seconds; isolating it lets the map
    and current conditions render while the soil card loads in parallel. The
    disk cache keeps repeat visits instant for 30 days.
    """
    soil_raw = soilgrids.fetch_soil(latitude, longitude, geometry=geometry)
    if soil_raw is None:
        return {
            "available": False,
            "reason": "SoilGrids could not be reached; no soil values are shown.",
            "sources": [],
            "sources_detail": [],
            "limitations": ["SoilGrids is a modelled 250 m product, not a soil test."],
        }

    topsoil = soil_raw["topsoil"]
    texture = soil_raw["texture"]
    readings = [
        _reading("ph", "Topsoil pH", topsoil.get("ph"), None, "soilgrids", period="0-30 cm model", confidence="medium", note="Modelled, not a laboratory test."),
        _reading("organic_carbon_g_kg", "Organic carbon", topsoil.get("organic_carbon_g_kg"), "g/kg", "soilgrids", period="0-30 cm model", confidence="medium"),
        _reading("clay_pct", "Clay", topsoil.get("clay_pct"), "%", "soilgrids", period="0-30 cm model", confidence="medium"),
        _reading("sand_pct", "Sand", topsoil.get("sand_pct"), "%", "soilgrids", period="0-30 cm model", confidence="medium"),
        _reading("silt_pct", "Silt", topsoil.get("silt_pct"), "%", "soilgrids", period="0-30 cm model", confidence="medium"),
        _reading("bulk_density_g_cm3", "Bulk density", topsoil.get("bulk_density_g_cm3"), "g/cm³", "soilgrids", period="0-30 cm model", confidence="medium"),
        _reading("cec_cmol_kg", "Cation exchange capacity", topsoil.get("cec_cmol_kg"), "cmol/kg", "soilgrids", period="0-30 cm model", confidence="medium"),
        _reading("nitrogen_g_kg", "Total nitrogen", topsoil.get("nitrogen_g_kg"), "g/kg", "soilgrids", period="0-30 cm model", confidence="low"),
    ]

    alerts = _alerts(None, [], {}, soil_raw)
    return {
        "available": True,
        "texture": texture,
        "layers": soil_raw["layers"],
        "fetched_at": soil_raw["fetched_at"],
        "access": soil_raw.get("access"),
        "aggregation": soil_raw.get("aggregation"),
        "readings": readings,
        "alerts": alerts,
        "sources": ["soilgrids"],
        "sources_detail": _sources({"soilgrids"}),
        "limitations": [
            "SoilGrids values are modelled at 250 m and are not a soil test.",
            "Texture class is an approximation from modelled clay, sand and silt fractions.",
        ],
    }


def build_vegetation(
    latitude: float,
    longitude: float,
    *,
    geometry: dict[str, Any] | None = None,
    history_months: int = 6,
) -> dict[str, Any]:
    payload = gee_observations.observe(
        latitude, longitude, geometry=geometry, history_months=history_months
    )
    if payload.get("available"):
        payload["sources_detail"] = _sources(set(payload.get("sources", [])))
    else:
        payload["sources_detail"] = []
    payload["latitude"] = round(latitude, 5)
    payload["longitude"] = round(longitude, 5)
    return payload


def build_history(
    latitude: float,
    longitude: float,
    *,
    end: date | None = None,
    years: int | None = None,
) -> dict[str, Any]:
    payload = history.build_history(latitude, longitude, end=end, years=years)
    payload["sources_detail"] = _sources(set(payload.get("sources", [])))
    return payload


def build_crop(
    latitude: float,
    longitude: float,
    crop_id: str,
    *,
    geometry: dict[str, Any] | None = None,
) -> dict[str, Any]:
    center_lat, center_lon = latitude, longitude
    if geometry:
        center = centroid(geometry)
        if center:
            center_lat, center_lon = center

    soil = soilgrids.fetch_soil(center_lat, center_lon, geometry=geometry)
    historical = history.build_history(center_lat, center_lon)
    current = open_meteo.current_weather(center_lat, center_lon)
    assessment = crop_intelligence.assess_crop(
        crop_id,
        latitude=latitude,
        longitude=longitude,
        soil=soil,
        history=historical,
        current=current,
    )
    assessment["location"] = {
        "latitude": round(latitude, 5),
        "longitude": round(longitude, 5),
        "area_ha": polygon_area_ha(geometry) if geometry else None,
        "geometry_source": "polygon" if geometry else "point",
    }
    assessment["sources_detail"] = _sources(set(assessment.get("sources", [])))
    return assessment
