/**
 * Shared API types. These mirror backend/app/schemas exactly.
 *
 * Keeping one hand-written types file (instead of generated code) makes the
 * data contract visible to a student reader. If the backend schema changes,
 * this file must change too — the TypeScript compiler is the safety net.
 */

export type DataMode = "live" | "demo";

/** How a dataset came to exist — displayed everywhere for scientific honesty. */
export type DataNature =
  | "satellite_observation"
  | "reanalysis"
  | "assimilated"
  | "estimated"
  | "derived"
  | "calculated"
  | "optional";

export interface DataSourceRef {
  id: string;
  name: string;
  nature: DataNature;
  resolution: string | null;
  attribution: string;
  url: string | null;
}

/** API errors always arrive in this envelope. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: string | null;
  };
}

export interface Field {
  id: number;
  name: string;
  crop_id: string;
  crop_name: string;
  planting_date: string;
  latitude: number;
  longitude: number;
  area_ha: number | null;
  soil_texture: string | null;
  irrigation_system: string | null;
  location_label: string | null;
  elevation_m: number | null;
  boundary_geojson: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface FieldCreate {
  name: string;
  latitude: number;
  longitude: number;
  crop_id: string;
  planting_date: string;
  area_ha?: number | null;
  soil_texture?: string | null;
  irrigation_system?: string | null;
  location_label?: string | null;
  elevation_m?: number | null;
  /** User-drawn GeoJSON Polygon; stored as drawn, never inferred from area. */
  boundary_geojson?: Record<string, unknown> | null;
}

export interface FieldUpdate {
  name?: string;
  planting_date?: string;
  area_ha?: number | null;
  soil_texture?: string | null;
  irrigation_system?: string | null;
  location_label?: string | null;
  boundary_geojson?: Record<string, unknown> | null;
}

/** Every variable the environment API can return, keyed consistently. */
export type EnvironmentVariable =
  | "t2m_mean_c"
  | "t2m_max_c"
  | "t2m_min_c"
  | "rh_mean_pct"
  | "precipitation_mm"
  | "wind_speed_2m_ms"
  | "solar_radiation_mj_m2_day"
  | "pressure_kpa"
  | "soil_moisture_root_fraction"
  | "et0_mm_day";

export interface EnvironmentSeriesPoint {
  date: string;
  t2m_mean_c: number | null;
  t2m_max_c: number | null;
  t2m_min_c: number | null;
  rh_mean_pct: number | null;
  precipitation_mm: number | null;
  wind_speed_2m_ms: number | null;
  solar_radiation_mj_m2_day: number | null;
  pressure_kpa: number | null;
  soil_moisture_root_fraction: number | null;
  et0_mm_day: number | null;
}

export interface TrendInfo {
  variable: EnvironmentVariable;
  label: string;
  unit: string;
  change: number | null;
  direction: "up" | "down" | "flat" | "unknown";
  window_days: number;
}

export interface EnvironmentSummary {
  days_returned: number;
  coverage_fraction: number;
  latest_date: string | null;
  latest: Partial<Record<EnvironmentVariable, number | null>>;
  /** Date each latest value belongs to (variables can update at different times). */
  latest_dates: Partial<Record<EnvironmentVariable, string | null>>;
  precipitation_total_mm: number | null;
  et0_total_mm: number | null;
  et0_mean_mm_day: number | null;
  trends: TrendInfo[];
  missing_variables: string[];
}

export interface EnvironmentResponse {
  field_id: number;
  start: string;
  end: string;
  source: DataSourceRef;
  is_demo: boolean;
  units: Record<string, string>;
  series: EnvironmentSeriesPoint[];
  summary: EnvironmentSummary;
  missing_variables: string[];
  limitations: string[];
}

export type DemandLevel = "low" | "moderate" | "high" | "unknown";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  reasons: string[];
}

export type GrowthStageCode =
  | "pre_planting"
  | "initial"
  | "development"
  | "mid"
  | "late"
  | "post_harvest";

export interface GrowthStage {
  code: GrowthStageCode;
  name: string;
  days_after_planting: number | null;
  progress: number | null;
  kc: number | null;
}

export interface WaterBalanceSummary {
  depletion_mm: number | null;
  taw_mm: number | null;
  raw_mm: number | null;
  depletion_fraction: number | null;
  stress_days: number;
  initial_depletion_mm: number | null;
  runoff_mm: number | null;
  drainage_mm: number | null;
  days_simulated: number;
  /** Days without complete ET₀ inputs; simulated without water use, never filled. */
  excluded_et0_days: number;
}

/** One simulated day from the root-zone bucket. */
export interface BalanceDay {
  date: string;
  depletion_mm: number;
  taw_mm: number;
  raw_mm: number;
  etc_mm_day: number | null;
  precipitation_mm: number;
  stressed: boolean;
}

export interface Driver {
  key: string;
  label: string;
  value: number | string | null;
  unit: string | null;
  interpretation: string;
}

export interface IrrigationAnalysis {
  status: "ok" | "insufficient_data";
  /** True when the crop season has ended; no demand class is assessed. */
  season_complete: boolean;
  demand: DemandLevel;
  /** Short, data-derived explanations for the demand class. */
  demand_reasons: string[];
  confidence: ConfidenceAssessment;
  computed_for: string;
  stage: GrowthStage | null;
  et0_mm_day: number | null;
  kc: number | null;
  etc_mm_day: number | null;
  balance: WaterBalanceSummary;
  /** Daily root-zone depletion used by the chart and the explanation. */
  balance_series: BalanceDay[];
  net_requirement_mm: number | null;
  gross_requirement_mm: number | null;
  application_efficiency: number | null;
  drivers: Driver[];
  missing_inputs: string[];
  limitations: string[];
  source: DataSourceRef;
  is_demo: boolean;
}

export type HealthStatus = "good" | "moderate" | "stressed" | "insufficient_data";
export type IndicatorStatus = "good" | "watch" | "stress" | "unknown";
export type VegetationTrend = "improving" | "declining" | "stable" | "unknown";

export interface HealthIndicator {
  id: string;
  label: string;
  value: number | string | null;
  unit: string | null;
  status: IndicatorStatus;
  interpretation: string;
}

export interface VegetationSummary {
  available: boolean;
  ndvi: number | null;
  trend: VegetationTrend;
  latest_date: string | null;
  note: string;
}

export interface IndicatorAgreement {
  percent: number | null;
  known: number;
  total: number;
  stressed: number;
  definition: string;
}

export interface CropHealthAnalysis {
  status: HealthStatus;
  /** True when the crop season has ended; no crop-health assessment is made. */
  season_complete: boolean;
  status_reason: string;
  indicators: HealthIndicator[];
  indicator_agreement: IndicatorAgreement | null;
  vegetation: VegetationSummary;
  summary: string;
  missing_inputs: string[];
  limitations: string[];
  source: DataSourceRef;
  is_demo: boolean;
  computed_for: string;
}

export interface VegetationPoint {
  date: string;
  ndvi: number;
}

export interface VegetationResponse {
  field_id: number;
  available: boolean;
  reason: string | null;
  provider: string | null;
  series: VegetationPoint[];
  latest: VegetationPoint | null;
  trend: VegetationTrend;
  ndmi: number | null;
  ndvi_condition: VegetationCondition;
  ndmi_condition: MoistureCondition;
  acquisition_date: string | null;
  cloud_cover_percent: number | null;
  scene_count: number | null;
  composite: boolean;
  geometry_source: GeometrySource | null;
  tile: SatelliteLayerTile | null;
  interpretation: string | null;
  formula: string;
  limitations: string[];
  is_demo: boolean;
}

export interface ChatRequest {
  field_id: number;
  message: string;
  conversation_id?: number | null;
  mode?: DataMode;
}

export interface ChatResponse {
  reply: string;
  provider: "llm" | "rule_based";
  conversation_id: number;
  context_used: Record<string, unknown>;
  notice: string;
  is_demo: boolean;
}

export interface ConversationMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  provider: string | null;
  /** Exact structured context stored with the answer, when available. */
  context_used?: Record<string, unknown> | null;
  created_at: string;
}

export interface DataSourcesResponse {
  mode: DataMode;
  power_endpoint: string;
  sources: DataSourceRef[];
  notes: string[];
}

export interface DemoInfo {
  enabled: boolean;
  data_mode: DataMode;
  snapshot_date: string | null;
  snapshot_field: {
    name: string;
    latitude: number;
    longitude: number;
    planting_date: string;
    location_label: string;
  } | null;
  notice: string;
}

export interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
  kind: string | null;
}

export interface ReverseGeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
}

export interface HealthCheck {
  status: "ok";
  service: string;
  version: string;
  data_mode: DataMode;
  ai_configured: boolean;
  vegetation_configured: boolean;
  database: string;
}

// ── Satellite analysis (Google Earth Engine) ────────────────────────────────
export type WetnessCategory = "dry" | "near_normal" | "wet" | "unknown";
export type VegetationCondition = "sparse" | "moderate" | "dense" | "unknown";
export type MoistureCondition = "low" | "moderate" | "high" | "unknown";
export type GeometrySource = "polygon" | "point_buffer";

export interface SatelliteRequestPayload {
  geometry?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  buffer_km?: number;
  start?: string;
  end?: string;
  max_cloud_percent?: number;
  include_tiles?: boolean;
}

export interface SatelliteFieldOptions {
  start?: string;
  end?: string;
  buffer_km?: number;
  max_cloud_percent?: number;
  include_tiles?: boolean;
}

export interface SoilMoistureResult {
  available: boolean;
  category: WetnessCategory;
  /** 0–1 stretch of VV backscatter across the documented heuristic band. */
  relative_score: number | null;
  /** Same score as 0–100, relative only — not volumetric soil moisture. */
  relative_percent: number | null;
  vv_db: number | null;
  vh_db: number | null;
  vh_minus_vv_db: number | null;
  acquisition_date: string | null;
  scene_count: number;
  valid_pixels: number | null;
  reason: string | null;
  interpretation: string;
}

export interface VegetationIndicesResult {
  available: boolean;
  ndvi: number | null;
  ndmi: number | null;
  ndwi: number | null;
  ndvi_condition: VegetationCondition;
  ndmi_condition: MoistureCondition;
  acquisition_date: string | null;
  scene_count: number;
  cloud_cover_percent: number | null;
  valid_fraction: number | null;
  /** True when indices come from a median composite instead of a single scene. */
  composite: boolean;
  reason: string | null;
  interpretation: string;
}

export interface SatelliteLayerTile {
  url: string;
  layer_name: string;
  kind: "palette" | "rgb";
  min: number;
  max: number;
  palette: string[];
  attribution: string;
}

export interface SatelliteTiles {
  ndvi: SatelliteLayerTile | null;
  ndmi: SatelliteLayerTile | null;
  soil_moisture: SatelliteLayerTile | null;
  true_color: SatelliteLayerTile | null;
}

export interface SatelliteAnalysis {
  field_id: number | null;
  area_ha: number;
  geometry_source: GeometrySource;
  start: string;
  end: string;
  soil_moisture: SoilMoistureResult;
  vegetation: VegetationIndicesResult;
  tiles: SatelliteTiles;
  sources: DataSourceRef[];
  limitations: string[];
  corrections: string[];
  generated_at: string;
}

// ── Simplified farmer guide ────────────────────────────────────────────────

export type FarmerIntent = "plant_now" | "already_planted";
export type SeasonVerdict = "suitable" | "marginal" | "not_suitable" | "unknown";
export type HealthRating = "excellent" | "good" | "fair" | "weak" | "poor" | "unknown";
export type OutlookKind = "heat" | "frost" | "rain" | "wind" | "stable" | "unknown";
export type PlantingReason =
  | "weather_unavailable"
  | "in_ideal_season"
  | "acceptable_season"
  | "outside_planting_season"
  | "temperature_ideal"
  | "temperature_too_hot"
  | "temperature_too_cold"
  | "soil_ready"
  | "soil_dry"
  | "soil_saturated"
  | "satellite_unavailable";
export type HealthReasonCode =
  | "ok"
  | "satellite_not_configured"
  | "satellite_unavailable"
  | "no_recent_image";
export type SoilAdvice =
  | "irrigate_today"
  | "no_irrigation_today"
  | "check_soil_moisture"
  | "irrigate_before_planting"
  | "wait_for_soil_to_dry"
  | "ready_to_plant";
export type WeatherAdvice =
  | "irrigate_early_morning"
  | "protect_from_frost"
  | "hold_irrigation_rain"
  | "avoid_spraying_wind"
  | "good_growing_weather";

export type TimelineStage = "pre_planting" | "early_growth" | "established";
export type TimelineRisk =
  | "dry_seedbed"
  | "wet_seedbed"
  | "rain_crusting"
  | "heat_stress"
  | "frost"
  | "wind_damage"
  | "canopy_stress"
  | "past_emergence_window";
export type TimelineAction =
  | "prepare_seedbed"
  | "pre_irrigate"
  | "wait_for_drain"
  | "sow_now"
  | "sow_at_depth"
  | "apply_basal_fertiliser"
  | "irrigate_early_morning"
  | "hold_irrigation_rain"
  | "monitor_seedbed"
  | "light_irrigation"
  | "avoid_irrigation"
  | "check_emergence"
  | "protect_young_roots"
  | "scout_weeds"
  | "scout_pests"
  | "monitor_crop"
  | "protect_from_frost"
  | "plant_tubers"
  | "harden_transplants"
  | "transplant_seedlings"
  | "check_transplants"
  | "earth_up_ridges"
  | "stake_plants";

export interface FarmerSummaryRequest {
  latitude: number;
  longitude: number;
  crop_id: string;
  intent: FarmerIntent;
  days_since_planting?: number | null;
  geometry?: Record<string, unknown> | null;
}

export interface FarmerTimeline {
  stage: TimelineStage;
  days_since_planting: number | null;
  planting_date: string | null;
  emergence_from: string | null;
  emergence_to: string | null;
  seed_depth_cm_min: number | null;
  seed_depth_cm_max: number | null;
  risks: TimelineRisk[];
  actions: TimelineAction[];
}

export interface DemoField {
  id: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  latitude: number;
  longitude: number;
  geometry: Record<string, unknown>;
  crop_id: string;
  intent: FarmerIntent;
  days_since_planting: number | null;
}

/**
 * A saved demo field used by the field-scoped tools. It carries only the real
 * location and profile defaults; every analysis value is computed live.
 */
export interface DemoTrial {
  key: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  latitude: number;
  longitude: number;
  geometry: Record<string, unknown>;
  crop_id: string;
  intent: FarmerIntent;
  soil_texture: string;
  irrigation_system: string;
  area_ha: number;
  planting_offset_days: number;
}

export interface FarmerCrop {
  id: string;
  name: string;
  season_days: number;
  optimal_temp_min_c: number;
  optimal_temp_max_c: number;
  ideal_planting_months: number[];
  acceptable_planting_months: number[];
}

export interface FarmerWeather {
  available: boolean;
  date: string | null;
  temperature_mean_c: number | null;
  temperature_max_c: number | null;
  temperature_min_c: number | null;
  humidity_pct: number | null;
  wind_ms: number | null;
  rain_mm: number | null;
  et0_mm_day: number | null;
  reason: string | null;
}

export interface FarmerForecastDay {
  date: string;
  temperature_max_c: number | null;
  temperature_min_c: number | null;
  rain_mm: number | null;
  wind_max_ms: number | null;
}

export interface FarmerForecast {
  available: boolean;
  provider: string | null;
  days: FarmerForecastDay[];
  reason: string | null;
}

export interface FarmerSoil {
  available: boolean;
  category: WetnessCategory;
  relative_percent: number | null;
  acquisition_date: string | null;
  advice: SoilAdvice;
  reason: string | null;
}

export interface PlantingAssessment {
  verdict: SeasonVerdict;
  readiness_percent: number | null;
  primary_reason: PlantingReason;
  reasons: PlantingReason[];
  month: number;
  month_score: number;
  temperature_score: number | null;
  soil_score: number | null;
  current_temperature_c: number | null;
}

export interface PlantHealth {
  available: boolean;
  percent: number | null;
  rating: HealthRating;
  reason_code: HealthReasonCode;
  reason: string | null;
  ndvi: number | null;
  ndmi: number | null;
  acquisition_date: string | null;
  scene_count: number;
  composite: boolean;
  formula: string;
}

export interface FarmerOutlook {
  available: boolean;
  headline: OutlookKind;
  max_temp_c: number | null;
  min_temp_c: number | null;
  rain_total_mm: number | null;
  max_wind_ms: number | null;
  advice: WeatherAdvice[];
}

export interface FarmerSummary {
  available: boolean;
  is_demo: boolean;
  reason_code: string | null;
  reason: string | null;
  crop: FarmerCrop;
  intent: FarmerIntent;
  latitude: number;
  longitude: number;
  assessed_on: string;
  planting: PlantingAssessment | null;
  health: PlantHealth | null;
  weather: FarmerWeather;
  forecast: FarmerForecast;
  soil: FarmerSoil;
  outlook: FarmerOutlook;
  timeline: FarmerTimeline | null;
  tiles: SatelliteTiles;
  corrections: string[];
  sources: DataSourceRef[];
  limitations: string[];
  generated_at: string;
}

// ── Location intelligence (Explore Map / Location Analysis) ─────────────────

/** One displayed value with its source, period and confidence. */
export interface LocationReading {
  key: string;
  label: string;
  value: number | string | null;
  unit: string | null;
  status: "available" | "unavailable";
  source_id: string;
  observed_at: string | null;
  period: string | null;
  confidence: "high" | "medium" | "low" | "unknown";
  note: string | null;
}

export interface LocationDetails {
  label: string | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  county: string | null;
  nearest_place: string | null;
  suburb: string | null;
  road: string | null;
  attribution: string | null;
  latitude: number;
  longitude: number;
  analysis_latitude: number;
  analysis_longitude: number;
  area_ha: number | null;
  geometry_source: "point" | "polygon";
}

export interface DailyClimatePoint {
  date: string;
  t_mean_c: number | null;
  t_max_c: number | null;
  t_min_c: number | null;
  precipitation_mm: number | null;
  wind_max_ms: number | null;
  wind_from_deg: number | null;
  solar_mj_m2: number | null;
  et0_mm: number | null;
  humidity_pct?: number | null;
  soil_moisture_0_7cm_pct?: number | null;
  soil_temperature_0_7cm_c?: number | null;
}

export interface CurrentWeatherBlock {
  available: boolean;
  reason?: string;
  time?: string;
  weather?: string | null;
  weather_code?: number | null;
  elevation_m?: number | null;
  readings?: LocationReading[];
}

export interface WeatherBlock {
  period_start: string;
  period_end: string;
  source_id: string;
  days: number;
  daily: DailyClimatePoint[];
  readings: LocationReading[];
}

export interface WaterBlock {
  rain_total_mm: number | null;
  et0_total_mm: number | null;
  balance_mm: number | null;
  category: string;
  humidity_mean_pct: number | null;
  method: string;
  readings: LocationReading[];
}

export interface LocationAlert {
  key: string;
  level: "info" | "moderate" | "high";
  title: string;
  detail: string;
  sources: string[];
}

export interface LocationOverview {
  available: boolean;
  generated_at: string;
  location: LocationDetails;
  crop_id: string | null;
  current: CurrentWeatherBlock;
  weather: WeatherBlock;
  water: WaterBlock;
  alerts: LocationAlert[];
  sources: DataSourceRef[];
  limitations: string[];
}

export interface SoilLayer {
  depth: string;
  phh2o?: number | null;
  soc?: number | null;
  clay?: number | null;
  sand?: number | null;
  silt?: number | null;
  bdod?: number | null;
  cec?: number | null;
  nitrogen?: number | null;
}

export interface SoilBlock {
  available: boolean;
  reason?: string;
  texture?: {
    class: string;
    clay_pct: number | null;
    sand_pct: number | null;
    silt_pct: number | null;
    method: string;
  };
  layers?: SoilLayer[];
  fetched_at?: string;
  access?: string | null;
  aggregation?: string | null;
  readings?: LocationReading[];
  alerts?: LocationAlert[];
  sources?: string[];
  sources_detail?: DataSourceRef[];
  limitations?: string[];
}

export interface HistoryComparison {
  key: string;
  label: string;
  start?: string;
  end?: string;
  temp_mean_c: number | null;
  temp_max_mean_c: number | null;
  temp_min_mean_c: number | null;
  precipitation_mm: number | null;
  et0_mm: number | null;
  humidity_pct: number | null;
  soil_moisture_0_7cm_pct: number | null;
  temp_anomaly_c: number | null;
  precipitation_anomaly_mm: number | null;
  baseline?: { temp_mean_c: number | null; precipitation_mm: number | null } | null;
}

export interface MonthlyHistory {
  year: number;
  month: number;
  label: string;
  temp_mean_c: number | null;
  precipitation_mm: number | null;
  et0_mm: number | null;
  days_present: number;
  days_in_month: number;
  complete: boolean;
}

export interface YearlyHistory {
  year: number;
  temp_mean_c: number | null;
  precipitation_mm: number | null;
  et0_mm: number | null;
  days_present: number;
  complete: boolean;
}

export interface HistoryResponse {
  available: boolean;
  reason?: string;
  latitude?: number;
  longitude?: number;
  available_period?: {
    archive_start: string;
    start: string;
    end: string;
    note: string;
  };
  comparisons?: HistoryComparison[];
  monthly?: MonthlyHistory[];
  yearly?: YearlyHistory[];
  daily?: DailyClimatePoint[];
  drought?: {
    window_days: number;
    period_start: string;
    period_end: string;
    precipitation_mm: number | null;
    baseline_mean_mm: number | null;
    percentile: number | null;
    category: string;
    method: string;
  } | null;
  sources?: string[];
  sources_detail?: DataSourceRef[];
  fetched_at?: string | null;
  limitations?: string[];
}

export interface VegetationSummary {
  ndvi: number | null;
  evi: number | null;
  ndmi: number | null;
  ndvi_previous: number | null;
  ndvi_change: number | null;
  previous_period?: { start: string; end: string } | null;
}

export interface VegetationBlock {
  available: boolean;
  reason?: string;
  geometry_source?: string;
  area_ha?: number | null;
  buffer_m?: number | null;
  period?: { latest_start: string; latest_end: string } | null;
  fetched_at?: string;
  sources?: string[];
  sources_detail?: DataSourceRef[];
  limitations?: string[];
  vegetation?: VegetationSummary;
  monthly_ndvi?: Array<{ month: string; ndvi: number | null; scenes: number }>;
  land_cover?: { class: string; confidence: number | null; note: string } | null;
  soil_moisture_smap?: { percent_by_volume: number | null; depth_note: string } | null;
  gpm_monthly?: { month: string; precipitation_mm: number | null; note: string } | null;
}

export interface CropFactor {
  key: string;
  label: string;
  score: number;
  max: number;
  status: "good" | "marginal" | "poor" | "unknown";
  explanation: string;
}

export interface CropRisk {
  key: string;
  level: "high" | "moderate" | "low";
  text: string;
  sources: string[];
}

export interface CropRecommendation {
  text: string;
  basis: string;
  sources: string[];
}

export interface CropAssessment {
  available: boolean;
  reason?: string;
  crop_id: string;
  crop_name?: string;
  verdict?: "suitable" | "marginal" | "not_suitable";
  score?: number;
  score_max?: number;
  confidence?: "high" | "medium" | "low";
  planting?: {
    ideal_months: string[];
    acceptable_months: string[];
    season_days: number;
    establishment: string;
    note: string;
  };
  reference_temperature_c?: number | null;
  soil?: { texture: string; ph: number | null; organic_carbon_g_kg: number | null };
  water_reference?: {
    season_days: number;
    months_used: number;
    et0_total_mm: number;
    etc_estimate_mm: number;
    rain_total_mm: number;
    effective_rain_mm: number;
    net_irrigation_estimate_mm: number;
    reference_range_mm: number[];
    method: string;
  } | null;
  factors?: CropFactor[];
  risks?: CropRisk[];
  recommendations?: CropRecommendation[];
  sources?: string[];
  sources_detail?: DataSourceRef[];
  limitations?: string[];
  location?: {
    latitude: number;
    longitude: number;
    area_ha: number | null;
    geometry_source: string;
  };
}

export interface CropOption {
  id: string;
  name: string;
  ideal_months: number[];
  acceptable_months: number[];
  season_days: number;
  establishment: string;
  note: string;
}

export interface CropCatalogue {
  crops: CropOption[];
  note: string;
}

export interface LocationRequestPayload {
  latitude: number;
  longitude: number;
  geometry?: Record<string, unknown> | null;
  crop_id?: string | null;
  label?: string | null;
}

export interface PairingCode {
  code: string;
  field_id: number;
  field_name: string;
  expires_at: string;
}

export interface PairingCodeInfo {
  valid: boolean;
  field_id: number;
  field_name: string;
  expires_at: string;
}

export interface RobotDevice {
  id: number;
  field_id: number;
  label: string;
  token_prefix: string;
  active: boolean;
  created_at: string;
  last_seen_at: string | null;
}

export interface DeviceToken {
  token: string;
  device: RobotDevice;
  field_name: string;
}

export interface SensorReading {
  id: number;
  device_id: number;
  field_id: number;
  soil_moisture_pct: number | null;
  air_temp_c: number | null;
  humidity_pct: number | null;
  distance_cm: number | null;
  measured_at: string;
  received_at: string;
}

export interface FieldSensors {
  field_id: number;
  devices: RobotDevice[];
  latest: SensorReading | null;
  readings: SensorReading[];
}
