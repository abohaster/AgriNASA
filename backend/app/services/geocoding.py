"""
Geocoding proxy.

Location search uses the public OpenStreetMap Nominatim service through the
backend, so the browser never needs a key and the required User-Agent/usage
policy is respected in one place. Results are cached briefly.

This is *not* a NASA service; the UI labels the map accordingly. If Nominatim is
unavailable, search returns a friendly error and reverse geocoding falls back to
a coordinate label rather than blocking field creation.
"""

import logging
import threading
import time

import httpx

from app.config import get_settings
from app.exceptions import GeocodingUnavailable
from app.schemas.fields import GeocodeResult, ReverseGeocodeResult

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[float, object]] = {}
_lock = threading.Lock()
CACHE_TTL_SECONDS = 24 * 60 * 60


def _cached(key: str):
    with _lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        created, value = entry
        if time.monotonic() - created > CACHE_TTL_SECONDS:
            _cache.pop(key, None)
            return None
        return value


def _set_cache(key: str, value: object) -> None:
    with _lock:
        _cache[key] = (time.monotonic(), value)


def search_places(query: str, limit: int = 5) -> list[GeocodeResult]:
    """Search a place name and return up to `limit` points."""
    cleaned = query.strip()
    if len(cleaned) < 2:
        return []

    key = f"search:{cleaned.lower()}:{limit}"
    cached = _cached(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    settings = get_settings()
    params = {
        "format": "jsonv2",
        "q": cleaned,
        "limit": str(limit),
        "addressdetails": "0",
    }
    try:
        with httpx.Client(timeout=settings.geocoding_timeout_seconds) as client:
            response = client.get(
                f"{settings.geocoding_base_url}/search",
                params=params,
                headers={"User-Agent": settings.geocoding_user_agent, "Accept-Language": "en"},
            )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Geocoding search failed: %s", exc)
        raise GeocodingUnavailable(
            "Location search is unavailable right now. You can still enter coordinates manually."
        ) from exc

    results: list[GeocodeResult] = []
    for item in payload if isinstance(payload, list) else []:
        try:
            results.append(
                GeocodeResult(
                    label=str(item.get("display_name", "")).strip()[:255],
                    latitude=float(item["lat"]),
                    longitude=float(item["lon"]),
                    kind=str(item.get("type")) if item.get("type") else None,
                )
            )
        except (KeyError, TypeError, ValueError):
            continue

    _set_cache(key, results)
    return results


def reverse_place(latitude: float, longitude: float) -> ReverseGeocodeResult:
    """Return a readable label, or a coordinate label if the service fails."""
    key = f"reverse:{latitude:.4f}:{longitude:.4f}"
    cached = _cached(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    settings = get_settings()
    params = {"format": "jsonv2", "lat": f"{latitude:.6f}", "lon": f"{longitude:.6f}", "zoom": "10"}
    label = f"{latitude:.4f}, {longitude:.4f}"
    try:
        with httpx.Client(timeout=settings.geocoding_timeout_seconds) as client:
            response = client.get(
                f"{settings.geocoding_base_url}/reverse",
                params=params,
                headers={"User-Agent": settings.geocoding_user_agent, "Accept-Language": "en"},
            )
        if response.status_code == 200:
            payload = response.json()
            candidate = str(payload.get("display_name", "")).strip()
            if candidate:
                label = candidate[:255]
    except (httpx.HTTPError, ValueError) as exc:
        logger.info("Reverse geocoding failed, using coordinate label: %s", exc)

    result = ReverseGeocodeResult(label=label, latitude=latitude, longitude=longitude)
    _set_cache(key, result)
    return result


def reverse_details(latitude: float, longitude: float) -> dict[str, object]:
    """Structured administrative context for the location explorer.

    Returns empty fields (never invented names) when Nominatim is unreachable.
    """
    key = f"reverse-details:{latitude:.4f}:{longitude:.4f}"
    cached = _cached(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    settings = get_settings()
    params = {
        "format": "jsonv2",
        "lat": f"{latitude:.6f}",
        "lon": f"{longitude:.6f}",
        "zoom": "10",
        "addressdetails": "1",
    }
    details: dict[str, object] = {
        "label": f"{latitude:.4f}, {longitude:.4f}",
        "country": None,
        "country_code": None,
        "region": None,
        "county": None,
        "nearest_place": None,
        "suburb": None,
        "road": None,
        "attribution": "OpenStreetMap Nominatim",
    }
    try:
        with httpx.Client(timeout=settings.geocoding_timeout_seconds) as client:
            response = client.get(
                f"{settings.geocoding_base_url}/reverse",
                params=params,
                headers={"User-Agent": settings.geocoding_user_agent, "Accept-Language": "en"},
            )
        if response.status_code == 200:
            payload = response.json()
            address = payload.get("address") or {}
            label = str(payload.get("display_name", "")).strip()
            if label:
                details["label"] = label[:255]
            details["country"] = address.get("country")
            details["country_code"] = (address.get("country_code") or "").upper() or None
            details["region"] = address.get("state") or address.get("region")
            details["county"] = address.get("county") or address.get("state_district")
            details["nearest_place"] = (
                address.get("city")
                or address.get("town")
                or address.get("village")
                or address.get("municipality")
                or address.get("hamlet")
                or address.get("county")
            )
            details["suburb"] = address.get("suburb") or address.get("neighbourhood")
            details["road"] = address.get("road")
    except (httpx.HTTPError, ValueError, AttributeError) as exc:
        logger.info("Reverse geocoding details failed, using coordinate label: %s", exc)

    _set_cache(key, details)
    return details
