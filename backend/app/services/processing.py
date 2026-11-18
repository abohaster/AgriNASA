"""
Data processing: POWER series → internal environment schema.

WHAT THIS LAYER DOES
--------------------
* Aligns every variable onto a complete daily calendar (missing days stay None).
* Documents the unit normalization (POWER community AG already returns the units
  used internally, so values are passed through without silent scaling).
* Computes ET₀ per day by calling the pure FAO-56 module and records per-day
  missing-input reasons.
* Produces the summary used by dashboard cards: latest values, totals, 7-day
  trends and coverage.
* Never fills gaps by interpolation, forward-fill or zero for ET₀ inputs.

UNIT NOTES (POWER AG → internal)
--------------------------------
T2M/T2M_MAX/T2M_MIN  °C          → °C
RH2M                 %           → %
PRECTOTCORR          mm/day      → mm/day
WS2M                 m/s         → m/s
ALLSKY_SFC_SW_DWN    MJ/m²/day   → MJ/m²/day
PS                   kPa         → kPa
GWETROOT             fraction    → fraction (model-derived wetness, not a probe)

If POWER changes a unit, update POWER_VARIABLES and add an explicit conversion
function here — never adjust values silently.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta

from app.science.et0 import Et0Inputs, compute_et0
from app.services.nasa_power import NasaDailySeries, POWER_VARIABLES

# Variables shown in trend summaries (precipitation is a total, not a level).
TREND_VARIABLES = [
    "t2m_mean_c",
    "rh_mean_pct",
    "wind_speed_2m_ms",
    "solar_radiation_mj_m2_day",
    "soil_moisture_root_fraction",
    "et0_mm_day",
]

TREND_WINDOW_DAYS = 7
MIN_TREND_POINTS = 4

VARIABLE_LABELS = {name: entry[2] for name, entry in POWER_VARIABLES.items()}
VARIABLE_UNITS = {name: entry[1] for name, entry in POWER_VARIABLES.items()}
VARIABLE_UNITS["et0_mm_day"] = "mm/day"
VARIABLE_LABELS["et0_mm_day"] = "FAO-56 reference evapotranspiration"


@dataclass
class ProcessedEnvironment:
    points: list[dict]
    et0_by_date: dict[date, float | None]
    et0_missing_by_date: dict[date, list[str]]
    coverage_fraction: float
    precipitation_coverage: float
    summary: dict
    missing_variables: list[str]
    notes: list[str] = field(default_factory=list)


def _mean(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 3) if values else None


def _trend(points: list[dict], variable: str) -> dict | None:
    """Compare the last 7 days with the previous 7 days for one variable."""
    if not points:
        return None
    window = points[-TREND_WINDOW_DAYS:]
    previous = points[-2 * TREND_WINDOW_DAYS : -TREND_WINDOW_DAYS]
    current_values = [p[variable] for p in window if p.get(variable) is not None]
    previous_values = [p[variable] for p in previous if p.get(variable) is not None]
    if len(current_values) < MIN_TREND_POINTS or len(previous_values) < MIN_TREND_POINTS:
        return None

    current_mean = sum(current_values) / len(current_values)
    previous_mean = sum(previous_values) / len(previous_values)
    change = current_mean - previous_mean
    if abs(change) < 0.05:
        direction = "flat"
    else:
        direction = "up" if change > 0 else "down"

    return {
        "variable": variable,
        "label": VARIABLE_LABELS.get(variable, variable),
        "unit": VARIABLE_UNITS.get(variable, ""),
        "change": round(change, 3),
        "direction": direction,
        "window_days": TREND_WINDOW_DAYS,
    }


def process_series(series: NasaDailySeries) -> ProcessedEnvironment:
    """Convert a normalised NASA series into points, ET₀ and summary statistics."""
    points: list[dict] = []
    et0_by_date: dict[date, float | None] = {}
    et0_missing_by_date: dict[date, list[str]] = {}
    et0_notes: list[str] = []

    for day in series.days:
        point = {"date": day.isoformat()}
        for variable in POWER_VARIABLES:
            point[variable] = series.values.get(variable, {}).get(day)

        result = compute_et0(
            Et0Inputs(
                day=day,
                latitude_deg=series.latitude,
                elevation_m=series.elevation_m,
                tmax_c=point["t2m_max_c"],
                tmin_c=point["t2m_min_c"],
                rh_mean_pct=point["rh_mean_pct"],
                wind_speed_2m_ms=point["wind_speed_2m_ms"],
                solar_radiation_mj_m2_day=point["solar_radiation_mj_m2_day"],
                pressure_kpa=point["pressure_kpa"],
            )
        )
        point["et0_mm_day"] = result.et0_mm_day
        et0_by_date[day] = result.et0_mm_day
        et0_missing_by_date[day] = result.missing_inputs
        et0_notes.extend(result.notes)
        points.append(point)

    days_count = len(points) or 1
    coverage = sum(1 for day in et0_by_date if et0_by_date[day] is not None) / days_count
    precip_coverage = sum(1 for p in points if p["precipitation_mm"] is not None) / days_count

    # Coverage per variable decides which cards are shown as unavailable.
    missing_variables: list[str] = []
    for variable in list(POWER_VARIABLES) + ["et0_mm_day"]:
        available = sum(1 for p in points if p.get(variable) is not None)
        if available == 0 or available / days_count < 0.8:
            missing_variables.append(variable)

    latest: dict[str, float | None] = {}
    latest_dates: dict[str, str | None] = {}
    for variable in list(POWER_VARIABLES) + ["et0_mm_day"]:
        value: float | None = None
        value_date: str | None = None
        for point in reversed(points):
            candidate = point.get(variable)
            if candidate is not None:
                value = candidate
                value_date = point["date"]
                break
        latest[variable] = value
        latest_dates[variable] = value_date

    et0_values = [v for v in et0_by_date.values() if v is not None]
    precip_values = [p["precipitation_mm"] for p in points if p["precipitation_mm"] is not None]

    trends = [trend for trend in (_trend(points, variable) for variable in TREND_VARIABLES) if trend]
    latest_date = next((p["date"] for p in reversed(points) if any(
        p.get(variable) is not None for variable in POWER_VARIABLES
    )), None)

    summary = {
        "days_returned": len(points),
        "coverage_fraction": round(coverage, 3),
        "latest_date": latest_date,
        "latest": latest,
        "latest_dates": latest_dates,
        "precipitation_total_mm": round(sum(precip_values), 2) if precip_values else None,
        "et0_total_mm": round(sum(et0_values), 2) if et0_values else None,
        "et0_mean_mm_day": _mean(et0_values),
        "trends": trends,
        "missing_variables": missing_variables,
    }

    notes = list(series.notes)
    if coverage < 1.0:
        notes.append(
            f"ET₀ could be computed for {coverage * 100:.0f}% of days; incomplete days are excluded "
            "rather than filled with estimated weather."
        )
    # Keep notes unique and deterministic.
    notes = list(dict.fromkeys(notes))

    return ProcessedEnvironment(
        points=points,
        et0_by_date=et0_by_date,
        et0_missing_by_date=et0_missing_by_date,
        coverage_fraction=round(coverage, 4),
        precipitation_coverage=round(precip_coverage, 4),
        summary=summary,
        missing_variables=missing_variables,
        notes=notes,
    )


def recent_precipitation_total(points: list[dict], days: int) -> float | None:
    """Sum rainfall over the last N days; None if fewer than 80% of days have data."""
    window = points[-days:]
    if not window:
        return None
    available = [p["precipitation_mm"] for p in window if p["precipitation_mm"] is not None]
    if len(available) < max(1, int(days * 0.8)):
        return None
    return round(sum(available), 1)


def monthly_rainfall_normal_mm_per_day(climatology: dict[str, float] | None, month: int) -> float | None:
    """Extract the monthly normal (mm/day) for a calendar month from POWER data."""
    if not climatology:
        return None
    key = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][month - 1]
    value = climatology.get(key)
    try:
        number = float(value) if value is not None else None
    except (TypeError, ValueError):
        return None
    if number is None or number < 0:
        return None
    return number


def normal_30_day_rainfall_mm(climatology: dict[str, float] | None, end_day: date) -> float | None:
    """
    Approximate a 30-day normal as 30 × the end month's mean daily normal.

    This is an approximation used only for a contextual anomaly indicator; it is
    labelled as such in the UI and is not part of the irrigation water balance.
    """
    daily = monthly_rainfall_normal_mm_per_day(climatology, end_day.month)
    if daily is None:
        return None
    return round(daily * 30.0, 1)


def subset_points(points: list[dict], start: date, end: date) -> list[dict]:
    """Filter a processed series to an inclusive ISO-date window."""
    start_iso, end_iso = start.isoformat(), end.isoformat()
    return [point for point in points if start_iso <= point["date"] <= end_iso]


def add_days(day: date, days: int) -> date:
    return day + timedelta(days=days)
