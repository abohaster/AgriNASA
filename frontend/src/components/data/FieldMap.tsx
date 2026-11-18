import { useEffect, useMemo, useState } from "react";
import type { GeoJsonObject } from "geojson";
import { useTheme } from "../../context/ThemeContext";
import { useI18n } from "../../i18n/I18nContext";
import {
  Circle,
  CircleMarker,
  GeoJSON,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// NASA GIBS WMTS tile pattern. The date is selected three days ago because
// near-real-time imagery can lag; it is visual context only, never measured.
const GIBS_LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";
const GIBS_MATRIX = "GoogleMapsCompatible_Level9";

/** Keep the map centred when coordinates or the requested zoom change. */
function Recenter({
  latitude,
  longitude,
  zoom,
}: {
  latitude: number;
  longitude: number;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], zoom, { animate: false });
  }, [latitude, longitude, zoom, map]);
  return null;
}

/** Converts map clicks into coordinates for the point picker or the boundary draw tool. */
function ClickPicker({ onPick }: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function threeDaysAgo(): string {
  return new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Field map with honest geometry.
 *
 * - A coordinate-only field is shown as a point. No polygon is invented.
 * - If a real GeoJSON boundary exists it is drawn; otherwise an optional circle
 *   can indicate the stated area, clearly labelled as an approximation.
 * - In drawing mode, `draftPoints` are the corners the user clicked. They are
 *   joined in order and become a polygon only after the fourth corner.
 * - The NASA GIBS overlay is satellite imagery for orientation. The UI never
 *   reads values from it, and it can be switched off.
 */
export function FieldMap({
  latitude,
  longitude,
  label,
  boundary,
  areaHa,
  height = 320,
  onPick,
  onAddDraftPoint,
  draftPoints = [],
  allowGibs = false,
  showMarker = true,
  zoom = 12,
  className = "",
}: {
  latitude: number;
  longitude: number;
  label?: string | null;
  boundary?: Record<string, unknown> | null;
  areaHa?: number | null;
  height?: number;
  onPick?: (latitude: number, longitude: number) => void;
  /** When provided, clicks append a corner to the outline instead of moving the point. */
  onAddDraftPoint?: (latitude: number, longitude: number) => void;
  draftPoints?: Array<[number, number]>;
  allowGibs?: boolean;
  /** Hide the marker while a new field has no coordinates yet. */
  showMarker?: boolean;
  zoom?: number;
  className?: string;
}) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [showGibs, setShowGibs] = useState(false);
  const [gibsDate] = useState(threeDaysAgo);
  const boundaryColor = isDark ? "#7fd3a9" : "#1b4e3a";
  const boundaryFill = isDark ? "#3f8f6b" : "#5b977a";
  const gibsUrl = useMemo(
    () =>
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/${gibsDate}/${GIBS_MATRIX}/{z}/{y}/{x}.jpg`,
    [gibsDate],
  );

  const areaRadiusM = areaHa ? Math.sqrt((areaHa * 10_000) / Math.PI) : null;
  const hasBoundary = Boolean(boundary);
  const hasDraft = draftPoints.length > 0;
  const clickHandler = onAddDraftPoint ?? onPick;

  return (
    <div className={`relative overflow-hidden rounded-md border border-line ${className}`}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height, width: "100%" }}
        aria-label={label ? t("Map showing {name}", { name: label }) : t("Field location map")}
      >
        <TileLayer
          url={OSM_URL}
          attribution={OSM_ATTRIBUTION}
          maxZoom={19}
          className={isDark ? "map-tiles-dark" : undefined}
        />
        {allowGibs && showGibs && (
          <TileLayer
            url={gibsUrl}
            attribution='Imagery &copy; <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>'
            maxNativeZoom={9}
            maxZoom={18}
            opacity={0.85}
          />
        )}

        <Recenter latitude={latitude} longitude={longitude} zoom={zoom} />
        {clickHandler && <ClickPicker onPick={clickHandler} />}

        {draftPoints.length >= 3 ? (
          <Polygon
            positions={draftPoints}
            pathOptions={{
              color: boundaryColor,
              weight: 2,
              fillColor: boundaryFill,
              fillOpacity: 0.25,
            }}
          />
        ) : draftPoints.length === 2 ? (
          <Polyline
            positions={draftPoints}
            pathOptions={{ color: boundaryColor, weight: 2, dashArray: "5 4" }}
          />
        ) : null}

        {draftPoints.map((point, index) => (
          <CircleMarker
            key={`${point[0].toFixed(6)}-${point[1].toFixed(6)}-${index}`}
            center={point}
            radius={6}
            pathOptions={{
              color: isDark ? "#e2ede7" : "#0f2e23",
              weight: 2,
              fillColor: isDark ? "#121b17" : "#fbfbf7",
              fillOpacity: 1,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -7]}>
              {t("Corner {n}", { n: index + 1 })}
            </Tooltip>
          </CircleMarker>
        ))}

        {hasBoundary ? (
          <GeoJSON
            key={JSON.stringify(boundary)}
            data={boundary as unknown as GeoJsonObject}
            style={{
              color: boundaryColor,
              weight: 2,
              fillColor: boundaryFill,
              fillOpacity: 0.25,
            }}
          />
        ) : hasDraft ? null : showMarker ? (
          <CircleMarker
            center={[latitude, longitude]}
            radius={7}
            pathOptions={{
              color: boundaryColor,
              weight: 2,
              fillColor: boundaryFill,
              fillOpacity: 0.9,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {t("{name} — coordinate only, no boundary supplied", {
                name: label ?? t("Field point"),
              })}
            </Tooltip>
          </CircleMarker>
        ) : null}

        {areaRadiusM !== null && !hasBoundary && !hasDraft && showMarker && (
          <Circle
            center={[latitude, longitude]}
            radius={areaRadiusM}
            pathOptions={{
              color: "#357a94",
              weight: 1,
              dashArray: "4 4",
              fillColor: "#357a94",
              fillOpacity: 0.05,
            }}
          >
            <Tooltip direction="top">
              {t("Approximate extent for {n} ha — not a surveyed field boundary", {
                n: areaHa ?? "—",
              })}
            </Tooltip>
          </Circle>
        )}
      </MapContainer>

      <div className="absolute end-2 top-2 z-[500] flex flex-col items-end gap-1">
        {allowGibs && (
          <button
            type="button"
            onClick={() => setShowGibs((value) => !value)}
            aria-pressed={showGibs}
            className="rounded border border-line bg-paper/95 px-2 py-1 text-2xs font-medium text-ink shadow-sm backdrop-blur hover:border-forest-300"
          >
            {showGibs ? t("Hide NASA imagery") : t("NASA satellite imagery")}
          </button>
        )}
      </div>

      {showGibs && allowGibs && (
        <p className="absolute bottom-6 start-2 z-[500] max-w-[16rem] rounded bg-paper/95 px-2 py-1 text-[10px] leading-snug text-muted shadow-sm backdrop-blur">
          {t(
            "NASA GIBS true-colour imagery ({date}). Visual context only — no values are read from it.",
            { date: gibsDate },
          )}
        </p>
      )}
    </div>
  );
}
