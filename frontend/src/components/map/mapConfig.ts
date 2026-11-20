/**
 * Map layer catalogue.
 *
 * Every basemap here is a public, key-free tile service. Attribution is passed
 * to Leaflet and must stay visible. The UI also states the source and native
 * resolution so a satellite image is never mistaken for a measurement.
 */

export type BasemapId = "satellite" | "street" | "gibs";

export interface BasemapDefinition {
  id: BasemapId;
  /** English source string, translated by t(). */
  label: string;
  source: string;
  resolution: string;
  attribution: string;
  url: string;
  maxZoom: number;
  maxNativeZoom?: number;
  /** OSM has no dark style; the existing CSS filter is applied only to it. */
  darkFilter?: boolean;
}

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Esri World Imagery is served through the public ArcGIS REST tile endpoint.
// It needs no key but requires the attribution below; check Esri's terms before
// commercial or high-volume use.
const ESRI_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

// NASA GIBS is public domain. MODIS true colour is 250 m and lags about 3 days.
const GIBS_LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";
const GIBS_MATRIX = "GoogleMapsCompatible_Level9";

export const BASEMAP_ORDER: BasemapId[] = ["satellite", "street", "gibs"];

export function gibsDate(): string {
  return new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
}

export function gibsUrl(date: string): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/${date}/${GIBS_MATRIX}/{z}/{y}/{x}.jpg`;
}

export function basemapDefinition(id: BasemapId, date = gibsDate()): BasemapDefinition {
  switch (id) {
    case "street":
      return {
        id,
        label: "Street map",
        source: "OpenStreetMap",
        resolution: "Community street detail, to 19 zoom levels",
        attribution: OSM_ATTRIBUTION,
        url: OSM_URL,
        maxZoom: 19,
        darkFilter: true,
      };
    case "gibs":
      return {
        id,
        label: "NASA daily imagery",
        source: "NASA GIBS · MODIS Terra",
        resolution: "250 m · true colour · about 3-day lag",
        attribution: `Imagery &copy; <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> · ${date}`,
        url: gibsUrl(date),
        maxZoom: 18,
        maxNativeZoom: 9,
      };
    case "satellite":
    default:
      return {
        id: "satellite",
        label: "Satellite imagery",
        source: "Esri World Imagery",
        resolution: "≈0.3–0.6 m where high-resolution coverage exists",
        attribution: ESRI_ATTRIBUTION,
        url: ESRI_URL,
        maxZoom: 19,
      };
  }
}

/** The backend marks a probe stale after six hours without a reading. */
export const FRESH_WINDOW_MS = 6 * 60 * 60 * 1000;

export const MAP_COLORS = {
  boundary: "#2f7d5b",
  boundaryFill: "#5b977a",
  boundaryMuted: "#7d9c8b",
  robotLive: "#1b4e3a",
  robotStale: "#8a7a67",
  pathLive: "#2f7d5b",
  pathHistory: "#9aa89f",
  ndviAttribution: "Sentinel-2 NDVI &copy; Google Earth Engine",
};

export const NDVI_OPACITY = 0.72;
