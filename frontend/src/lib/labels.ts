import type {
  ConfidenceLevel,
  DataNature,
  DemandLevel,
  EnvironmentVariable,
  HealthStatus,
  IndicatorStatus,
} from "../api/types";

/** Display metadata + colours for environmental variables (charts and cards). */
export const VARIABLE_META: Record<
  EnvironmentVariable,
  { label: string; short: string; unit: string; decimals: number; color: string }
> = {
  t2m_mean_c: { label: "Mean air temperature", short: "Temperature", unit: "°C", decimals: 1, color: "#b4693a" },
  t2m_max_c: { label: "Maximum temperature", short: "T max", unit: "°C", decimals: 1, color: "#c25d3f" },
  t2m_min_c: { label: "Minimum temperature", short: "T min", unit: "°C", decimals: 1, color: "#d09a7a" },
  rh_mean_pct: { label: "Relative humidity", short: "Humidity", unit: "%", decimals: 0, color: "#3c7a63" },
  precipitation_mm: { label: "Precipitation", short: "Rainfall", unit: "mm", decimals: 1, color: "#2f6f8f" },
  wind_speed_2m_ms: { label: "Wind speed (2 m)", short: "Wind", unit: "m/s", decimals: 1, color: "#6b7f76" },
  solar_radiation_mj_m2_day: {
    label: "Solar radiation",
    short: "Radiation",
    unit: "MJ/m²/day",
    decimals: 1,
    color: "#b58a2f",
  },
  pressure_kpa: { label: "Atmospheric pressure", short: "Pressure", unit: "kPa", decimals: 2, color: "#7a6f61" },
  soil_moisture_root_fraction: {
    label: "Root-zone soil wetness",
    short: "Soil wetness",
    unit: "fraction",
    decimals: 2,
    color: "#6d5a43",
  },
  et0_mm_day: { label: "Reference evapotranspiration", short: "ET₀", unit: "mm/day", decimals: 2, color: "#8a4b32" },
};

export const NATURE_LABELS: Record<DataNature, string> = {
  satellite_observation: "Satellite observation",
  reanalysis: "Reanalysis (model)",
  assimilated: "Assimilated product",
  estimated: "Estimated",
  derived: "Derived value",
  calculated: "Calculated",
  measured: "Measured on site",
  optional: "Optional interface",
};

export const NATURE_TONE: Record<DataNature, "good" | "info" | "neutral" | "warn"> = {
  satellite_observation: "good",
  reanalysis: "info",
  assimilated: "info",
  estimated: "warn",
  derived: "neutral",
  calculated: "neutral",
  measured: "good",
  optional: "warn",
};

export const DEMAND_META: Record<
  DemandLevel,
  { label: string; tone: "good" | "warn" | "bad" | "neutral"; description: string }
> = {
  low: {
    label: "Low",
    tone: "good",
    description: "Root-zone moisture is adequate for the current crop stage.",
  },
  moderate: {
    label: "Moderate",
    tone: "warn",
    description: "Depletion is approaching the readily available water limit.",
  },
  high: {
    label: "High",
    tone: "bad",
    description: "Depletion has crossed the management threshold; irrigation should be planned.",
  },
  unknown: {
    label: "Unknown",
    tone: "neutral",
    description: "There is not enough data for a reliable demand class.",
  },
};

export const CONFIDENCE_META: Record<
  ConfidenceLevel,
  { label: string; tone: "good" | "warn" | "bad" }
> = {
  high: { label: "High confidence", tone: "good" },
  medium: { label: "Medium confidence", tone: "warn" },
  low: { label: "Low confidence", tone: "bad" },
};

export const HEALTH_META: Record<
  HealthStatus,
  { label: string; tone: "good" | "warn" | "bad" | "neutral"; description: string }
> = {
  good: {
    label: "Good",
    tone: "good",
    description: "Environmental indicators are within typical ranges for this growth stage.",
  },
  moderate: {
    label: "Moderate",
    tone: "warn",
    description: "One or more indicators are outside the preferred range; monitor closely.",
  },
  stressed: {
    label: "Stressed",
    tone: "bad",
    description: "Indicators suggest meaningful heat or water stress. Agronomic review is advised.",
  },
  insufficient_data: {
    label: "Insufficient data",
    tone: "neutral",
    description: "The available inputs cannot support a defensible stress assessment.",
  },
};

export const INDICATOR_TONE: Record<IndicatorStatus, "good" | "warn" | "bad" | "neutral"> = {
  good: "good",
  watch: "warn",
  stress: "bad",
  unknown: "neutral",
};

export const SOIL_TEXTURES: { value: string; label: string; fieldCapacity: number; wiltingPoint: number }[] = [
  { value: "sand", label: "Sand", fieldCapacity: 0.12, wiltingPoint: 0.05 },
  { value: "loamy_sand", label: "Loamy sand", fieldCapacity: 0.17, wiltingPoint: 0.07 },
  { value: "sandy_loam", label: "Sandy loam", fieldCapacity: 0.23, wiltingPoint: 0.1 },
  { value: "loam", label: "Loam", fieldCapacity: 0.29, wiltingPoint: 0.14 },
  { value: "silt_loam", label: "Silt loam", fieldCapacity: 0.33, wiltingPoint: 0.16 },
  { value: "clay_loam", label: "Clay loam", fieldCapacity: 0.36, wiltingPoint: 0.2 },
  { value: "clay", label: "Clay", fieldCapacity: 0.4, wiltingPoint: 0.24 },
];

export const IRRIGATION_SYSTEMS: { value: string; label: string; efficiency: number }[] = [
  { value: "drip", label: "Drip", efficiency: 0.9 },
  { value: "sprinkler", label: "Sprinkler", efficiency: 0.75 },
  { value: "surface", label: "Surface / furrow", efficiency: 0.6 },
  { value: "none", label: "Rainfed (no irrigation)", efficiency: 0 },
];

export const CROPS: { value: string; label: string; note: string }[] = [
  {
    value: "wheat",
    label: "Wheat",
    note: "FAO-56 wheat curve: 150-day season, Kc 0.40 → 1.15 → 0.30, roots 0.15–1.50 m, depletion fraction 0.55.",
  },
  {
    value: "potato",
    label: "Potato",
    note: "FAO-56 potato curve: 120-day season, Kc 0.50 → 1.15 → 0.75, tuber planting, shallow roots (0.15–0.50 m).",
  },
  {
    value: "tomato",
    label: "Tomato",
    note: "FAO-56 tomato curve: 140-day season, Kc 0.60 → 1.15 → 0.80, transplanting, deeper roots (0.15–1.00 m).",
  },
];
