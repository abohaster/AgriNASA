"""
Data source catalogue — the single source of truth for provenance text.

Every API response and the /api/data-sources endpoint read from these entries,
so the nature of a dataset (reanalysis vs satellite) cannot drift between UI
surfaces. Nothing here claims a measurement that the dataset does not provide.
"""

from typing import Any

NASA_POWER = {
    "id": "nasa-power-daily",
    "name": "NASA POWER · daily point",
    "nature": "reanalysis",
    "resolution": "0.5° × 0.625° · daily",
    "attribution": "NASA POWER (MERRA-2 reanalysis), community AG",
    "url": "https://power.larc.nasa.gov/",
    "description": (
        "Daily climate variables interpolated to a point. Most values are model-derived "
        "MERRA-2 reanalysis, not on-farm sensors. A 0.5° cell spans tens of kilometres."
    ),
}

NASA_POWER_CLIMATOLOGY = {
    "id": "nasa-power-climatology",
    "name": "NASA POWER · climatology",
    "nature": "reanalysis",
    "resolution": "0.5° × 0.625° · monthly normals",
    "attribution": "NASA POWER climatology (1991–2020 baseline)",
    "url": "https://power.larc.nasa.gov/docs/services/api/",
    "description": "Long-term monthly normals used only to contextualise recent rainfall.",
}

NASA_GIBS = {
    "id": "nasa-gibs",
    "name": "NASA GIBS",
    "nature": "satellite_observation",
    "resolution": "Tile-dependent (MODIS/VIIRS layers)",
    "attribution": "NASA Global Imagery Browse Services",
    "url": "https://gibs.earthdata.nasa.gov/",
    "description": "Satellite imagery tiles rendered in the browser. Visual context only; no values are read from the imagery.",
}

NASA_NDVI = {
    "id": "gee-ndvi",
    "name": "NDVI / NDMI · Google Earth Engine Sentinel-2",
    "nature": "satellite_observation",
    "resolution": "10 m · most recent usable Sentinel-2 pass",
    "attribution": "Copernicus Sentinel-2 surface reflectance via Google Earth Engine",
    "url": "https://earthengine.google.com/",
    "description": (
        "Reduced server-side over the field geometry by the same Earth Engine service used on the "
        "Satellite tab. Reported as unavailable when Earth Engine is not configured; no values are "
        "invented or substituted."
    ),
}

OPEN_METEO_FORECAST = {
    "id": "open-meteo-forecast",
    "name": "Open-Meteo · daily forecast",
    "nature": "estimated",
    "resolution": "Point forecast · daily · ~1–11 km model grid",
    "attribution": "Open-Meteo numerical weather forecast (CC BY 4.0)",
    "url": "https://open-meteo.com/",
    "description": (
        "Short-term forecast used by the simplified farmer guide. NASA POWER has no forecast "
        "product; when Open-Meteo is unreachable the forecast is reported as unavailable."
    ),
}

DERIVED_FROM_POWER = {
    "id": "derived-power",
    "name": "FAO-56 calculation",
    "nature": "calculated",
    "resolution": "Same as input series · daily",
    "attribution": "Computed by AgriNASA from NASA POWER inputs (FAO Irrigation & Drainage Paper 56)",
    "url": "https://www.fao.org/4/x0490e/x0490e00.htm",
    "description": "ET₀, ETc, root-zone water balance and demand classes are deterministic outputs, not measurements.",
}

OPEN_METEO_CURRENT = {
    "id": "open-meteo-current",
    "name": "Open-Meteo · current conditions",
    "nature": "estimated",
    "resolution": "Point model analysis · ~1-11 km grid",
    "attribution": "Open-Meteo current weather (CC BY 4.0), derived from national weather models",
    "url": "https://open-meteo.com/",
    "description": (
        "Latest model analysis and forecast step for the selected point. Not a weather-station "
        "reading; the observation/model time is shown with every value."
    ),
}

OPEN_METEO_ARCHIVE = {
    "id": "open-meteo-archive",
    "name": "Open-Meteo · historical archive",
    "nature": "reanalysis",
    "resolution": "~9-25 km · daily/hourly (ERA5, ERA5-Land)",
    "attribution": "Open-Meteo Historical Weather API, ERA5/ERA5-Land reanalysis (CC BY 4.0)",
    "url": "https://open-meteo.com/en/docs/historical-weather-api",
    "description": (
        "Historical daily and hourly weather for the point. ERA5 is a reanalysis, not a station "
        "record; the archive lags real time by roughly 2-7 days."
    ),
}

SOILGRIDS = {
    "id": "soilgrids",
    "name": "ISRIC SoilGrids 2.0",
    "nature": "estimated",
    "resolution": "250 m · modelled soil properties",
    "attribution": "ISRIC World Soil Information, SoilGrids 2.0 (CC BY 4.0)",
    "url": "https://soilgrids.org/",
    "description": (
        "Global machine-learning prediction of pH, organic carbon, texture and related "
        "properties. It is modelled soil information, not a laboratory soil test."
    ),
}

GEE_EVI = {
    "id": "gee-evi",
    "name": "EVI · Sentinel-2 via Earth Engine",
    "nature": "satellite_observation",
    "resolution": "10 m · latest cloud-free composite",
    "attribution": "Copernicus Sentinel-2 surface reflectance via Google Earth Engine",
    "url": "https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED",
    "description": "Enhanced Vegetation Index computed server-side; an area mean, not a ground measurement.",
}

GEE_LANDCOVER = {
    "id": "gee-landcover",
    "name": "Land cover · Dynamic World",
    "nature": "estimated",
    "resolution": "10 m · per-pixel classification",
    "attribution": "Google Dynamic World near-real-time land cover (CC BY 4.0)",
    "url": "https://dynamicworld.app/",
    "description": "Dominant land-cover class over the area from a near-real-time classifier; probabilities are not averaged.",
}

GEE_SMAP = {
    "id": "gee-smap",
    "name": "Soil moisture · NASA SMAP",
    "nature": "satellite_observation",
    "resolution": "~9-11 km · surface (~0-5 cm)",
    "attribution": "NASA SMAP L4 via Google Earth Engine",
    "url": "https://developers.google.com/earth-engine/datasets/catalog/NASA_SMAP_SPL4SMGP_007",
    "description": "Satellite surface soil moisture, not a probe reading at root depth.",
}

GEE_IMERG = {
    "id": "gee-imerg",
    "name": "Rainfall · NASA GPM IMERG",
    "nature": "satellite_observation",
    "resolution": "~0.1° · monthly",
    "attribution": "NASA GPM IMERG monthly via Google Earth Engine",
    "url": "https://gpm.nasa.gov/data/imerg",
    "description": "Satellite precipitation estimate; a rain gauge remains the local reference.",
}

ROBOT_SOIL_MOISTURE = {
    "id": "robot-soil-moisture",
    "name": "AgriNASA robot · soil moisture probe",
    "nature": "measured",
    "resolution": "Point measurement · one sensor location and depth",
    "attribution": "Field-level sensor data collected directly by the AgriNASA robot",
    "url": None,
    "description": (
        "Field-level sensor data collected directly by the AgriNASA robot. Each reading "
        "carries a timestamp, sensor id, device, GPS position and status. One probe is a "
        "point measurement, not a whole-field average."
    ),
}

ROBOT_CAMERA = {
    "id": "robot-camera",
    "name": "AgriNASA robot · plant camera",
    "nature": "measured",
    "resolution": "Plant-level image · one camera position per capture",
    "attribution": "Field-level sensor/camera data collected directly by the AgriNASA robot",
    "url": None,
    "description": (
        "Field-level sensor/camera data collected directly by the AgriNASA robot. The "
        "image is a real observation; the AI vision review is an advisory visual "
        "assessment with a confidence value, not a confirmed diagnosis."
    ),
}

CROP_REFERENCE = {
    "id": "crop-reference",
    "name": "Crop agronomic references",
    "nature": "calculated",
    "resolution": "Per crop · reference ranges",
    "attribution": "FAO-56 crop coefficients and Egyptian extension calendars",
    "url": "https://www.fao.org/4/x0490e/x0490e00.htm",
    "description": "Reference temperature, pH, texture and water ranges used for screening; not variety-specific.",
}

DERIVED_SUITABILITY = {
    "id": "derived-suitability",
    "name": "Crop suitability screening",
    "nature": "calculated",
    "resolution": "Deterministic score from retrieved inputs",
    "attribution": "Computed by AgriNASA from SoilGrids, Open-Meteo history and crop references",
    "url": "https://www.fao.org/4/x0490e/x0490e00.htm",
    "description": "A transparent screening indicator with per-factor reasons; not a yield prediction.",
}

WAPOR = {
    "id": "wapor",
    "name": "FAO WaPOR",
    "nature": "optional",
    "resolution": "100-250 m · ET and water productivity",
    "attribution": "FAO WaPOR 3.0 (registration and API token required)",
    "url": "https://data.apps.fao.org/wapor",
    "description": "Not enabled by default. WaPOR requires a personal FAO API token; configure WAPOR_TOKEN to enable.",
}

SOURCE_CATALOGUE: list[dict[str, Any]] = [
    NASA_POWER,
    NASA_POWER_CLIMATOLOGY,
    DERIVED_FROM_POWER,
    NASA_GIBS,
    NASA_NDVI,
    OPEN_METEO_FORECAST,
    OPEN_METEO_CURRENT,
    OPEN_METEO_ARCHIVE,
    SOILGRIDS,
    GEE_EVI,
    GEE_LANDCOVER,
    GEE_SMAP,
    GEE_IMERG,
    ROBOT_SOIL_MOISTURE,
    ROBOT_CAMERA,
    CROP_REFERENCE,
    DERIVED_SUITABILITY,
    WAPOR,
]

SOURCE_BY_ID = {source["id"]: source for source in SOURCE_CATALOGUE}


def source_ref(source_id: str) -> dict[str, Any]:
    """Return the public subset of a source entry (no description)."""
    source = SOURCE_BY_ID[source_id]
    return {
        "id": source["id"],
        "name": source["name"],
        "nature": source["nature"],
        "resolution": source["resolution"],
        "attribution": source["attribution"],
        "url": source["url"],
    }


GLOBAL_LIMITATIONS = [
    "NASA POWER values are reanalysis/model-derived and spatially coarse (~50 km); they are not on-farm measurements.",
    "Robot soil moisture is a measured point reading at one location and depth, not a whole-field average.",
    "Irrigation output is a decision-support estimate, not a validated prescription or applied volume.",
    "The crop-health module reports environmental stress indicators only. AI image review is an advisory visual assessment, not a confirmed diagnosis.",
]
