/**
 * Plain-language explanations for every dataset the app actually reads.
 *
 * The source name, nature, resolution and attribution come from
 * GET /api/data-sources (backend/app/data_catalog.py). This file only adds
 * coverage, meaning and the three audience benefits; ids must match the backend
 * catalogue so a card can never describe a dataset that is not implemented.
 */

export type Reliability = "measured" | "satellite" | "modeled" | "forecast";

export interface DataSourceContent {
  id: string;
  /** Variables this dataset contributes to the interface. */
  variables: string[];
  /** Known temporal coverage of the product. */
  coverage: string;
  whatItIs: string;
  simpleFarmer: string;
  farmManager: string;
  agronomist: string;
  /** false for an interface that exists in code but is not enabled by default. */
  enabled?: boolean;
}

export const RELIABILITY_LABELS: Record<Reliability, string> = {
  measured: "Measured",
  satellite: "Satellite-derived",
  modeled: "Modeled / estimated",
  forecast: "Forecast",
};

export const RELIABILITY_DEFINITIONS: Record<Reliability, string> = {
  measured: "Directly measured by an instrument or a weather station.",
  satellite: "Calculated or observed from satellite data.",
  modeled:
    "Produced by scientific models, reanalysis or interpolation — not a measurement at the field.",
  forecast: "A prediction of conditions that have not happened yet.",
};

export const RELIABILITY_BY_SOURCE: Record<string, Reliability> = {
  "nasa-power-daily": "modeled",
  "nasa-power-climatology": "modeled",
  "derived-power": "modeled",
  "nasa-gibs": "satellite",
  "gee-ndvi": "satellite",
  "open-meteo-forecast": "forecast",
  "open-meteo-current": "modeled",
  "open-meteo-archive": "modeled",
  soilgrids: "modeled",
  "gee-evi": "satellite",
  "gee-landcover": "modeled",
  "gee-smap": "satellite",
  "gee-imerg": "satellite",
  "crop-reference": "modeled",
  "derived-suitability": "modeled",
  wapor: "modeled",
};

export const SOURCE_CONTENT: DataSourceContent[] = [
  {
    id: "nasa-power-daily",
    variables: [
      "Temperature (mean, max, min)",
      "Relative humidity",
      "Rainfall",
      "Wind speed at 2 m",
      "Solar radiation",
      "Atmospheric pressure",
      "Root-zone soil wetness",
    ],
    coverage: "1981 → present · daily · published with a short delay",
    whatItIs:
      "Daily weather for the grid cell around the field, built from NASA's MERRA-2 reanalysis and interpolated to the point.",
    simpleFarmer:
      "Tells you whether it is hot or cold and whether rain fell, so you can plan work in the field.",
    farmManager:
      "Helps plan irrigation and spraying, follow rainfall and heat spells, and compare one period with another.",
    agronomist:
      "Supplies the weather inputs for FAO-56 ET₀, the root-zone water balance and crop-stress indicators, with a disclosed coarse-grid resolution.",
  },
  {
    id: "nasa-power-climatology",
    variables: ["Long-term monthly rainfall normals (1991-2020)"],
    coverage: "1991-2020 monthly normals",
    whatItIs:
      "Thirty-year monthly averages used as the normal when recent rainfall is compared with the past.",
    simpleFarmer: "Tells you whether this year's rain is more or less than usual.",
    farmManager:
      "Adds seasonal context: whether recent rain is normal, dry or wet for this month.",
    agronomist:
      "Used for the 30-day rainfall anomaly. It is a climatological baseline, not a forecast for this season.",
  },
  {
    id: "derived-power",
    variables: [
      "Reference evapotranspiration (ET₀)",
      "Crop evapotranspiration (ETc)",
      "Root-zone water balance",
      "Irrigation demand class",
      "Root-zone refill estimate",
    ],
    coverage: "Same dates as the input NASA POWER series",
    whatItIs:
      "FAO-56 calculations run by AgriNASA on top of the NASA POWER weather; the numbers are deterministic, not measured.",
    simpleFarmer: "Tells you whether the field needs irrigation, and roughly how much.",
    farmManager:
      "Gives a demand class and a refill estimate to organise irrigation while reducing unnecessary water use.",
    agronomist:
      "Penman-Monteith ET₀, stage-based Kc, ETc and a daily bucket model with documented thresholds, assumptions and missing-input rules.",
  },
  {
    id: "nasa-gibs",
    variables: ["Satellite imagery tiles (visual context)"],
    coverage: "MODIS/VIIRS imagery · 2000 → present (layer dependent)",
    whatItIs: "NASA satellite imagery shown behind the map as visual context.",
    simpleFarmer: "Photos from space help you see the field, but no numbers are read from them.",
    farmManager: "Visual context for locating the field and comparing nearby areas.",
    agronomist: "Imagery tiles only; no values are sampled from the pixels.",
  },
  {
    id: "gee-ndvi",
    variables: ["NDVI", "NDMI"],
    coverage: "Sentinel-2 · June 2015 → present · cloud-free passes",
    whatItIs:
      "Satellite vegetation and canopy-moisture indices reduced over the field outline.",
    simpleFarmer: "Tells you whether the plants are green and healthy or under stress.",
    farmManager:
      "Shows whether the canopy is healthy and whether stress is developing across the field.",
    agronomist:
      "10 m Sentinel-2 surface-reflectance indices reduced over the field geometry, cloud-screened, with acquisition date and scene count.",
  },
  {
    id: "open-meteo-forecast",
    variables: [
      "Daily maximum and minimum temperature",
      "Expected rain",
      "Maximum wind",
      "Short weather outlook",
    ],
    coverage: "Forecast · up to about 7 days ahead",
    whatItIs: "A short-term weather forecast for the field point.",
    simpleFarmer: "Tells you what the weather will be like in the coming days and whether rain is expected.",
    farmManager:
      "Helps time irrigation, spraying and field work around expected rain, heat, wind or frost.",
    agronomist:
      "Open-Meteo numerical forecast on a model grid. When it is unreachable the page says so; no values are substituted.",
  },
  {
    id: "open-meteo-current",
    variables: [
      "Current temperature and feels-like",
      "Humidity",
      "Precipitation (current step)",
      "Wind speed and direction",
      "Surface pressure",
      "Cloud cover",
      "Soil moisture (0-7 cm, model)",
      "Soil temperature (6 cm, model)",
      "Reference ET₀ today",
      "Solar radiation today",
    ],
    coverage: "Current model analysis · updated hourly",
    whatItIs: "The latest model conditions for the selected point.",
    simpleFarmer: "Tells you the weather at the place you chose right now.",
    farmManager: "Immediate conditions for field visits, spraying and irrigation decisions.",
    agronomist:
      "ERA5-Land and model-analysis values. Every reading states its observation/model time and is explicitly not a station reading.",
  },
  {
    id: "open-meteo-archive",
    variables: [
      "Daily temperature, rain, wind and solar radiation",
      "Reference ET₀",
      "Relative humidity",
      "Soil moisture (0-7 cm, model)",
      "Soil temperature (6 cm, model)",
      "Monthly and yearly summaries",
      "Historical comparisons",
    ],
    coverage: "ERA5 / ERA5-Land archive · 1940 → about 5 days behind real time",
    whatItIs:
      "Long historical weather for the point, used for historical comparisons and crop-suitability screening.",
    simpleFarmer: "Tells you what the weather was like in past years.",
    farmManager: "Compares this season with previous years to plan water and crop timing.",
    agronomist:
      "ERA5 reanalysis with a documented lag; monthly and yearly aggregates report how many days are present.",
  },
  {
    id: "soilgrids",
    variables: [
      "Soil pH",
      "Organic carbon",
      "Clay, sand and silt fractions",
      "Bulk density",
      "Cation exchange capacity",
      "Total nitrogen",
      "Approximate texture class",
    ],
    coverage: "Static 250 m global prediction · no time dimension",
    whatItIs: "Modelled soil properties for the location, produced by ISRIC SoilGrids 2.0.",
    simpleFarmer: "Tells you whether the soil is clay or sandy and how acidic it is.",
    farmManager: "Supports soil and irrigation planning and choosing suitable crops.",
    agronomist:
      "Machine-learning prediction at 250 m, not a laboratory test. Depth layers, aggregation and fetch date are disclosed.",
  },
  {
    id: "gee-evi",
    variables: ["EVI"],
    coverage: "Sentinel-2 · June 2015 → present",
    whatItIs:
      "Enhanced Vegetation Index, a second canopy indicator that is less saturated than NDVI in dense crops.",
    simpleFarmer: "A second plant-health indicator that supports the NDVI picture.",
    farmManager: "Adds a second view of canopy vigour for dense crops.",
    agronomist:
      "10 m Sentinel-2 EVI composite; an area mean, not a ground measurement.",
  },
  {
    id: "gee-landcover",
    variables: ["Dominant land-cover class"],
    coverage: "Dynamic World near-real-time · June 2015 → present",
    whatItIs:
      "Land-cover class around the field: crops, trees, grass, built area, bare ground and similar classes.",
    simpleFarmer: "Tells you what is around the field: crops, buildings or bare land.",
    farmManager: "Context for interpreting satellite values and neighbouring land use.",
    agronomist:
      "Dynamic World per-pixel classification; the dominant class is reported without averaging probabilities.",
  },
  {
    id: "gee-smap",
    variables: ["Surface soil moisture (about 0-5 cm)"],
    coverage: "SMAP L4 · 2015 → present",
    whatItIs: "Satellite estimate of water in the top few centimetres of soil.",
    simpleFarmer: "Tells you whether the topsoil is wet or dry.",
    farmManager:
      "An early signal of surface dryness or wetness; deeper root-zone water comes from the water balance.",
    agronomist:
      "SMAP L4 at about 9-11 km. Surface layer only, not a probe at root depth.",
  },
  {
    id: "gee-imerg",
    variables: ["Monthly rainfall"],
    coverage: "GPM IMERG monthly · June 2000 → present",
    whatItIs: "Satellite rainfall totals for the area.",
    simpleFarmer: "Tells you how much rain the area received, seen from satellites.",
    farmManager: "Cross-checks rainfall between seasons and areas where gauges are sparse.",
    agronomist:
      "IMERG monthly estimate at about 0.1°. A rain gauge remains the local reference.",
  },
  {
    id: "crop-reference",
    variables: [
      "Temperature range",
      "Soil pH range",
      "Texture preference",
      "Season length",
      "Water reference range",
    ],
    coverage: "Static reference tables · FAO-56 and Egyptian extension calendars",
    whatItIs: "Agronomic reference ranges used to screen whether a crop fits the location.",
    simpleFarmer: "Tells you whether this crop suits your land and climate.",
    farmManager: "Guides crop choice and the planting window before land and water are committed.",
    agronomist:
      "Deterministic screening ranges. They are not variety-specific and are not a yield prediction.",
  },
  {
    id: "derived-suitability",
    variables: [
      "Suitability score",
      "Per-factor scores",
      "Risks",
      "Recommendations",
    ],
    coverage: "Calculated for the selected crop and location",
    whatItIs:
      "A transparent screening score built from soil, climate and crop references, with per-factor reasons.",
    simpleFarmer: "Adds the information together and tells you whether the crop is suitable or needs something.",
    farmManager: "Compares crops before committing land and water.",
    agronomist:
      "Every factor reports its source and score. It is a screening indicator, not a yield forecast.",
  },
  {
    id: "wapor",
    variables: ["Actual evapotranspiration", "Water productivity (not enabled)"],
    coverage: "FAO WaPOR 3.0 · requires a free FAO API token",
    whatItIs:
      "An optional FAO interface for evapotranspiration and water-productivity layers.",
    simpleFarmer: "An extra water service, not switched on yet.",
    farmManager: "Would add field-scale ET products when a token is configured.",
    agronomist:
      "Not connected by default. The app uses the Open-Meteo / NASA POWER water balance instead.",
    enabled: false,
  },
];
