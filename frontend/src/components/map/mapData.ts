/**
 * Turns the existing field + sensor API responses into the small shapes the
 * map renders. Nothing is calculated or invented here: positions are the GPS
 * values the robot sent, and a marker is drawn only when a reading has one.
 */

import type { Field, FieldSensors, SensorReading } from "../../api/types";
import { FRESH_WINDOW_MS } from "./mapConfig";

export type SensorMetricKey = "soil_moisture" | "air_temperature" | "humidity" | "distance";

export interface SensorMetric {
  key: SensorMetricKey;
  value: number;
  unit: string;
}

export interface SensorNode {
  /** Stable key across polls: sensor id, or the device when no id was sent. */
  key: string;
  fieldId: number;
  label: string;
  deviceLabel: string;
  latitude: number;
  longitude: number;
  measuredAt: string;
  status: string;
  metrics: SensorMetric[];
  primary: SensorMetricKey;
}

export interface RobotTrackPoint {
  latitude: number;
  longitude: number;
  measuredAt: string;
}

export interface FieldLayerEntry {
  field: Field;
  nodes: SensorNode[];
  track: RobotTrackPoint[];
  latestGps: RobotTrackPoint | null;
  lastMeasurementAt: string | null;
  online: boolean;
  devices: number;
}

export const SENSOR_METRICS: Record<
  SensorMetricKey,
  { label: string; unit: string; decimals: number; color: string }
> = {
  soil_moisture: { label: "Soil moisture", unit: "%", decimals: 1, color: "#2f6f8f" },
  air_temperature: { label: "Air temperature", unit: "°C", decimals: 1, color: "#b4693a" },
  humidity: { label: "Humidity", unit: "%", decimals: 0, color: "#3c7a63" },
  distance: { label: "Distance", unit: "cm", decimals: 0, color: "#7a6f61" },
};

const METRIC_ORDER: SensorMetricKey[] = [
  "soil_moisture",
  "air_temperature",
  "humidity",
  "distance",
];

export function metricsFor(reading: SensorReading): SensorMetric[] {
  const values: Array<[SensorMetricKey, number | null | undefined]> = [
    ["soil_moisture", reading.soil_moisture_pct],
    ["air_temperature", reading.air_temp_c],
    ["humidity", reading.humidity_pct],
    ["distance", reading.distance_cm],
  ];
  return values
    .filter((entry): entry is [SensorMetricKey, number] => entry[1] !== null && entry[1] !== undefined)
    .map(([key, value]) => ({ key, value, unit: SENSOR_METRICS[key].unit }));
}

export function hasGps(reading: SensorReading): boolean {
  return reading.latitude !== null && reading.latitude !== undefined &&
    reading.longitude !== null && reading.longitude !== undefined;
}

export function isFresh(iso: string | null, now = Date.now()): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && now - time <= FRESH_WINDOW_MS;
}

export function minutesAgo(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.round((now - time) / 60000));
}

/** Build one render entry per field from `/fields` and `/fields/{id}/sensors`. */
export function buildFieldEntry(field: Field, sensors: FieldSensors | null): FieldLayerEntry {
  const readings = sensors?.readings ?? [];
  const deviceLabels = new Map((sensors?.devices ?? []).map((device) => [device.id, device.label]));

  const gpsReadings = readings.filter(hasGps);
  const track = gpsReadings
    .slice()
    .sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at))
    .map<RobotTrackPoint>((reading) => ({
      latitude: reading.latitude as number,
      longitude: reading.longitude as number,
      measuredAt: reading.measured_at,
    }));

  // Readings arrive newest first. The first reading per sensor that carries a
  // GPS position is the one shown; older positions stay in the path only.
  const seen = new Set<string>();
  const nodes: SensorNode[] = [];
  for (const reading of gpsReadings) {
    const key = reading.sensor_id ?? `device-${reading.device_id}`;
    if (seen.has(key)) continue;
    const metrics = metricsFor(reading);
    if (metrics.length === 0) continue;
    seen.add(key);
    nodes.push({
      key: `${field.id}-${key}`,
      fieldId: field.id,
      label: reading.sensor_id ?? deviceLabels.get(reading.device_id) ?? `Robot ${reading.device_id}`,
      deviceLabel: deviceLabels.get(reading.device_id) ?? "Field robot",
      latitude: reading.latitude as number,
      longitude: reading.longitude as number,
      measuredAt: reading.measured_at,
      status: reading.status ?? "ok",
      metrics,
      primary: METRIC_ORDER.find((metric) => metrics.some((entry) => entry.key === metric)) ?? "soil_moisture",
    });
  }

  const lastMeasurementAt = readings.length
    ? readings
        .map((reading) => reading.measured_at)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
    : null;
  const latestGps = track.length ? track[track.length - 1] : null;

  return {
    field,
    nodes,
    track,
    latestGps,
    lastMeasurementAt,
    online: isFresh(lastMeasurementAt),
    devices: sensors?.devices.length ?? 0,
  };
}
