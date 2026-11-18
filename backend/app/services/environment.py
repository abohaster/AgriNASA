"""
Environment service: orchestrates NASA fetch → processing → API schema → cache rows.

WHY A SERVICE LAYER
-------------------
Routers stay thin; irrigation, crop-health and the assistant all need the same
normalised environment. Centralising defaults (date window, coverage rules,
provenance text) guarantees every page tells the same story.

DATE RULES
----------
* end is requested as yesterday, but the service trims trailing days where ET₀
  cannot be computed. POWER publishes with a lag, and an analysis should end on
  the latest complete day rather than on a null placeholder.
* start defaults to the planting date, capped to 366 days.
* If planting is in the future, a recent 30-day window is returned instead, so a
  planned field still gets environmental context (and irrigation honestly says
  there is no crop yet).
* Demo mode uses the snapshot's own start/end.
"""

from dataclasses import replace
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.config import get_settings
from app.data_catalog import GLOBAL_LIMITATIONS, source_ref
from app.db import repository
from app.db.models import Field
from app.exceptions import ValidationFailure
from app.schemas.environment import EnvironmentResponse, EnvironmentSummary
from app.services import nasa_power
from app.services.nasa_power import NasaDailySeries
from app.services.processing import VARIABLE_UNITS, ProcessedEnvironment, process_series


TRIM_LIMITATION_PREFIX = "NASA POWER had not published complete ET₀ inputs"


def default_end_date() -> date:
    """Request up to yesterday; the service then trims to the latest complete day."""
    return date.today() - timedelta(days=1)


def trim_limitations(env: EnvironmentResponse) -> list[str]:
    """Carry the 'analysis ended early' disclosure into derived analyses."""
    return [line for line in env.limitations if line.startswith(TRIM_LIMITATION_PREFIX)]


def _latest_complete_et0_date(processed: ProcessedEnvironment) -> date | None:
    for point in reversed(processed.points):
        if point.get("et0_mm_day") is not None:
            return date.fromisoformat(point["date"])
    return None


def _trim_to_latest_complete(
    series: NasaDailySeries, processed: ProcessedEnvironment
) -> tuple[NasaDailySeries, int]:
    """Drop trailing days with no computable ET₀.

    POWER frequently has not published the most recent one or more days. Ending
    the window on such a day makes every "latest day" warning fire even though
    the rest of the series is complete, so the analysis ends on the last day it
    can actually defend.
    """
    if series.is_demo:
        return series, 0
    last_complete = _latest_complete_et0_date(processed)
    if last_complete is None or last_complete >= series.end:
        return series, 0
    dropped = (series.end - last_complete).days
    return replace(series, end=last_complete), dropped


def _resolve_window(field: Field, start: date | None, end: date | None, max_days: int) -> tuple[date, date]:
    resolved_end = end or default_end_date()
    if resolved_end < date(1981, 1, 1):
        raise ValidationFailure("End date is before NASA POWER's coverage (1981-01-01).")

    resolved_start = start or field.planting_date
    if resolved_start > resolved_end:
        # Future planting or reversed explicit range: fall back to recent context.
        resolved_start = resolved_end - timedelta(days=29)

    if (resolved_end - resolved_start).days + 1 > max_days:
        resolved_start = resolved_end - timedelta(days=max_days - 1)
    return resolved_start, resolved_end


def build_environment(
    session: Session,
    *,
    field: Field,
    start: date | None = None,
    end: date | None = None,
    mode: str = "live",
    persist: bool = True,
) -> tuple[EnvironmentResponse, ProcessedEnvironment, NasaDailySeries]:
    """Fetch, process and (optionally) cache environmental data for a field."""
    settings = get_settings()
    resolved_start, resolved_end = _resolve_window(field, start, end, settings.nasa_max_series_days)

    series = nasa_power.fetch_daily(
        latitude=field.latitude,
        longitude=field.longitude,
        start=resolved_start,
        end=resolved_end,
        mode=mode,
    )
    processed = process_series(series)
    series, dropped_days = _trim_to_latest_complete(series, processed)
    if dropped_days:
        processed = process_series(series)

    if persist:
        rows = [
            {
                "date": date.fromisoformat(point["date"]),
                "variable": variable,
                "value": point[variable],
                "unit": VARIABLE_UNITS[variable],
            }
            for point in processed.points
            for variable in VARIABLE_UNITS
            if point.get(variable) is not None
        ]
        repository.replace_environment_window(
            session,
            field_id=field.id,
            start=series.start,
            end=series.end,
            source="nasa-power-daily",
            is_demo=series.is_demo,
            rows=rows,
        )

    limitations = [
        GLOBAL_LIMITATIONS[0],
        "Root-zone soil wetness (GWETROOT) is a MERRA-2 model-derived wetness fraction, not a soil probe.",
        "Daily values are interpolated by POWER from a coarse grid; local microclimate can differ substantially.",
    ]
    if dropped_days:
        limitations.append(
            f"NASA POWER had not published complete ET₀ inputs for the most recent "
            f"{dropped_days} day(s); the analysis ends at the latest complete day "
            f"({series.end.isoformat()})."
        )
    if series.is_demo:
        limitations.insert(0, series.demo.notice if series.demo else "Demo snapshot data.")

    response = EnvironmentResponse(
        field_id=field.id,
        start=series.start,
        end=series.end,
        source=source_ref("nasa-power-daily"),
        is_demo=series.is_demo,
        units=VARIABLE_UNITS,
        series=processed.points,
        summary=EnvironmentSummary(**processed.summary),
        missing_variables=processed.missing_variables,
        limitations=limitations,
    )
    return response, processed, series
