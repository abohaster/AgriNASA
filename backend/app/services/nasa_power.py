"""
NASA POWER client — the only place that talks to NASA.

WHAT IT DOES
------------
1. Receives coordinates, a date range and a fixed variable list.
2. Calls the official NASA POWER daily point API (community AG, keyless).
3. Validates the response envelope and fill values (-999 → None).
4. Normalises the payload into an internal daily series keyed by our variable
   names and dates.
5. Caches identical requests in-process for a configurable TTL.
6. Raises a typed `NASAUnavailable` error with a user-friendly message.

WHAT IT DOES NOT DO
-------------------
* No science and no unit conversion beyond POWER's documented native units.
  The processing layer owns interpretation.
* No request from the frontend: the browser only sees our API.

NASA POWER daily API docs:
https://power.larc.nasa.gov/docs/services/api/temporal/daily/
"""

import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import date, timedelta

import httpx

from app.config import get_settings
from app.exceptions import NASAUnavailable

logger = logging.getLogger(__name__)

# Internal variable name -> (POWER parameter, unit, label).
# Units are POWER's native units for community AG.
POWER_VARIABLES: dict[str, tuple[str, str, str]] = {
    "t2m_mean_c": ("T2M", "°C", "Mean air temperature at 2 m"),
    "t2m_max_c": ("T2M_MAX", "°C", "Maximum air temperature at 2 m"),
    "t2m_min_c": ("T2M_MIN", "°C", "Minimum air temperature at 2 m"),
    "rh_mean_pct": ("RH2M", "%", "Relative humidity at 2 m"),
    "precipitation_mm": ("PRECTOTCORR", "mm/day", "Corrected precipitation"),
    "wind_speed_2m_ms": ("WS2M", "m/s", "Wind speed at 2 m"),
    "solar_radiation_mj_m2_day": ("ALLSKY_SFC_SW_DWN", "MJ/m²/day", "All-sky shortwave downward irradiance"),
    "pressure_kpa": ("PS", "kPa", "Surface pressure"),
    "soil_moisture_root_fraction": ("GWETROOT", "fraction", "Root-zone soil wetness (MERRA-2)"),
}

POWER_PARAMETERS = [entry[0] for entry in POWER_VARIABLES.values()]
FILL_VALUE = -999.0


@dataclass
class DemoMetadata:
    snapshot_start: date
    snapshot_end: date
    planting_date: date
    location_label: str
    notice: str


@dataclass
class NasaDailySeries:
    """Normalised NASA POWER daily data. Missing days/values are None, never zero."""

    latitude: float
    longitude: float
    elevation_m: float | None
    start: date
    end: date
    values: dict[str, dict[date, float | None]]
    is_demo: bool = False
    demo: DemoMetadata | None = None
    notes: list[str] = field(default_factory=list)

    @property
    def days(self) -> list[date]:
        current = self.start
        days: list[date] = []
        while current <= self.end:
            days.append(current)
            current += timedelta(days=1)
        return days


class _TTLCache:
    """Tiny thread-safe TTL cache (sufficient for a single-process student app)."""

    def __init__(self, ttl_seconds: int):
        self.ttl = ttl_seconds
        self._store: dict[str, tuple[float, NasaDailySeries]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> NasaDailySeries | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            created, value = entry
            if time.monotonic() - created > self.ttl:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: NasaDailySeries) -> None:
        with self._lock:
            self._store[key] = (time.monotonic(), value)


_series_cache = _TTLCache(get_settings().nasa_cache_ttl_seconds)


def _date_key(day: date) -> str:
    return day.strftime("%Y%m%d")


def _to_float(value: object) -> float | None:
    """POWER encodes missing data as -999 (and sometimes strings)."""
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if number == FILL_VALUE or number != number:  # NaN check
        return None
    return number


def parse_daily_payload(payload: dict, *, start: date, end: date) -> tuple[dict, float | None]:
    """Validate and normalise a POWER daily response.

    Returns (values_by_internal_variable, elevation_m). Raises NASAUnavailable if
    the envelope is not a valid POWER response.
    """
    try:
        properties = payload["properties"]
        parameters = properties["parameter"]
    except (KeyError, TypeError) as exc:
        raise NASAUnavailable(
            "NASA POWER returned an unexpected response.",
            details="The response did not contain a 'properties.parameter' object.",
        ) from exc

    if not isinstance(parameters, dict) or not parameters:
        raise NASAUnavailable("NASA POWER returned no parameters for this request.")

    values: dict[str, dict[date, float | None]] = {}
    for internal_name, (power_code, _unit, _label) in POWER_VARIABLES.items():
        raw_series = parameters.get(power_code, {})
        if not isinstance(raw_series, dict):
            raw_series = {}
        parsed: dict[date, float | None] = {}
        current = start
        while current <= end:
            raw_value = raw_series.get(_date_key(current))
            parsed[current] = _to_float(raw_value) if raw_value is not None else None
            current += timedelta(days=1)
        values[internal_name] = parsed

    elevation: float | None = None
    try:
        coordinates = payload["geometry"]["coordinates"]
        if isinstance(coordinates, list) and len(coordinates) >= 3:
            elevation = float(coordinates[2])
    except (KeyError, TypeError, ValueError):
        elevation = None

    return values, elevation


def _request_daily(latitude: float, longitude: float, start: date, end: date) -> NasaDailySeries:
    settings = get_settings()
    params = {
        "parameters": ",".join(POWER_PARAMETERS),
        "community": "AG",
        "latitude": f"{latitude:.4f}",
        "longitude": f"{longitude:.4f}",
        "start": _date_key(start),
        "end": _date_key(end),
        "format": "JSON",
    }
    url = f"{settings.nasa_power_base_url}/daily/point"

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            with httpx.Client(timeout=settings.nasa_timeout_seconds) as client:
                response = client.get(url, params=params, headers={"User-Agent": "AgriNASA/1.0"})
            if response.status_code == 429:
                raise NASAUnavailable(
                    "NASA POWER is rate-limiting requests. Please try again in a few minutes."
                )
            response.raise_for_status()
            payload = response.json()
            values, elevation = parse_daily_payload(payload, start=start, end=end)
            return NasaDailySeries(
                latitude=latitude,
                longitude=longitude,
                elevation_m=elevation,
                start=start,
                end=end,
                values=values,
            )
        except NASAUnavailable:
            raise
        except httpx.TimeoutException as exc:
            last_error = exc
            logger.warning("NASA POWER timed out (attempt %s/2)", attempt + 1)
        except httpx.HTTPStatusError as exc:
            last_error = exc
            logger.warning("NASA POWER HTTP %s (attempt %s/2)", exc.response.status_code, attempt + 1)
        except (httpx.HTTPError, ValueError) as exc:
            last_error = exc
            logger.warning("NASA POWER request failed: %s", exc)
        if attempt == 0:
            time.sleep(1.0)

    raise NASAUnavailable(
        "NASA POWER could not be reached. Check your network connection and try again.",
        details=str(last_error) if last_error else None,
    )


def _demo_daily() -> NasaDailySeries:
    """Replay the cached, clearly labelled POWER snapshot (see app/demo)."""
    from app.services.demo import load_demo_snapshot

    snapshot = load_demo_snapshot()
    if snapshot is None:
        raise NASAUnavailable(
            "Demo data is not available.",
            details="The demo snapshot file is missing or unreadable.",
        )
    return snapshot


def fetch_daily(
    *,
    latitude: float,
    longitude: float,
    start: date,
    end: date,
    mode: str = "live",
) -> NasaDailySeries:
    """Fetch a daily series in live or demo mode, with a TTL cache in live mode."""
    if mode == "demo":
        return _demo_daily()

    cache_key = f"{latitude:.3f}:{longitude:.3f}:{start.isoformat()}:{end.isoformat()}"
    cached = _series_cache.get(cache_key)
    if cached is not None:
        logger.info("NASA POWER cache hit for %s", cache_key)
        return cached

    series = _request_daily(latitude, longitude, start, end)
    _series_cache.set(cache_key, series)
    return series


def fetch_climatology(*, latitude: float, longitude: float, mode: str = "live") -> dict[str, float] | None:
    """
    Fetch 1991–2020 monthly precipitation normals (mm/day).

    The result is reused through the same cache type: start = Jan 1 of the
    baseline, end = Dec 31, with one value per month stored as a JSON-like dict.
    We return a simple dict here to avoid overloading NasaDailySeries semantics.
    """
    if mode == "demo":
        # The demo snapshot does not include climatology; the rainfall anomaly
        # indicator will honestly report that its normal is unavailable.
        return None

    settings = get_settings()
    url = f"{settings.nasa_power_base_url}/climatology/point"
    params = {
        "parameters": "PRECTOTCORR",
        "community": "AG",
        "latitude": f"{latitude:.4f}",
        "longitude": f"{longitude:.4f}",
        "start": "1991",
        "end": "2020",
        "format": "JSON",
    }
    try:
        with httpx.Client(timeout=settings.nasa_timeout_seconds) as client:
            response = client.get(url, params=params, headers={"User-Agent": "AgriNASA/1.0"})
        response.raise_for_status()
        payload = response.json()
        monthly = payload["properties"]["parameter"]["PRECTOTCORR"]
        return {key: monthly[key] for key in monthly if key != "ANN"}
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        # Climatology is contextual; failing it must not fail the whole analysis.
        logger.warning("NASA POWER climatology unavailable: %s", exc)
        return None
