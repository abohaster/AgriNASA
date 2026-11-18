"""
Short daily weather forecast for the simplified farmer guide.

WHY A SEPARATE PROVIDER
-----------------------
NASA POWER publishes daily data only up to near real time — it has no forecast
product. Rather than relabeling yesterday's observation as a "forecast", the
farmer endpoint asks Open-Meteo, a keyless numerical weather service, for the
next few days. The attribution is carried in the response, and every failure is
reported as an unavailable forecast.

The call happens on the backend only, like every other external request in this
project. No value is invented when the provider is unreachable.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

PROVIDER = "Open-Meteo"
ATTRIBUTION = "Open-Meteo forecast (CC BY 4.0), numerical weather model"
FORECAST_DAYS = 5


@dataclass(frozen=True)
class ForecastDay:
    date: date
    temperature_max_c: float | None
    temperature_min_c: float | None
    rain_mm: float | None
    wind_max_ms: float | None


@dataclass(frozen=True)
class ForecastResult:
    available: bool
    days: list[ForecastDay] = field(default_factory=list)
    reason: str | None = None


def _number(values: list | None, index: int) -> float | None:
    if not values or index >= len(values):
        return None
    try:
        number = float(values[index])
    except (TypeError, ValueError):
        return None
    if number != number:  # NaN
        return None
    return number


def fetch_forecast(latitude: float, longitude: float) -> ForecastResult:
    """Next `FORECAST_DAYS` days including today, or an honest unavailable result."""
    settings = get_settings()
    params = {
        "latitude": f"{latitude:.4f}",
        "longitude": f"{longitude:.4f}",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
        "forecast_days": FORECAST_DAYS,
        "timezone": "auto",
        "wind_speed_unit": "ms",
    }
    try:
        with httpx.Client(timeout=settings.forecast_timeout_seconds) as client:
            response = client.get(f"{settings.forecast_base_url}/forecast", params=params)
        response.raise_for_status()
        payload = response.json()
        daily = payload["daily"]
        times = daily["time"]
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.warning("Open-Meteo forecast unavailable: %s", type(exc).__name__)
        return ForecastResult(
            available=False,
            reason="The Open-Meteo forecast could not be reached, so no forecast is shown.",
        )

    days: list[ForecastDay] = []
    for index, raw_day in enumerate(times):
        try:
            day = date.fromisoformat(str(raw_day))
        except ValueError:
            continue
        days.append(
            ForecastDay(
                date=day,
                temperature_max_c=_number(daily.get("temperature_2m_max"), index),
                temperature_min_c=_number(daily.get("temperature_2m_min"), index),
                rain_mm=_number(daily.get("precipitation_sum"), index),
                wind_max_ms=_number(daily.get("wind_speed_10m_max"), index),
            )
        )

    if not days:
        return ForecastResult(
            available=False,
            reason="The Open-Meteo forecast returned no usable days.",
        )
    return ForecastResult(available=True, days=days)
