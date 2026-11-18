"""Reference agronomic requirements for the supported crops.

These are regional/FAO-56 reference ranges used for *screening* a location.
They are not variety-specific recommendations and do not predict yield. The
suitability engine combines them with retrieved climate and soil values and
states every assumption in the response.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CropRequirements:
    crop_id: str
    ph_min: float
    ph_max: float
    preferred_textures: tuple[str, ...]
    tolerable_textures: tuple[str, ...]
    kc_mid: float
    season_water_min_mm: float
    season_water_max_mm: float
    salinity_tolerance: str
    drainage_note: str
    note: str
    source: str = "FAO-56 crop coefficients; Egyptian extension calendars for planting windows"


_REQUIREMENTS: tuple[CropRequirements, ...] = (
    CropRequirements(
        crop_id="wheat",
        ph_min=5.5,
        ph_max=7.5,
        preferred_textures=("loam", "silt loam", "clay loam"),
        tolerable_textures=("sandy loam", "silty clay loam", "clay"),
        kc_mid=1.15,
        season_water_min_mm=450,
        season_water_max_mm=650,
        salinity_tolerance="moderate",
        drainage_note="Avoid waterlogged soils; wheat tolerates short wet spells but not standing water.",
        note="Winter cereal; November sowing is the regional default.",
    ),
    CropRequirements(
        crop_id="maize",
        ph_min=5.8,
        ph_max=7.0,
        preferred_textures=("loam", "silt loam", "sandy loam"),
        tolerable_textures=("clay loam", "sandy clay loam"),
        kc_mid=1.2,
        season_water_min_mm=500,
        season_water_max_mm=800,
        salinity_tolerance="low",
        drainage_note="Sensitive to waterlogging and salinity; good drainage matters.",
        note="Summer cereal sown May-June.",
    ),
    CropRequirements(
        crop_id="tomato",
        ph_min=5.5,
        ph_max=7.5,
        preferred_textures=("loam", "sandy loam", "silt loam"),
        tolerable_textures=("clay loam", "sandy clay loam"),
        kc_mid=1.15,
        season_water_min_mm=400,
        season_water_max_mm=600,
        salinity_tolerance="moderate",
        drainage_note="Drip or furrow with good drainage; avoid heavy clay that stays saturated.",
        note="Usually transplanted; winter crop transplanted August-September.",
    ),
    CropRequirements(
        crop_id="potato",
        ph_min=5.0,
        ph_max=6.5,
        preferred_textures=("sandy loam", "loam", "silt loam"),
        tolerable_textures=("loamy sand", "clay loam"),
        kc_mid=1.15,
        season_water_min_mm=500,
        season_water_max_mm=700,
        salinity_tolerance="low",
        drainage_note="Loose, well-drained soil is important for tuber shape and harvest.",
        note="Winter (Nili) crop planted October-November.",
    ),
    CropRequirements(
        crop_id="clover",
        ph_min=6.0,
        ph_max=8.0,
        preferred_textures=("loam", "clay loam", "silt loam"),
        tolerable_textures=("clay", "silty clay loam"),
        kc_mid=1.05,
        season_water_min_mm=800,
        season_water_max_mm=1200,
        salinity_tolerance="moderate",
        drainage_note="Tolerates heavier soils but not prolonged waterlogging.",
        note="Berseem is cut repeatedly through winter.",
    ),
    CropRequirements(
        crop_id="sugarcane",
        ph_min=6.0,
        ph_max=8.0,
        preferred_textures=("loam", "clay loam", "silt loam"),
        tolerable_textures=("clay", "silty clay loam"),
        kc_mid=1.25,
        season_water_min_mm=1500,
        season_water_max_mm=2500,
        salinity_tolerance="moderate",
        drainage_note="Very high water demand; reliable irrigation is essential.",
        note="A full-year crop; only viable with secure water supply.",
    ),
    CropRequirements(
        crop_id="cotton",
        ph_min=6.0,
        ph_max=8.0,
        preferred_textures=("loam", "clay loam", "sandy loam"),
        tolerable_textures=("silty clay loam", "clay"),
        kc_mid=1.18,
        season_water_min_mm=700,
        season_water_max_mm=1300,
        salinity_tolerance="high",
        drainage_note="Tolerates moderate salinity; avoid poorly drained heavy clay.",
        note="Sown March-April; picked in autumn.",
    ),
    CropRequirements(
        crop_id="rice",
        ph_min=5.5,
        ph_max=6.5,
        preferred_textures=("clay", "clay loam", "silt loam"),
        tolerable_textures=("silty clay loam", "loam"),
        kc_mid=1.1,
        season_water_min_mm=900,
        season_water_max_mm=1500,
        salinity_tolerance="low",
        drainage_note="Paddy systems need level fields and reliable flooding water.",
        note="Transplanted May-June in the Delta and Fayoum.",
    ),
)

REQUIREMENTS_BY_ID = {entry.crop_id: entry for entry in _REQUIREMENTS}


def get_requirements(crop_id: str) -> CropRequirements | None:
    return REQUIREMENTS_BY_ID.get(crop_id.strip().lower())
