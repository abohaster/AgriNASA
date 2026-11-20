import { divIcon, type DivIcon } from "leaflet";
import type { SensorMetricKey } from "./mapData";

const SENSOR_GLYPHS: Record<SensorMetricKey, string> = {
  soil_moisture:
    '<path d="M12 3.5c3.2 3.8 6 7 6 10.2a6 6 0 0 1-12 0C6 10.5 8.8 7.3 12 3.5Z"/><path d="M9.5 14.2a2.6 2.6 0 0 0 2.5 2.6"/>',
  air_temperature:
    '<path d="M10 14.8V5a2 2 0 1 1 4 0v9.8a4 4 0 1 1-4 0Z"/><path d="M12 9v6"/>',
  humidity:
    '<path d="M4 15c2.5-2 5-2 7.5 0s5 2 7.5 0"/><path d="M4 9c2.5-2 5-2 7.5 0s5 2 7.5 0"/>',
  distance:
    '<path d="M4 17 17 4"/><path d="m4 13 3 3"/><path d="m8 9 3 3"/><path d="m12 5 3 3"/><path d="M14 20h6"/>',
};

/**
 * Coloured pin for one sensor node. The colour and glyph identify the metric
 * type; the value is only shown in the tooltip/popup, never squeezed into a
 * marker where it would be unreadable on a phone.
 */
export function sensorIcon(metric: SensorMetricKey): DivIcon {
  return divIcon({
    className: "agri-map-icon",
    html: `<span class="agri-sensor agri-sensor--${metric}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SENSOR_GLYPHS[metric]}</svg></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -18],
  });
}

const ROBOT_GLYPH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 8V4.5"/><circle cx="12" cy="3.5" r="1.2"/><path d="M8.5 13h.01M15.5 13h.01"/><path d="M9 16.5h6"/><path d="M2.5 12v3M21.5 12v3"/></svg>';

/**
 * Custom robot marker. The marker is filled forest-green and pulses only while
 * the latest reading is inside the six-hour freshness window; a stale robot is
 * beige and still, so a paused feed can never look live.
 */
export function robotIcon(online: boolean): DivIcon {
  return divIcon({
    className: "agri-map-icon",
    html: `<span class="agri-robot ${online ? "is-live" : "is-stale"}">${ROBOT_GLYPH}${online ? '<span class="agri-robot__pulse" aria-hidden="true"></span>' : ""}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  });
}
