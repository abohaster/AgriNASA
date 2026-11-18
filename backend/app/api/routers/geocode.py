"""
Location search endpoints (OpenStreetMap Nominatim proxy).

The map UI needs place search and reverse geocoding. Proxying through the backend
keeps the required User-Agent/usage policy in one place and avoids browser CORS
problems. These endpoints do not touch NASA data.
"""

from fastapi import APIRouter, Query

from app.schemas.fields import GeocodeResult, ReverseGeocodeResult
from app.services import geocoding

router = APIRouter(prefix="/geocode", tags=["geocode"])


@router.get("/search", response_model=list[GeocodeResult])
def search(
    q: str = Query(min_length=2, max_length=200, description="Place name or address"),
) -> list[GeocodeResult]:
    return geocoding.search_places(q)


@router.get("/reverse", response_model=ReverseGeocodeResult)
def reverse(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
) -> ReverseGeocodeResult:
    return geocoding.reverse_place(lat, lon)
