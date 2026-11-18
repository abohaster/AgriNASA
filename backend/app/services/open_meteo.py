"""Open-Meteo current conditions and historical archive.

WHY THIS PROVIDER
-----------------
Open-Meteo is keyless, has a documented open licence (CC BY 4.0) and exposes
both the latest model analysis and the ERA5 / ERA5-Land historical archive.
NASA POWER remains the source for the existing field analyses; this module adds
the higher-resolution current and historical layers used by the location
explorer.

Every value is model output (analysis, reanalysis or forecast step), never an
on-farm measurement. The archive typically lags real time by 2-7 days; callers
must show the observation date instead of calling it "now".
"""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import get_settings
from app.services.http_cache import cached_get_json

logger = logging.getLogger(__name__)

CURRENT_TTL_SECONDS = 30 * 60
DAILY_TTL_SECONDS = 12 * 60 * 60
HOURLY_TTL_SECONDS = 12 * 60 * 60

DAILY_VARIABLES = ",".join(
    [
        "temperature_2m_mean",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "wind_speed_10m_max",
        "wind_direction_10m_dominant",
        "shortwave_radiation_sum",
        "et0_fao_evapotranspiration",
    ]
)

# WMO 4677 codes as returned by Open-Meteo. Kept short and factual.
WMO_LABELS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with heavy hail",
}


def _num(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if number != number else number


def _nearest_index(times: list[str], target: str) -> int | None:
    """Index of the latest hourly slot at or before ``target`` (ISO local time)."""
    best: int | None = None
    for index, stamp in enumerate(times):
        if stamp <= target:
            best = index
        else:
            break
    return best


def current_weather(latitude: float, longitude: float) -> dict[str, Any] | None:
    """Latest analysis/forecast step plus today's soil state and ET₀."""
    settings = get_settings()
    params = {
        "latitude": f"{latitude:.4f}",
        "longitude": f"{longitude:.4f}",
        "current": ",".join(
            [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation",
                "rain",
                "weather_code",
                "cloud_cover",
                "surface_pressure",
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m",
            ]
        ),
        "hourly": "relative_humidity_2m,soil_moisture_0_to_7cm,soil_temperature_6cm",
        "daily": "precipitation_sum,et0_fao_evapotranspiration,shortwave_radiation_sum",
        "forecast_days": "1",
        "timezone": "auto",
        "wind_speed_unit": "ms",
    }
    try:
        payload, fetched_at = cached_get_json(
            f"{settings.forecast_base_url}/forecast",
            params,
            namespace="open-meteo",
            ttl_seconds=CURRENT_TTL_SECONDS,
            timeout_seconds=settings.open_meteo_timeout_seconds,
        )
        current = payload["current"]
        hourly = payload.get("hourly") or {}
        daily = payload.get("daily") or {}
        stamp = str(current.get("time", ""))
        index = _nearest_index([str(item) for item in hourly.get("time", [])], stamp)
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.warning("Open-Meteo current conditions unavailable: %s", type(exc).__name__)
        return None

    soil_moisture = None
    soil_temperature = None
    humidity_hourly = None
    if index is not None:
        moisture_values = hourly.get("soil_moisture_0_to_7cm") or []
        temperature_values = hourly.get("soil_temperature_6cm") or []
        humidity_values = hourly.get("relative_humidity_2m") or []
        if index < len(moisture_values):
            soil_moisture = _num(moisture_values[index])
            if soil_moisture is not None:
                soil_moisture *= 100.0  # m³/m³ → percent by volume
        if index < len(temperature_values):
            soil_temperature = _num(temperature_values[index])
        if index < len(humidity_values):
            humidity_hourly = _num(humidity_values[index])

    code = current.get("weather_code")
    try:
        code_int = int(code)
    except (TypeError, ValueError):
        code_int = None

    return {
        "time": stamp,
        "fetched_at": datetime.fromtimestamp(fetched_at, timezone.utc).isoformat(timespec="seconds"),
        "timezone": payload.get("timezone"),
        "elevation_m": _num(payload.get("elevation")),
        "temperature_c": _num(current.get("temperature_2m")),
        "feels_like_c": _num(current.get("apparent_temperature")),
        "humidity_pct": _num(current.get("relative_humidity_2m")) if humidity_hourly is None else humidity_hourly,
        "precipitation_mm": _num(current.get("precipitation")),
        "rain_mm": _num(current.get("rain")),
        "weather_code": code_int,
        "weather": WMO_LABELS.get(code_int, "Unknown") if code_int is not None else None,
        "cloud_cover_pct": _num(current.get("cloud_cover")),
        "pressure_hpa": _num(current.get("surface_pressure")),
        "wind_speed_ms": _num(current.get("wind_speed_10m")),
        "wind_direction_deg": _num(current.get("wind_direction_10m")),
        "wind_gust_ms": _num(current.get("wind_gusts_10m")),
        "soil_moisture_0_7cm_pct": soil_moisture,
        "soil_temperature_6cm_c": soil_temperature,
        "et0_today_mm": _num((daily.get("et0_fao_evapotranspiration") or [None])[0]),
        "rain_today_mm": _num((daily.get("precipitation_sum") or [None])[0]),
        "solar_today_mj_m2": _num((daily.get("shortwave_radiation_sum") or [None])[0]),
    }


def daily_series(
    latitude: float,
    longitude: float,
    start: date,
    end: date,
    *,
    simple: bool = False,
) -> dict[str, Any] | None:
    """Daily archive values for ``start..end`` (inclusive).

    ``simple`` requests only mean temperature and precipitation, which keeps the
    30-year baseline response small.
    """
    settings = get_settings()
    variables = (
        "temperature_2m_mean,precipitation_sum" if simple else DAILY_VARIABLES
    )
    params = {
        "latitude": f"{latitude:.4f}",
        "longitude": f"{longitude:.4f}",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "daily": variables,
        "timezone": "auto",
        "wind_speed_unit": "ms",
    }
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            payload, fetched_at = cached_get_json(
                f"{settings.open_meteo_archive_base_url}/archive",
                params,
                namespace="open-meteo",
                ttl_seconds=DAILY_TTL_SECONDS,
                timeout_seconds=settings.open_meteo_timeout_seconds,
            )
            daily = payload["daily"]
            times = daily["time"]
            break
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            last_error = exc
            if attempt == 0:
                time.sleep(1.0)
    else:
        logger.warning(
            "Open-Meteo archive unavailable: %s",
            type(last_error).__name__ if last_error else "unknown",
        )
        return None

    def column(name: str) -> list[Any]:
        return daily.get(name) or []

    t_mean = column("temperature_2m_mean")
    t_max = column("temperature_2m_max")
    t_min = column("temperature_2m_min")
    rain = column("precipitation_sum")
    wind = column("wind_speed_10m_max")
    wind_dir = column("wind_direction_10m_dominant")
    solar = column("shortwave_radiation_sum")
    et0 = column("et0_fao_evapotranspiration")

    days: list[dict[str, Any]] = []
    for index, stamp in enumerate(times):
        try:
            day = date.fromisoformat(str(stamp))
        except ValueError:
            continue
        days.append(
            {
                "date": day.isoformat(),
                "t_mean_c": _num(t_mean[index]) if index < len(t_mean) else None,
                "t_max_c": _num(t_max[index]) if index < len(t_max) else None,
                "t_min_c": _num(t_min[index]) if index < len(t_min) else None,
                "precipitation_mm": _num(rain[index]) if index < len(rain) else None,
                "wind_max_ms": _num(wind[index]) if index < len(wind) else None,
                "wind_from_deg": _num(wind_dir[index]) if index < len(wind_dir) else None,
                "solar_mj_m2": _num(solar[index]) if index < len(solar) else None,
                "et0_mm": _num(et0[index]) if index < len(et0) else None,
            }
        )

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "timezone": payload.get("timezone"),
        "elevation_m": _num(payload.get("elevation")),
        "fetched_at": datetime.fromtimestamp(fetched_at, timezone.utc).isoformat(timespec="seconds"),
        "days": days,
    }


def hourly_daily_means(
    latitude: float,
    longitude: float,
    start: date,
    end: date,
) -> dict[str, dict[str, float]] | None:
    """Daily means of humidity and 0-7 cm soil state from hourly archive data.

    Open-Meteo does not expose daily aggregates for these variables, and the
    hourly payload grows quickly, so callers keep this window to about a year.
    Soil moisture is converted from m³/m³ to percent by volume.
    """
    settings = get_settings()
    params = {
        "latitude": f"{latitude:.4f}",
        "longitude": f"{longitude:.4f}",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "hourly": "relative_humidity_2m,soil_moisture_0_to_7cm,soil_temperature_0_to_7cm",
        "timezone": "auto",
    }
    try:
        payload, _fetched_at = cached_get_json(
            f"{settings.open_meteo_archive_base_url}/archive",
            params,
            namespace="open-meteo",
            ttl_seconds=HOURLY_TTL_SECONDS,
            timeout_seconds=max(settings.open_meteo_timeout_seconds, 45.0),
        )
        hourly = payload["hourly"]
        times = hourly["time"]
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.warning("Open-Meteo hourly archive unavailable: %s", type(exc).__name__)
        return None

    buckets: dict[str, dict[str, list[float]]] = {}
    columns = {
        "humidity_pct": hourly.get("relative_humidity_2m") or [],
        "soil_moisture_pct": hourly.get("soil_moisture_0_to_7cm") or [],
        "soil_temperature_c": hourly.get("soil_temperature_0_to_7cm") or [],
    }
    for index, stamp in enumerate(times):
        day = str(stamp)[:10]
        bucket = buckets.setdefault(day, {key: [] for key in columns})
        for key, values in columns.items():
            if index < len(values):
                number = _num(values[index])
                if number is not None:
                    bucket[key].append(number * 100.0 if key == "soil_moisture_pct" else number)

    return {
        day: {key: sum(values) / len(values) for key, values in bucket.items() if values}
        for day, bucket in buckets.items()
    }


def archive_window(latitude: float, longitude: float, days: int) -> date:
    """Latest archive end date the service is likely to have published."""
    return date.today() - timedelta(days=max(5, min(days, 10)))
