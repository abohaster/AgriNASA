/**
 * Small, dependency-free geometry helpers for user-drawn field outlines.
 *
 * Points are always [latitude, longitude] in the UI (Leaflet order) and are
 * converted to GeoJSON's [longitude, latitude] only at the API boundary.
 * The area formula is the standard spherical-excess approximation used by
 * mapping libraries; it is accurate enough for field-sized polygons and is
 * deliberately labelled as an estimate in the UI.
 */

export type LatLon = [number, number];

const EARTH_RADIUS_M = 6_378_137;
const HECTARE_M2 = 10_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Geodesic area of an open ring in hectares; null when fewer than 3 corners. */
export function ringAreaHectares(points: LatLon[]): number | null {
  if (points.length < 3) return null;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [lat1, lon1] = points[index];
    const [lat2, lon2] = points[(index + 1) % points.length];
    sum +=
      toRadians(lon2 - lon1) *
      (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
  }
  const areaM2 = Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
  return areaM2 / HECTARE_M2;
}

/** Polygon centroid in [latitude, longitude]; average of corners as fallback. */
export function ringCentroid(points: LatLon[]): LatLon | null {
  if (points.length === 0) return null;
  if (points.length < 3) {
    const lat = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const lon = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    return [lat, lon];
  }

  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [lat1, lon1] = points[index];
    const [lat2, lon2] = points[(index + 1) % points.length];
    const cross = lon1 * lat2 - lon2 * lat1;
    twiceArea += cross;
    x += (lon1 + lon2) * cross;
    y += (lat1 + lat2) * cross;
  }

  if (Math.abs(twiceArea) < 1e-12) {
    const lat = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const lon = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    return [lat, lon];
  }

  return [y / (3 * twiceArea), x / (3 * twiceArea)];
}

/**
 * True when no two non-adjacent edges cross. Four map clicks can easily make a
 * bow-tie; rejecting it prevents storing an outline that renders incorrectly.
 */
export function isSimpleRing(points: LatLon[]): boolean {
  if (points.length < 4) return true;
  const count = points.length;
  for (let first = 0; first < count; first += 1) {
    const firstNext = (first + 1) % count;
    for (let second = first + 1; second < count; second += 1) {
      const secondNext = (second + 1) % count;
      if (
        first === second ||
        firstNext === second ||
        secondNext === first
      ) {
        continue;
      }
      if (
        segmentsIntersect(
          points[first],
          points[firstNext],
          points[second],
          points[secondNext],
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

/** GeoJSON Polygon from an open [lat, lon] ring, closing it exactly. */
export function geoJsonPolygon(points: LatLon[]): {
  type: "Polygon";
  coordinates: number[][][];
} {
  const ring = points.map(([lat, lon]) => [lon, lat]);
  const [firstLon, firstLat] = ring[0];
  ring.push([firstLon, firstLat]);
  return { type: "Polygon", coordinates: [ring] };
}

function segmentsIntersect(a: LatLon, b: LatLon, c: LatLon, d: LatLon): boolean {
  const orientation = (p: LatLon, q: LatLon, r: LatLon) => {
    const value = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
    const epsilon = 1e-12;
    if (Math.abs(value) <= epsilon) return 0;
    return value > 0 ? 1 : -1;
  };

  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 !== o2 && o3 !== o4;
}
