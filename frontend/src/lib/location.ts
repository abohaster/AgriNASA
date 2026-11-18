import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Field } from "../api/types";
import { useAsync } from "../hooks/useAsync";

const STORAGE_KEY = "agrinasa:selected-location";
const GEOMETRY_KEY = "agrinasa:explore-geometry";

export interface StoredLocation {
  latitude: number;
  longitude: number;
  label?: string | null;
}

export interface ExploreGeometry {
  geometry: Record<string, unknown>;
  latitude: number;
  longitude: number;
  areaHa: number | null;
  label?: string | null;
}

/** Last analysed point, so Explore and the analysis pages agree on a place. */
export function readStoredLocation(): StoredLocation | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocation;
    if (Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) {
      return parsed;
    }
  } catch {
    // Ignore a corrupted value; the map simply starts with no selection.
  }
  return null;
}

export function rememberLocation(location: StoredLocation): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
}

/** A drawn field outline is too large for a URL; carry it for one analysis. */
export function saveExploreGeometry(value: ExploreGeometry): void {
  window.sessionStorage.setItem(GEOMETRY_KEY, JSON.stringify(value));
}

export function readExploreGeometry(): ExploreGeometry | null {
  try {
    const raw = window.sessionStorage.getItem(GEOMETRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExploreGeometry;
    if (parsed.geometry && Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) {
      return parsed;
    }
  } catch {
    // Fall through: the point still works without the outline.
  }
  return null;
}

export interface SelectedLocation {
  latitude: number;
  longitude: number;
  label: string | null;
  boundary: Record<string, unknown> | null;
  areaHa: number | null;
  cropId: string | null;
  field: Field | null;
  source: "field" | "query" | "drawing" | "stored";
  loading: boolean;
}

/**
 * Resolve the active location from, in order of specificity:
 * a stored field (?field=), explicit coordinates (?lat&lon), a drawn outline
 * carried in session storage (?area=1), or the last point the user analysed.
 */
export function useSelectedLocation(): SelectedLocation | null {
  const [params] = useSearchParams();
  const fieldParam = Number.parseInt(params.get("field") ?? "", 10);
  const fieldId = Number.isFinite(fieldParam) && fieldParam > 0 ? fieldParam : null;
  const { data: field, status: fieldStatus } = useAsync<Field | null>(
    (signal) => (fieldId ? api.getField(fieldId, signal) : Promise.resolve(null)),
    [fieldId],
  );
  const loading = fieldStatus === "loading";

  const latParam = Number.parseFloat(params.get("lat") ?? "");
  const lonParam = Number.parseFloat(params.get("lon") ?? "");
  const labelParam = params.get("label");
  const hasQueryPoint = Number.isFinite(latParam) && Number.isFinite(lonParam);
  const wantsArea = params.get("area") === "1";
  const drawing = wantsArea ? readExploreGeometry() : null;
  const stored = readStoredLocation();

  let selected: SelectedLocation | null = null;
  if (field) {
    selected = {
      latitude: field.latitude,
      longitude: field.longitude,
      label: field.location_label ?? field.name,
      boundary: field.boundary_geojson,
      areaHa: field.area_ha,
      cropId: field.crop_id,
      field,
      source: "field",
      loading: false,
    };
  } else if (hasQueryPoint) {
    selected = {
      latitude: latParam,
      longitude: lonParam,
      label: labelParam,
      boundary: drawing?.geometry ?? null,
      areaHa: drawing?.areaHa ?? null,
      cropId: null,
      field: null,
      source: drawing ? "drawing" : "query",
      loading: false,
    };
  } else if (drawing) {
    selected = {
      latitude: drawing.latitude,
      longitude: drawing.longitude,
      label: drawing.label ?? null,
      boundary: drawing.geometry,
      areaHa: drawing.areaHa,
      cropId: null,
      field: null,
      source: "drawing",
      loading: false,
    };
  } else if (stored) {
    selected = {
      latitude: stored.latitude,
      longitude: stored.longitude,
      label: stored.label ?? null,
      boundary: null,
      areaHa: null,
      cropId: null,
      field: null,
      source: "stored",
      loading: false,
    };
  }

  useEffect(() => {
    if (selected && (selected.source === "query" || selected.source === "drawing" || selected.source === "stored")) {
      rememberLocation({
        latitude: selected.latitude,
        longitude: selected.longitude,
        label: selected.label,
      });
    }
  }, [selected?.latitude, selected?.longitude, selected?.label, selected?.source]);

  if (!selected && fieldId && loading) {
    return {
      latitude: 0,
      longitude: 0,
      label: null,
      boundary: null,
      areaHa: null,
      cropId: null,
      field: null,
      source: "field",
      loading: true,
    };
  }

  return selected;
}

export function pathForLocation(
  base: "/location" | "/history" | "/crop",
  location: SelectedLocation,
): string {
  if (location.field) return `${base}?field=${location.field.id}`;
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
  });
  if (location.label) params.set("label", location.label);
  if (location.boundary) params.set("area", "1");
  return `${base}?${params.toString()}`;
}

/** GeoJSON ring from UI corner order, for the POST analysis endpoints. */
export function ringRequest(location: SelectedLocation): {
  latitude: number;
  longitude: number;
  geometry: Record<string, unknown> | null;
  label: string | null;
} {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    geometry: location.boundary,
    label: location.label,
  };
}
