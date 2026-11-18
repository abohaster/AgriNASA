import type {
  RayyanAskPayload,
  RayyanAskResponse,
  RayyanAvailability,
  RayyanCapabilities,
  RayyanKey,
  RayyanKeyCreate,
  RayyanKeyUpdate,
  RayyanModelList,
  RayyanSettingsStatus,
  RayyanValidateResult,
} from "./types";

/**
 * HTTP client for the RAYAN API.
 *
 * The settings token is the only credential this module ever holds and it lives
 * in a module variable (memory) only — never localStorage, sessionStorage or a
 * cookie. Gemini API keys are sent exactly once, in the add-key request.
 */
const BASE =
  (import.meta.env.VITE_RAYAN_API_BASE_URL as string | undefined) ?? "/api/rayyan";

let settingsToken = "";

export function setSettingsToken(token: string): void {
  settingsToken = token.trim();
}

export function clearSettingsToken(): void {
  settingsToken = "";
}

export function hasSettingsToken(): boolean {
  return settingsToken.length > 0;
}

export class RayyanApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly details: string | null;

  constructor(message: string, code = "UNKNOWN", status: number | null = null, details: string | null = null) {
    super(message);
    this.name = "RayyanApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: string | null };
}

export interface RayyanErrorInfo {
  message: string;
  details: string | null;
  code: string;
  status: number | null;
}

/** Normalise any thrown value into a display-ready error without leaking secrets. */
export function describeError(error: unknown): RayyanErrorInfo {
  if (error instanceof RayyanApiError) {
    return { message: error.message, details: error.details, code: error.code, status: error.status };
  }
  return {
    message: error instanceof Error ? error.message : "Something went wrong.",
    details: null,
    code: "UNKNOWN",
    status: null,
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init.body) headers["Content-Type"] = "application/json";
  if (settingsToken) headers["X-Rayyan-Settings-Token"] = settingsToken;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new RayyanApiError(
      "The RAYAN backend could not be reached. Check that it is running.",
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    let body: ErrorEnvelope | null = null;
    try {
      body = (await response.json()) as ErrorEnvelope;
    } catch {
      // Non-JSON body: fall through to the status-based message.
    }
    throw new RayyanApiError(
      body?.error?.message ?? `Request failed with status ${response.status}.`,
      body?.error?.code ?? "HTTP_ERROR",
      response.status,
      body?.error?.details ?? null,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function modeQuery(mode?: "live" | "demo"): string {
  return mode ? `?mode=${mode}` : "";
}

export const rayyanApi = {
  availability: (signal?: AbortSignal) =>
    request<RayyanAvailability>("/availability", { signal }),

  capabilities: (mode?: "live" | "demo", signal?: AbortSignal) =>
    request<RayyanCapabilities>(`/capabilities${modeQuery(mode)}`, { signal }),

  settings: (signal?: AbortSignal) =>
    request<RayyanSettingsStatus>("/settings", { signal }),

  addKey: (payload: RayyanKeyCreate) =>
    request<RayyanKey>("/settings/keys", { method: "POST", body: JSON.stringify(payload) }),

  validateKey: (keyId: string) =>
    request<RayyanValidateResult>(`/settings/keys/${encodeURIComponent(keyId)}/validate`, {
      method: "POST",
    }),

  updateKey: (keyId: string, payload: RayyanKeyUpdate) =>
    request<RayyanKey>(`/settings/keys/${encodeURIComponent(keyId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  activateKey: (keyId: string) =>
    request<RayyanKey>(`/settings/keys/${encodeURIComponent(keyId)}/activate`, {
      method: "POST",
    }),

  deleteKey: (keyId: string) =>
    request<void>(`/settings/keys/${encodeURIComponent(keyId)}`, { method: "DELETE" }),

  models: (keyId?: string, refresh = false) => {
    const params = new URLSearchParams();
    if (keyId) params.set("key_id", keyId);
    if (refresh) params.set("refresh", "true");
    const qs = params.toString();
    return request<RayyanModelList>(`/settings/models${qs ? `?${qs}` : ""}`);
  },

  ask: (payload: RayyanAskPayload) =>
    request<RayyanAskResponse>("/ask", { method: "POST", body: JSON.stringify(payload) }),
};
