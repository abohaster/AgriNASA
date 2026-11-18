"""
Planting calendar for the simplified farmer guide.

This is deliberately separate from `app.crops.base.CropProfile`: the FAO-56
profile drives the root-zone water balance, while this calendar only answers a
plain question — "is this a reasonable month to plant this crop in Egypt, and
what daily mean temperature does it prefer?".

Every entry is a *regional default* from Egyptian extension guidance for the
Nile Valley and Delta, not a measurement for a specific field. Local varieties,
altitude and microclimate shift the windows by weeks, and the API repeats that
caveat so the simple page never implies a guarantee.

Months are 1-based calendar months (1 = January). `temperature_*_c` refer to the
daily mean air temperature; `heat_threshold_c` and `frost_threshold_c` are the
levels at which the simplified advice raises a heat or frost warning.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CropCalendar:
    id: str
    name: str
    ideal_planting_months: tuple[int, ...]
    acceptable_planting_months: tuple[int, ...]
    optimal_temp_min_c: float
    optimal_temp_max_c: float
    heat_threshold_c: float
    frost_threshold_c: float
    season_days: int
    # Days from sowing to visible seedling emergence, and the usual sowing depth.
    # Both are regional defaults for extension advice, not measurements.
    emergence_days_min: int
    emergence_days_max: int
    seed_depth_cm_min: float
    seed_depth_cm_max: float
    note: str
    # How the crop enters the field: "seed", "tuber" (potato sets) or
    # "transplant" (nursery seedlings). The farmer timeline uses this to show
    # sowing, tuber-planting or transplanting advice instead of generic sowing.
    establishment: str = "seed"

    @property
    def all_planting_months(self) -> tuple[int, ...]:
        return tuple(sorted(set(self.ideal_planting_months) | set(self.acceptable_planting_months)))


# Nile Valley / Delta defaults. Sources: Egyptian Ministry of Agriculture
# extension calendars and FAO-56 crop temperature ranges, rounded for advice.
_CALENDARS: tuple[CropCalendar, ...] = (
    CropCalendar(
        id="wheat",
        name="Wheat",
        ideal_planting_months=(11,),
        acceptable_planting_months=(10, 12),
        optimal_temp_min_c=10.0,
        optimal_temp_max_c=25.0,
        heat_threshold_c=30.0,
        frost_threshold_c=0.0,
        season_days=150,
        emergence_days_min=5,
        emergence_days_max=10,
        seed_depth_cm_min=3.0,
        seed_depth_cm_max=5.0,
        note="Winter wheat is normally sown in November and harvested in April–May.",
    ),
    CropCalendar(
        id="maize",
        name="Maize",
        ideal_planting_months=(5, 6),
        acceptable_planting_months=(4, 7),
        optimal_temp_min_c=18.0,
        optimal_temp_max_c=32.0,
        heat_threshold_c=38.0,
        frost_threshold_c=5.0,
        season_days=110,
        emergence_days_min=5,
        emergence_days_max=10,
        seed_depth_cm_min=4.0,
        seed_depth_cm_max=6.0,
        note="Summer maize is normally sown in May–June after the winter crop.",
    ),
    CropCalendar(
        id="tomato",
        name="Tomato",
        ideal_planting_months=(8, 9),
        acceptable_planting_months=(2, 3, 10),
        optimal_temp_min_c=15.0,
        optimal_temp_max_c=30.0,
        heat_threshold_c=35.0,
        frost_threshold_c=2.0,
        season_days=140,
        # Transplanted crop: depth refers to the nursery bed / transplant hole.
        emergence_days_min=7,
        emergence_days_max=14,
        seed_depth_cm_min=1.0,
        seed_depth_cm_max=2.0,
        note="The main (winter) tomato crop is transplanted in August–September.",
        establishment="transplant",
    ),
    CropCalendar(
        id="potato",
        name="Potato",
        ideal_planting_months=(10, 11),
        acceptable_planting_months=(9, 12, 1),
        optimal_temp_min_c=10.0,
        optimal_temp_max_c=25.0,
        heat_threshold_c=32.0,
        frost_threshold_c=0.0,
        season_days=120,
        emergence_days_min=14,
        emergence_days_max=21,
        seed_depth_cm_min=8.0,
        seed_depth_cm_max=12.0,
        note="The winter (Nili) potato crop is planted in October–November.",
        establishment="tuber",
    ),
    CropCalendar(
        id="clover",
        name="Egyptian clover (berseem)",
        ideal_planting_months=(9, 10),
        acceptable_planting_months=(8, 11),
        optimal_temp_min_c=10.0,
        optimal_temp_max_c=25.0,
        heat_threshold_c=33.0,
        frost_threshold_c=-2.0,
        season_days=180,
        emergence_days_min=5,
        emergence_days_max=10,
        seed_depth_cm_min=1.0,
        seed_depth_cm_max=2.0,
        note="Berseem is normally sown in September–October and cut through winter.",
    ),
    CropCalendar(
        id="sugarcane",
        name="Sugarcane",
        ideal_planting_months=(2, 3, 4),
        acceptable_planting_months=(1, 8, 9),
        optimal_temp_min_c=20.0,
        optimal_temp_max_c=36.0,
        heat_threshold_c=40.0,
        frost_threshold_c=5.0,
        season_days=365,
        emergence_days_min=15,
        emergence_days_max=30,
        seed_depth_cm_min=10.0,
        seed_depth_cm_max=15.0,
        note="Planting cane is normally established in February–April and stays a full year.",
    ),
    CropCalendar(
        id="cotton",
        name="Cotton",
        ideal_planting_months=(3, 4),
        acceptable_planting_months=(2, 5),
        optimal_temp_min_c=20.0,
        optimal_temp_max_c=35.0,
        heat_threshold_c=40.0,
        frost_threshold_c=5.0,
        season_days=180,
        emergence_days_min=5,
        emergence_days_max=12,
        seed_depth_cm_min=2.0,
        seed_depth_cm_max=4.0,
        note="Cotton is normally sown in March–April and picked in autumn.",
    ),
    CropCalendar(
        id="rice",
        name="Rice",
        ideal_planting_months=(5, 6),
        acceptable_planting_months=(4, 7),
        optimal_temp_min_c=20.0,
        optimal_temp_max_c=35.0,
        heat_threshold_c=38.0,
        frost_threshold_c=8.0,
        season_days=120,
        # Transplanted crop: depth refers to the nursery bed.
        emergence_days_min=15,
        emergence_days_max=25,
        seed_depth_cm_min=1.0,
        seed_depth_cm_max=2.0,
        note="Rice is transplanted in May–June in the Delta and Fayoum.",
        establishment="transplant",
    ),
)

CALENDAR_BY_ID: dict[str, CropCalendar] = {crop.id: crop for crop in _CALENDARS}


def get_calendar(crop_id: str) -> CropCalendar | None:
    return CALENDAR_BY_ID.get(crop_id.strip().lower())


def list_calendars() -> tuple[CropCalendar, ...]:
    return _CALENDARS


def supported_crop_ids() -> list[str]:
    return [crop.id for crop in _CALENDARS]
