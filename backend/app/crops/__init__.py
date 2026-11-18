"""Crop registry package: importing registers the built-in crops."""

from app.crops.base import (
    CropProfile,
    StageSpec,
    VegetationExpectation,
    get_crop,
    list_crops,
    register_crop,
)
from app.crops.calendar import CropCalendar, get_calendar, list_calendars
from app.crops import wheat  # noqa: F401 — registers the wheat profile on import
from app.crops import potato  # noqa: F401 — registers the potato profile on import
from app.crops import tomato  # noqa: F401 — registers the tomato profile on import

__all__ = [
    "CropProfile",
    "StageSpec",
    "VegetationExpectation",
    "CropCalendar",
    "get_crop",
    "get_calendar",
    "list_crops",
    "list_calendars",
    "register_crop",
]
