/** Types mirroring `backend/app/rayyan/schemas.py`. Keys never appear here in clear. */

export type RayyanKeyStatus = "valid" | "invalid" | "quota_limited";
export type RayyanValidationStatus = "valid" | "invalid" | "quota_limited" | "error";
export type RayyanKeySource = "saved" | "environment";
export type RayyanAuthMode = "token" | "loopback";
export type CapabilityStatus =
  | "AVAILABLE"
  | "PARTIALLY_AVAILABLE"
  | "CONFIGURATION_REQUIRED"
  | "DATA_UNAVAILABLE"
  | "DEMO_ONLY"
  | "NOT_IMPLEMENTED";

export interface RayyanKey {
  id: string;
  label: string;
  /** Pre-computed by the backend; the clear key is never sent to the browser. */
  masked_key: string;
  status: RayyanKeyStatus;
  active: boolean;
  model: string | null;
  created_at: string;
  last_validated_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  source: RayyanKeySource;
}

export interface RayyanSettingsStatus {
  configured: boolean;
  source: RayyanKeySource | "none";
  active_key: RayyanKey | null;
  keys: RayyanKey[];
  models: string[];
  models_source: "live" | "cached" | "unavailable";
  settings_token_required: boolean;
  auth_mode: RayyanAuthMode;
  bootstrap_env_present: boolean;
  encryption: string;
  key_storage: string;
}

export interface RayyanAvailability {
  configured: boolean;
  source: RayyanKeySource | "none";
  active_key_label: string | null;
  active_key_status: RayyanKeyStatus | null;
  model: string | null;
  auth_mode: RayyanAuthMode;
  data_mode: "live" | "demo";
  max_requests_per_hour: number;
}

export interface RayyanKeyCreate {
  label: string;
  api_key: string;
  model?: string | null;
}

export interface RayyanKeyUpdate {
  label?: string;
  model?: string | null;
}

export interface RayyanValidateResult {
  key_id: string;
  valid: boolean;
  status: RayyanValidationStatus;
  code: string | null;
  message: string;
  models: string[];
  model: string | null;
  checked_at: string;
}

export interface RayyanModelList {
  key_id: string;
  key_label: string;
  source: RayyanKeySource;
  models: string[];
  default_model: string | null;
  cached: boolean;
  models_source: "live" | "cached" | "unavailable";
}

export interface RayyanCapability {
  id: string;
  label: string;
  status: CapabilityStatus;
  detail: string;
  source_id: string | null;
}

export interface RayyanCapabilities {
  data_mode: "live" | "demo";
  capabilities: RayyanCapability[];
  unavailable_ids: string[];
}

export interface RayyanAskPayload {
  field_id: number;
  message: string;
  lang: "en" | "ar";
  conversation_id?: string | null;
  mode?: "live" | "demo";
}

export interface RayyanValidationReport {
  status: "passed" | "rejected" | "skipped";
  checks: string[];
  rejected_numbers: string[];
  removed_urls: number;
  word_count: number;
}

export interface RayyanProviderError {
  code: string;
  message: string;
}

export interface RayyanAskResponse {
  reply: string;
  provider: "gemini" | "deterministic_fallback";
  model: string | null;
  key_id: string | null;
  key_label: string | null;
  conversation_id: string;
  conversation_persisted: boolean;
  notice: string;
  is_demo: boolean;
  context_used: Record<string, unknown>;
  capabilities: RayyanCapability[];
  sources: Array<{ id?: string; name?: string; [key: string]: unknown }>;
  validation: RayyanValidationReport;
  provider_error: RayyanProviderError | null;
  usage: Record<string, unknown> | null;
}
