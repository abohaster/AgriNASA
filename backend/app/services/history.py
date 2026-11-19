"""Historical climate comparisons for a point.

WHAT IT ANSWERS
---------------
* how the current month compares with the previous month, the previous season,
  the same period last year and the 1991-2020 baseline;
* monthly and yearly temperature / rainfall / ET₀ series;
* a percentile-based rainfall-deficit indicator for the last 90 days.

SOURCES AND HONESTY
-------------------
Daily values come from the Open-Meteo Historical Weather API (ERA5 and
ERA5-Land reanalysis). The archive lags real time by roughly 2-7 days, so every
comparison names its exact end date. The "drought" figure is a percentile of
90-day rainfall totals, not an official SPI or a drought declaration.
"""

from __future__ import annotations

import bisect
import logging
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from app.config import get_settings
from app.services import open_meteo

logger = logging.getLogger(__name__)

ARCHIVE_LAG_DAYS = 8
SEASON_MONTHS = 3
DROUGHT_WINDOW_DAYS = 90


def _first_of_month(day: date) -> date:
    return date(day.year, day.month, 1)


def _add_months(day: date, months: int) -> date:
    month_index = day.year * 12 + (day.month - 1) + months
    return date(month_index // 12, month_index % 12 + 1, 1)


def _last_of_previous_month(day: date) -> date:
    return _first_of_month(day) - timedelta(days=1)


def _round(value: float | None, digits: int = 1) -> float | None:
    return round(value, digits) if value is not None else None


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _stats(
    days: list[dict[str, Any]],
    start: date,
    end: date,
    humidity: dict[str, dict[str, float]] | None = None,
    soil: dict[str, dict[str, float]] | None = None,
) -> dict[str, Any]:
    selected = [day for day in days if start.isoformat() <= day["date"] <= end.isoformat()]
    temps = [day["t_mean_c"] for day in selected if day.get("t_mean_c") is not None]
    tmax = [day["t_max_c"] for day in selected if day.get("t_max_c") is not None]
    tmin = [day["t_min_c"] for day in selected if day.get("t_min_c") is not None]
    rain = [day["precipitation_mm"] for day in selected if day.get("precipitation_mm") is not None]
    et0 = [day["et0_mm"] for day in selected if day.get("et0_mm") is not None]
    humidity_values = [
        humidity[day["date"]]["humidity_pct"]
        for day in selected
        if humidity and humidity.get(day["date"], {}).get("humidity_pct") is not None
    ]
    moisture_values = [
        soil[day["date"]]["soil_moisture_pct"]
        for day in selected
        if soil and soil.get(day["date"], {}).get("soil_moisture_pct") is not None
    ]
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "days": (end - start).days + 1,
        "temp_mean_c": _round(_mean(temps)),
        "temp_max_mean_c": _round(_mean(tmax)),
        "temp_min_mean_c": _round(_mean(tmin)),
        "precipitation_mm": _round(sum(rain)) if rain else None,
        "rain_days": sum(1 for value in rain if value >= 1.0) if rain else None,
        "et0_mm": _round(sum(et0)) if et0 else None,
        "humidity_pct": _round(_mean(humidity_values)),
        "soil_moisture_0_7cm_pct": _round(_mean(moisture_values)),
        "coverage_fraction": round(len(temps) / max(1, (end - start).days + 1), 2),
    }


def _baseline_month(baseline: list[dict[str, Any]], month: int) -> dict[str, Any] | None:
    per_year: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for day in baseline:
        day_date = date.fromisoformat(day["date"])
        if day_date.month == month:
            per_year[day_date.year].append(day)
    if not per_year:
        return None
    temps = [day["t_mean_c"] for days in per_year.values() for day in days if day.get("t_mean_c") is not None]
    totals = [
        sum(day["precipitation_mm"] for day in days if day.get("precipitation_mm") is not None)
        for days in per_year.values()
    ]
    return {
        "label": f"1991-2020, same calendar month",
        "temp_mean_c": _round(_mean(temps)),
        "precipitation_mm": _round(_mean(totals)),
        "years": len(per_year),
    }


def _baseline_months(baseline: list[dict[str, Any]], months: set[int]) -> dict[str, Any] | None:
    per_year: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for day in baseline:
        day_date = date.fromisoformat(day["date"])
        if day_date.month in months:
            per_year[day_date.year].append(day)
    if not per_year:
        return None
    temps = [day["t_mean_c"] for days in per_year.values() for day in days if day.get("t_mean_c") is not None]
    totals = [
        sum(day["precipitation_mm"] for day in days if day.get("precipitation_mm") is not None)
        for days in per_year.values()
    ]
    return {
        "label": "1991-2020, same calendar months",
        "temp_mean_c": _round(_mean(temps)),
        "precipitation_mm": _round(_mean(totals)),
        "years": len(per_year),
    }


def _rolling_rain_percentile(
    baseline: list[dict[str, Any]],
    recent: list[dict[str, Any]],
    window_days: int = DROUGHT_WINDOW_DAYS,
) -> dict[str, Any] | None:
    baseline_values: list[float] = []
    for index in range(len(baseline) - window_days + 1):
        window = baseline[index : index + window_days]
        values = [day["precipitation_mm"] for day in window if day.get("precipitation_mm") is not None]
        if len(values) < window_days * 0.9:
            continue
        baseline_values.append(sum(values))
    if len(baseline_values) < 100 or not recent:
        return None

    end = date.fromisoformat(recent[-1]["date"])
    start = end - timedelta(days=window_days - 1)
    values = [
        day["precipitation_mm"]
        for day in recent
        if start.isoformat() <= day["date"] <= end.isoformat() and day.get("precipitation_mm") is not None
    ]
    if not values:
        return None
    current = sum(values)
    percentile = bisect.bisect_left(sorted(baseline_values), current) / len(baseline_values) * 100.0
    if percentile < 10:
        category = "very_dry"
    elif percentile < 25:
        category = "dry"
    elif percentile > 90:
        category = "very_wet"
    elif percentile > 75:
        category = "wet"
    else:
        category = "near_normal"
    return {
        "window_days": window_days,
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "precipitation_mm": _round(current),
        "baseline_mean_mm": _round(_mean(baseline_values)),
        "percentile": round(percentile, 0),
        "category": category,
        "method": "percentile of 90-day totals in 1991-2020; not an official SPI or drought declaration",
    }


def _monthly(recent: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for day in recent:
        day_date = date.fromisoformat(day["date"])
        buckets[(day_date.year, day_date.month)].append(day)
    result = []
    for (year, month), days in sorted(buckets.items()):
        temps = [day["t_mean_c"] for day in days if day.get("t_mean_c") is not None]
        rain = [day["precipitation_mm"] for day in days if day.get("precipitation_mm") is not None]
        et0 = [day["et0_mm"] for day in days if day.get("et0_mm") is not None]
        days_in_month = (date(year + (month == 12), month % 12 + 1, 1) - date(year, month, 1)).days
        result.append(
            {
                "year": year,
                "month": month,
                "label": f"{year}-{month:02d}",
                "temp_mean_c": _round(_mean(temps)),
                "precipitation_mm": _round(sum(rain)) if rain else None,
                "et0_mm": _round(sum(et0)) if et0 else None,
                "days_present": len(days),
                "days_in_month": days_in_month,
                "complete": len(days) >= days_in_month,
            }
        )
    return result


def _yearly(recent: list[dict[str, Any]], current_year: int) -> list[dict[str, Any]]:
    buckets: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for day in recent:
        buckets[date.fromisoformat(day["date"]).year].append(day)
    result = []
    for year, days in sorted(buckets.items()):
        temps = [day["t_mean_c"] for day in days if day.get("t_mean_c") is not None]
        rain = [day["precipitation_mm"] for day in days if day.get("precipitation_mm") is not None]
        et0 = [day["et0_mm"] for day in days if day.get("et0_mm") is not None]
        result.append(
            {
                "year": year,
                "temp_mean_c": _round(_mean(temps)),
                "precipitation_mm": _round(sum(rain)) if rain else None,
                "et0_mm": _round(sum(et0)) if et0 else None,
                "days_present": len(days),
                "complete": year != current_year,
            }
        )
    return result


def build_recent_context(
    latitude: float,
    longitude: float,
    *,
    years: int = 3,
    end: date | None = None,
) -> dict[str, Any]:
    """Compact recent history for the assistant; no 30-year baseline fetch.

    The chat needs enough recent monthly and yearly context to answer seasonal
    questions and screen a crop without paying the cold-start cost of the full
    historical comparison page.
    """
    archive_end = date.today() - timedelta(days=ARCHIVE_LAG_DAYS)
    if end is not None:
        archive_end = min(end, archive_end)
    year_count = max(2, min(years, 5))
    start = date(archive_end.year - year_count + 1, 1, 1)

    recent = open_meteo.daily_series(latitude, longitude, start, archive_end)
    if recent is None or not recent["days"]:
        return {
            "available": False,
            "reason": "The historical archive could not be reached. No values are substituted.",
            "sources": ["open-meteo-archive"],
        }

    return {
        "available": True,
        "latitude": round(latitude, 4),
        "longitude": round(longitude, 4),
        "available_period": {
            "start": start.isoformat(),
            "end": archive_end.isoformat(),
            "note": "Recent ERA5 archive window; it lags real time by several days.",
        },
        "monthly": _monthly(recent["days"]),
        "yearly": _yearly(recent["days"], archive_end.year),
        "daily": recent["days"][-30:],
        "sources": ["open-meteo-archive"],
        "fetched_at": recent.get("fetched_at"),
        "limitations": [
            "Historical values are ERA5 reanalysis on a ~9-25 km grid, not a local weather station.",
            "The long-term 1991-2020 baseline is not included in this compact context.",
        ],
    }


def build_history(
    latitude: float,
    longitude: float,
    *,
    end: date | None = None,
    years: int | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    archive_end = date.today() - timedelta(days=ARCHIVE_LAG_DAYS)
    if end is not None:
        archive_end = min(end, archive_end)

    year_count = max(3, min(years or settings.history_default_years, 10))
    recent_start = date(archive_end.year - year_count + 1, 1, 1)
    recent = open_meteo.daily_series(latitude, longitude, recent_start, archive_end)
    if recent is None or not recent["days"]:
        return {
            "available": False,
            "reason": "The historical archive could not be reached. No values are substituted.",
            "sources": ["open-meteo-archive"],
        }

    current_month_start = _first_of_month(archive_end)
    previous_month_end = current_month_start - timedelta(days=1)
    previous_month_start = _first_of_month(previous_month_end)
    season_end = previous_month_end
    season_start = _add_months(current_month_start, -SEASON_MONTHS)
    previous_year_start = _add_months(current_month_start, -12)
    previous_year_end = previous_year_start + (archive_end - current_month_start)
    hourly_start = max(recent_start, archive_end - timedelta(days=400))
    hourly = open_meteo.hourly_daily_means(latitude, longitude, hourly_start, archive_end) or {}

    baseline_start = date(settings.climate_baseline_start, 1, 1)
    baseline_end = date(settings.climate_baseline_end, 12, 31)
    baseline_payload = open_meteo.daily_series(
        latitude, longitude, baseline_start, baseline_end, simple=True
    )
    baseline = baseline_payload["days"] if baseline_payload else []
    if not baseline:
        logger.info("1991-2020 baseline unavailable; comparisons omit the long-term row")

    current = _stats(recent["days"], current_month_start, archive_end, hourly, hourly)
    previous_month = _stats(recent["days"], previous_month_start, previous_month_end, hourly, hourly)
    previous_season = _stats(recent["days"], season_start, season_end, hourly, hourly)
    previous_year = _stats(recent["days"], previous_year_start, previous_year_end, hourly, hourly)

    baseline_current = _baseline_month(baseline, archive_end.month) if baseline else None
    baseline_previous = _baseline_month(baseline, previous_month_start.month) if baseline else None
    season_months = {
        (month - 1) % 12 + 1
        for month in range(season_start.month, season_start.month + SEASON_MONTHS)
    }
    baseline_season = _baseline_months(baseline, season_months) if baseline else None
    baseline_previous_year = baseline_current

    def comparison(key: str, label: str, stats: dict[str, Any], base: dict[str, Any] | None) -> dict[str, Any]:
        temp_anomaly = (
            _round(stats["temp_mean_c"] - base["temp_mean_c"])
            if base and stats.get("temp_mean_c") is not None and base.get("temp_mean_c") is not None
            else None
        )
        rain_anomaly = (
            _round(stats["precipitation_mm"] - base["precipitation_mm"])
            if base and stats.get("precipitation_mm") is not None and base.get("precipitation_mm") is not None
            else None
        )
        return {
            "key": key,
            "label": label,
            **stats,
            "baseline": base,
            "temp_anomaly_c": temp_anomaly,
            "precipitation_anomaly_mm": rain_anomaly,
        }

    comparisons = [
        comparison("current", "Current period", current, baseline_current),
        comparison("previous_month", "Previous month", previous_month, baseline_previous),
        comparison("previous_season", "Previous season", previous_season, baseline_season),
        comparison("previous_year", "Same period last year", previous_year, baseline_previous_year),
    ]
    if baseline_current:
        comparisons.append(
            {
                "key": "long_term",
                "label": "1991-2020 average",
                "start": f"{settings.climate_baseline_start}-01-01",
                "end": f"{settings.climate_baseline_end}-12-31",
                "days": None,
                "temp_mean_c": baseline_current["temp_mean_c"],
                "temp_max_mean_c": None,
                "temp_min_mean_c": None,
                "precipitation_mm": baseline_current["precipitation_mm"],
                "rain_days": None,
                "et0_mm": None,
                "humidity_pct": None,
                "soil_moisture_0_7cm_pct": None,
                "coverage_fraction": None,
                "baseline": baseline_current,
                "temp_anomaly_c": None,
                "precipitation_anomaly_mm": None,
            }
        )

    daily = []
    for day in recent["days"][-366:]:
        extra = hourly.get(day["date"], {})
        daily.append(
            {
                **day,
                "humidity_pct": _round(extra.get("humidity_pct")),
                "soil_moisture_0_7cm_pct": _round(extra.get("soil_moisture_pct")),
            }
        )

    return {
        "available": True,
        "latitude": round(latitude, 4),
        "longitude": round(longitude, 4),
        "available_period": {
            "archive_start": "1940-01-01",
            "start": recent_start.isoformat(),
            "end": archive_end.isoformat(),
            "note": "ERA5 archive typically lags real time by 2-7 days.",
        },
        "comparisons": comparisons,
        "monthly": _monthly(recent["days"]),
        "yearly": _yearly(recent["days"], archive_end.year),
        "daily": daily,
        "drought": _rolling_rain_percentile(baseline, recent["days"]),
        "sources": ["open-meteo-archive"],
        "fetched_at": recent.get("fetched_at"),
        "limitations": [
            "Historical values are ERA5/ERA5-Land reanalysis on a ~9-25 km grid, not a local weather station.",
            "The archive lags real time; the end date shown is the latest published day, not today.",
            "Humidity and 0-7 cm soil moisture are daily means computed from hourly archive data and are available for roughly the last year of the requested window.",
            "The long-term baseline is the 1991-2020 mean of the same calendar month(s); it is a reference, not a forecast.",
            "The rainfall percentile is an indicator computed from this dataset, not an official drought index.",
        ],
    }
