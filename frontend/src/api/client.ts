import type {
  ApiErrorBody,
  ChatRequest,
  ChatResponse,
  ConversationMessage,
  CropAssessment,
  CropCatalogue,
  CropHealthAnalysis,
  DataMode,
  DataSourcesResponse,
  DemoField,
  DeviceToken,
  DemoInfo,
  DemoTrial,
  EnvironmentResponse,
  FarmerSummary,
  FarmerSummaryRequest,
  Field,
  FieldCreate,
  FieldImages,
  FieldMoisture,
  FieldSensors,
  FieldUpdate,
  GeocodeResult,
  HealthyReference,
  HealthCheck,
  HistoryResponse,
  IrrigationAnalysis,
  LocationOverview,
  LocationRequestPayload,
  PairingCode,
  PairingCodeInfo,
  ReverseGeocodeResult,
  RobotDevice,
  RobotImage,
  SatelliteAnalysis,
  SatelliteFieldOptions,
  SatelliteRequestPayload,
  SensorReading,
  SoilBlock,
  VegetationBlock,
  VegetationResponse,
} from "./types";

/**
 * The single HTTP entry point for the browser.
 *
 * VITE_API_BASE_URL is optional; in development the Vite proxy forwards /api
 * to FastAPI (see vite.config.ts). No secrets are ever read in this file.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly details: string | null;

  constructor(message: string, code = "UNKNOWN", status: number | null = null, details: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch {
    throw new ApiError(
      "The server could not be reached. Check that the backend is running on port 8000.",
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Non-JSON error body — fall through to a generic message.
    }
    throw new ApiError(
      body?.error?.message ?? `Request failed with status ${response.status}.`,
      body?.error?.code ?? "HTTP_ERROR",
      response.status,
      body?.error?.details ?? null,
    );
  }

  // 204 responses (DELETE) have no body to parse.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Demo mode is opt-in per request; live mode is the default. */
function modeQuery(mode?: DataMode, extra?: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  if (mode === "demo") params.set("mode", "demo");
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  health: () => request<HealthCheck>("/health"),
  dataSources: () => request<DataSourcesResponse>("/data-sources"),
  demoInfo: () => request<DemoInfo>("/demo"),

  listFields: (signal?: AbortSignal) => request<Field[]>("/fields", { signal }),
  getField: (fieldId: number, signal?: AbortSignal) =>
    request<Field>(`/fields/${fieldId}`, { signal }),
  createField: (payload: FieldCreate) =>
    request<Field>("/fields", { method: "POST", body: JSON.stringify(payload) }),
  updateField: (fieldId: number, payload: FieldUpdate) =>
    request<Field>(`/fields/${fieldId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteField: (fieldId: number) => request<void>(`/fields/${fieldId}`, { method: "DELETE" }),

  environment: (
    fieldId: number,
    opts: { start?: string; end?: string; mode?: DataMode; signal?: AbortSignal } = {},
  ) =>
    request<EnvironmentResponse>(
      `/fields/${fieldId}/environment${modeQuery(opts.mode, { start: opts.start, end: opts.end })}`,
      { signal: opts.signal },
    ),

  irrigation: (fieldId: number, opts: { end?: string; mode?: DataMode; signal?: AbortSignal } = {}) =>
    request<IrrigationAnalysis>(
      `/fields/${fieldId}/irrigation${modeQuery(opts.mode, { end: opts.end })}`,
      { signal: opts.signal },
    ),

  healthAnalysis: (
    fieldId: number,
    opts: { end?: string; mode?: DataMode; signal?: AbortSignal } = {},
  ) =>
    request<CropHealthAnalysis>(
      `/fields/${fieldId}/health${modeQuery(opts.mode, { end: opts.end })}`,
      { signal: opts.signal },
    ),

  vegetation: (fieldId: number, opts: { mode?: DataMode; signal?: AbortSignal } = {}) =>
    request<VegetationResponse>(`/fields/${fieldId}/vegetation${modeQuery(opts.mode)}`, {
      signal: opts.signal,
    }),

  satelliteAnalyze: (payload: SatelliteRequestPayload, signal?: AbortSignal) =>
    request<SatelliteAnalysis>("/satellite/analyze-field", {
      method: "POST",
      body: JSON.stringify(payload),
      signal,
    }),

  satelliteField: (
    fieldId: number,
    options: SatelliteFieldOptions = {},
    signal?: AbortSignal,
  ) =>
    request<SatelliteAnalysis>(`/satellite/fields/${fieldId}`, {
      method: "POST",
      body: JSON.stringify(options),
      signal,
    }),

  chat: (payload: ChatRequest) =>
    request<ChatResponse>("/assistant/chat", { method: "POST", body: JSON.stringify(payload) }),

  conversation: (fieldId: number, signal?: AbortSignal) =>
    request<ConversationMessage[]>(`/assistant/conversations/${fieldId}`, { signal }),

  farmerSummary: (
    payload: FarmerSummaryRequest,
    opts: { mode?: DataMode; signal?: AbortSignal } = {},
  ) =>
    request<FarmerSummary>(`/farmer-summary${modeQuery(opts.mode)}`, {
      method: "POST",
      body: JSON.stringify(payload),
      signal: opts.signal,
    }),

  farmerDemoFields: (signal?: AbortSignal) =>
    request<DemoField[]>("/farmer-demo-fields", { signal }),

  demoTrials: (signal?: AbortSignal) => request<DemoTrial[]>("/demo-trials", { signal }),

  /** Materialise one demo trial as a saved field; safe to call repeatedly. */
  ensureDemoTrial: (key: string) =>
    request<Field>(`/demo-trials/${encodeURIComponent(key)}`, { method: "POST" }),

  geocodeSearch: (query: string, signal?: AbortSignal) =>
    request<GeocodeResult[]>(`/geocode/search${modeQuery(undefined, { q: query })}`, { signal }),

  reverseGeocode: (latitude: number, longitude: number, signal?: AbortSignal) =>
    request<ReverseGeocodeResult>(
      `/geocode/reverse${modeQuery(undefined, { lat: latitude, lon: longitude })}`,
      { signal },
    ),

  locationCrops: (signal?: AbortSignal) =>
    request<CropCatalogue>("/location/crops", { signal }),

  locationOverview: (
    latitude: number,
    longitude: number,
    opts: { cropId?: string; label?: string; signal?: AbortSignal } = {},
  ) =>
    request<LocationOverview>(
      `/location/overview${modeQuery(undefined, {
        lat: latitude,
        lon: longitude,
        crop_id: opts.cropId,
        label: opts.label,
      })}`,
      { signal: opts.signal },
    ),

  locationOverviewArea: (payload: LocationRequestPayload, signal?: AbortSignal) =>
    request<LocationOverview>("/location/overview", {
      method: "POST",
      body: JSON.stringify(payload),
      signal,
    }),

  locationSoil: (
    latitude: number,
    longitude: number,
    opts: { signal?: AbortSignal } = {},
  ) =>
    request<SoilBlock>(
      `/location/soil${modeQuery(undefined, { lat: latitude, lon: longitude })}`,
      { signal: opts.signal },
    ),

  locationSoilArea: (payload: LocationRequestPayload, signal?: AbortSignal) =>
    request<SoilBlock>("/location/soil", {
      method: "POST",
      body: JSON.stringify(payload),
      signal,
    }),

  locationHistory: (
    latitude: number,
    longitude: number,
    opts: { end?: string; years?: number; signal?: AbortSignal } = {},
  ) =>
    request<HistoryResponse>(
      `/location/history${modeQuery(undefined, {
        lat: latitude,
        lon: longitude,
        end: opts.end,
        years: opts.years,
      })}`,
      { signal: opts.signal },
    ),

  locationVegetation: (
    latitude: number,
    longitude: number,
    opts: { months?: number; signal?: AbortSignal } = {},
  ) =>
    request<VegetationBlock>(
      `/location/vegetation${modeQuery(undefined, {
        lat: latitude,
        lon: longitude,
        months: opts.months,
      })}`,
      { signal: opts.signal },
    ),

  locationVegetationArea: (
    payload: LocationRequestPayload & { months?: number },
    signal?: AbortSignal,
  ) =>
    request<VegetationBlock>("/location/vegetation", {
      method: "POST",
      body: JSON.stringify(payload),
      signal,
    }),

  locationCrop: (
    latitude: number,
    longitude: number,
    cropId: string,
    opts: { signal?: AbortSignal } = {},
  ) =>
    request<CropAssessment>(
      `/location/crop${modeQuery(undefined, {
        lat: latitude,
        lon: longitude,
        crop_id: cropId,
      })}`,
      { signal: opts.signal },
    ),

  locationCropArea: (
    payload: LocationRequestPayload & { crop_id: string },
    signal?: AbortSignal,
  ) =>
    request<CropAssessment>("/location/crop", {
      method: "POST",
      body: JSON.stringify(payload),
      signal,
    }),

  // Field robot / on-farm sensors
  fieldSensors: (fieldId: number, signal?: AbortSignal) =>
    request<FieldSensors>(`/fields/${fieldId}/sensors`, { signal }),

  createPairingCode: (fieldId: number) =>
    request<PairingCode>("/devices/pairing-codes", {
      method: "POST",
      body: JSON.stringify({ field_id: fieldId }),
    }),

  pairingCodeInfo: (code: string, signal?: AbortSignal) =>
    request<PairingCodeInfo>(`/devices/pairing-codes/${encodeURIComponent(code)}`, { signal }),

  claimPairingCode: (code: string, label?: string) =>
    request<DeviceToken>("/devices/claim", {
      method: "POST",
      body: JSON.stringify({ code, label: label || undefined }),
    }),

  createDevice: (fieldId: number, label?: string) =>
    request<DeviceToken>("/devices", {
      method: "POST",
      body: JSON.stringify({ field_id: fieldId, label: label || undefined }),
    }),

  listDevices: (fieldId?: number, signal?: AbortSignal) =>
    request<RobotDevice[]>(`/devices${fieldId ? `?field_id=${fieldId}` : ""}`, { signal }),

  revokeDevice: (deviceId: number) =>
    request<void>(`/devices/${deviceId}`, { method: "DELETE" }),

  /** Posts one reading with a device token, exactly like the robot firmware does. */
  ingestReading: (
    token: string,
    reading: {
      soil_moisture_pct?: number;
      air_temp_c?: number;
      humidity_pct?: number;
      distance_cm?: number;
      measured_at?: string;
    },
  ) =>
    request<SensorReading>("/ingest/readings", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(reading),
    }),

  fieldMoisture: (
    fieldId: number,
    params: { start?: string; end?: string; limit?: number } = {},
    signal?: AbortSignal,
  ) => {
    const qs = new URLSearchParams();
    if (params.start) qs.set("start", params.start);
    if (params.end) qs.set("end", params.end);
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<FieldMoisture>(`/robot/fields/${fieldId}/moisture${suffix}`, { signal });
  },

  fieldImages: (
    fieldId: number,
    opts: { start?: string; end?: string; limit?: number } = {},
    signal?: AbortSignal,
  ) => {
    const qs = new URLSearchParams();
    if (opts.start) qs.set("start", opts.start);
    if (opts.end) qs.set("end", opts.end);
    if (opts.limit) qs.set("limit", String(opts.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<FieldImages>(`/robot/fields/${fieldId}/images${suffix}`, { signal });
  },

  uploadRobotImage: (
    fieldId: number,
    payload: {
      image_base64: string;
      content_type: string;
      captured_at?: string;
      growth_stage?: string;
      camera_id?: string;
      latitude?: number;
      longitude?: number;
      note?: string;
    },
    analyze = true,
  ) =>
    request<RobotImage>(`/robot/fields/${fieldId}/images?analyze=${analyze}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  analyzeRobotImage: (imageId: number, force = false) =>
    request<RobotImage>(`/robot/images/${imageId}/analyze?force=${force}`, { method: "POST" }),

  listReferences: (cropId?: string, signal?: AbortSignal) =>
    request<HealthyReference[]>(
      `/robot/references${cropId ? `?crop_id=${encodeURIComponent(cropId)}` : ""}`,
      { signal },
    ),

  uploadReference: (payload: {
    crop_id: string;
    label: string;
    image_base64: string;
    content_type: string;
    source_note?: string;
  }) =>
    request<HealthyReference>("/robot/references", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteReference: (referenceId: number) =>
    request<void>(`/robot/references/${referenceId}`, { method: "DELETE" }),

  plantStages: (signal?: AbortSignal) =>
    request<{ stages: string[] }>("/robot/plant-stages", { signal }),
};
