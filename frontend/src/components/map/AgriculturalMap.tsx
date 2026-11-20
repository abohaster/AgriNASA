import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { latLngBounds, type Map as LeafletMap } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useTheme } from "../../context/ThemeContext";
import { useI18n } from "../../i18n/I18nContext";
import { formatDateTime, formatNumber } from "../../lib/format";
import { FieldBoundary } from "./FieldBoundary";
import { MapLayerControl, type MapOverlays, type NdviLayerState } from "./MapLayerControl";
import { MapLegend } from "./MapLegend";
import { RobotMarker } from "./RobotMarker";
import { RobotPath } from "./RobotPath";
import { SensorMarker } from "./SensorMarker";
import { type FieldLayerEntry } from "./mapData";
import { basemapDefinition, type BasemapId } from "./mapConfig";

const FALLBACK_CENTRE: [number, number] = [26.82, 30.8];

export interface MapSummary {
  fields: number;
  totalAreaHa: number;
  sensors: number;
  onlineRobots: number;
  lastReadingAt: string | null;
}

export interface MapFocus {
  latitude: number;
  longitude: number;
  zoom: number;
  token: number;
}

function collectRing(value: unknown, out: Array<[number, number]>): void {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    out.push([value[1], value[0]]);
    return;
  }
  for (const item of value) collectRing(item, out);
}

/** All coordinates that should be inside the initial fit. */
function entryBoundsPoints(entries: FieldLayerEntry[]): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (const entry of entries) {
    points.push([entry.field.latitude, entry.field.longitude]);
    const boundary = entry.field.boundary_geojson as Record<string, unknown> | null;
    if (boundary) {
      const geometry = (boundary.geometry as Record<string, unknown> | undefined) ?? boundary;
      collectRing(geometry.coordinates, points);
    }
    for (const point of entry.track) points.push([point.latitude, point.longitude]);
  }
  return points;
}

function ClickPicker({ onPick }: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/** Fit the view when the field set first arrives or the page asks for a reset. */
function FitFields({ points, resetToken }: { points: Array<[number, number]>; resetToken: number }) {
  const map = useMap();
  const key = points.map((point) => `${point[0].toFixed(5)},${point[1].toFixed(5)}`).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(latLngBounds(points), { padding: [48, 48], maxZoom: 16, animate: false });
    // The string key is the stable identity of the point set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, resetToken, map]);

  return null;
}

function FocusField({ focus }: { focus: MapFocus | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.latitude, focus.longitude], focus.zoom, { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.token, map]);
  return null;
}

/** Keep Leaflet sized correctly after the fullscreen element changes size. */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const parent = map.getContainer().parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(parent);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function ControlButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-paper/95 text-ink shadow-sm backdrop-blur transition-colors hover:border-forest-300 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * The interactive agricultural map.
 *
 * It is deliberately a composition of small components: basemap tiles, saved
 * field boundaries, robot GPS trail and markers, sensor nodes and floating
 * controls. All positions come from the backend; nothing is animated to fake a
 * moving robot. NDVI is an overlay that exists only when real Sentinel-2 tiles
 * were returned for the selected field.
 */
export function AgriculturalMap({
  entries,
  selectedFieldId,
  onSelectField,
  basemap,
  onBasemapChange,
  overlays,
  onToggleOverlay,
  ndvi,
  ndviEnabled,
  onToggleNdvi,
  onLoadNdvi,
  canLoadNdvi,
  selectedFieldName,
  drawing,
  draftPoints,
  pickedPoint,
  onMapClick,
  focus,
  summary,
  height = 620,
}: {
  entries: FieldLayerEntry[];
  selectedFieldId: number | null;
  onSelectField: (fieldId: number) => void;
  basemap: BasemapId;
  onBasemapChange: (id: BasemapId) => void;
  overlays: MapOverlays;
  onToggleOverlay: (key: keyof MapOverlays, value: boolean) => void;
  ndvi: NdviLayerState;
  ndviEnabled: boolean;
  onToggleNdvi: (value: boolean) => void;
  onLoadNdvi: () => void;
  canLoadNdvi: boolean;
  selectedFieldName: string | null;
  drawing: boolean;
  draftPoints: Array<[number, number]>;
  /** Coordinate selected for the weather preview; draws a neutral marker. */
  pickedPoint: [number, number] | null;
  onMapClick: (latitude: number, longitude: number) => void;
  focus: MapFocus | null;
  summary: MapSummary;
  height?: number;
}) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const shellRef = useRef<HTMLDivElement>(null);

  const base = basemapDefinition(basemap);
  const boundsPoints = useMemo(() => entryBoundsPoints(entries), [entries]);
  const initialCenter = useMemo<[number, number]>(
    () => (entries.length ? [entries[0].field.latitude, entries[0].field.longitude] : FALLBACK_CENTRE),
    [entries],
  );
  const sensorTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const entry of entries) for (const node of entry.nodes) seen.add(node.primary);
    return Array.from(seen) as FieldLayerEntry["nodes"][number]["primary"][];
  }, [entries]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const target = shellRef.current;
    if (!target?.requestFullscreen) return;
    void target.requestFullscreen().catch(() => setFullscreen(false));
  }

  function resetView() {
    if (boundsPoints.length === 0) {
      map?.setView(FALLBACK_CENTRE, 6);
      return;
    }
    setResetToken((token) => token + 1);
  }

  const selectedEntry = entries.find((entry) => entry.field.id === selectedFieldId) ?? null;

  return (
    <div
      ref={shellRef}
      className="map-shell relative isolate overflow-hidden bg-sage-100"
      style={fullscreen ? undefined : { height }}
    >
      <MapContainer
        ref={setMap}
        center={initialCenter}
        zoom={entries.length ? 13 : 6}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom
        style={{ height: "100%", width: "100%" }}
        aria-label={t("Agricultural map")}
      >
        <TileLayer
          key={`${base.id}-${base.url}`}
          url={base.url}
          attribution={base.attribution}
          maxZoom={base.maxZoom}
          maxNativeZoom={base.maxNativeZoom}
          opacity={1}
          className={isDark && base.darkFilter ? "map-tiles-dark" : undefined}
        />

        {ndviEnabled && ndvi.tile && (
          <TileLayer
            key={`ndvi-${ndvi.tile.url}`}
            url={ndvi.tile.url}
            attribution={ndvi.tile.attribution}
            maxZoom={19}
            opacity={0.72}
          />
        )}

        {overlays.boundaries &&
          entries.map((entry) => (
            <FieldBoundary
              key={entry.field.id}
              entry={entry}
              selected={entry.field.id === selectedFieldId}
              onSelect={onSelectField}
            />
          ))}

        {overlays.robot &&
          entries.map((entry) => (
            <RobotPath key={`path-${entry.field.id}`} points={entry.track} fieldName={entry.field.name} />
          ))}

        {overlays.robot &&
          entries.map((entry) =>
            entry.latestGps ? (
              <RobotMarker
                key={`robot-${entry.field.id}`}
                point={entry.latestGps}
                online={entry.online}
                fieldId={entry.field.id}
                fieldName={entry.field.name}
                lastMeasurementAt={entry.lastMeasurementAt}
              />
            ) : null,
          )}

        {overlays.sensors &&
          entries.map((entry) =>
            entry.nodes.map((node) => (
              <SensorMarker key={node.key} node={node} fieldName={entry.field.name} />
            )),
          )}

        {pickedPoint && (
          <CircleMarker
            center={pickedPoint}
            radius={8}
            pathOptions={{
              color: "#2f7d5b",
              weight: 2,
              fillColor: "#fbfbf7",
              fillOpacity: 1,
              bubblingMouseEvents: false,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {t("Selected point")}
            </Tooltip>
          </CircleMarker>
        )}

        {draftPoints.length >= 3 ? (
          <Polygon
            positions={draftPoints}
            pathOptions={{
              color: "#2f7d5b",
              weight: 2,
              fillColor: "#5b977a",
              fillOpacity: 0.25,
              bubblingMouseEvents: false,
            }}
          />
        ) : draftPoints.length === 2 ? (
          <Polyline
            positions={draftPoints}
            pathOptions={{ color: "#2f7d5b", weight: 2, dashArray: "5 4" }}
          />
        ) : null}

        {draftPoints.map((point, index) => (
          <CircleMarker
            key={`corner-${index}-${point[0]}-${point[1]}`}
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

        <FitFields points={boundsPoints} resetToken={resetToken} />
        <FocusField focus={focus} />
        <AutoResize />
        <ClickPicker onPick={onMapClick} />
      </MapContainer>

      {/* Floating overview card */}
      <div className="pointer-events-none absolute start-3 top-3 z-[600] hidden w-[14.5rem] sm:block">
        <div className="rounded-lg border border-line bg-paper/95 px-3 py-2 shadow-card backdrop-blur">
          <p className="eyebrow mb-1">{t("Map overview")}</p>
          <dl className="space-y-1 text-2xs">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">{t("Field area")}</dt>
              <dd className="font-mono text-ink" dir="ltr">
                {formatNumber(summary.totalAreaHa, 1)} ha
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">{t("Fields")}</dt>
              <dd className="text-ink">{summary.fields}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">{t("Sensors")}</dt>
              <dd className="text-ink">{summary.sensors}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">{t("Robot status")}</dt>
              <dd className="text-end text-ink">
                {summary.onlineRobots > 0
                  ? t("{n} online", { n: summary.onlineRobots })
                  : t("No live feed")}
              </dd>
            </div>
            {summary.lastReadingAt && (
              <div className="border-t border-line pt-1">
                <dt className="text-muted">{t("Latest reading")}</dt>
                <dd className="text-ink">{formatDateTime(summary.lastReadingAt)}</dd>
              </div>
            )}
          </dl>
          {selectedEntry && (
            <p className="mt-1 border-t border-line pt-1 text-2xs font-medium text-ink">
              {selectedEntry.field.name}
            </p>
          )}
        </div>
      </div>

      {/* Layer selector, top-end (right in LTR, left in RTL). The max height
          keeps the expanded panel above the controls at the bottom. */}
      <div className="absolute end-3 top-3 z-[600] flex max-h-[calc(100%-5rem)] flex-col">
        <MapLayerControl
          basemap={basemap}
          onBasemapChange={onBasemapChange}
          overlays={overlays}
          onToggleOverlay={onToggleOverlay}
          ndvi={ndvi}
          ndviEnabled={ndviEnabled}
          onToggleNdvi={onToggleNdvi}
          onLoadNdvi={onLoadNdvi}
          canLoadNdvi={canLoadNdvi}
          selectedFieldName={selectedFieldName}
        />
      </div>

      <div className="absolute bottom-8 start-3 z-[600] hidden md:block">
        <MapLegend
          basemap={basemap}
          overlays={overlays}
          sensorTypes={sensorTypes}
          ndviActive={ndviEnabled && Boolean(ndvi.tile)}
          ndviDate={ndvi.acquisitionDate}
        />
      </div>

      {/* Custom controls stay outside Leaflet's own control container. */}
      <div className="absolute bottom-8 end-3 z-[600] flex flex-row gap-1.5">
        <ControlButton label={t("Zoom in")} onClick={() => map?.zoomIn()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </ControlButton>
        <ControlButton label={t("Zoom out")} onClick={() => map?.zoomOut()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </ControlButton>
        <ControlButton label={t("Reset view")} onClick={resetView}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2.3-5.7" />
            <path d="M4 4v4h4" />
          </svg>
        </ControlButton>
        <ControlButton
          label={fullscreen ? t("Exit fullscreen") : t("Fullscreen")}
          onClick={toggleFullscreen}
        >
          {fullscreen ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          )}
        </ControlButton>
      </div>

      {drawing && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[550] flex justify-center sm:top-auto sm:bottom-8">
          <p className="rounded-md border border-clay-200 bg-clay-50/95 px-3 py-1 text-2xs font-medium text-clay-600 shadow-sm backdrop-blur">
            {t("Click the map to add a corner. The outline is saved only after you analyse it.")}
          </p>
        </div>
      )}

      {entries.length === 0 && (
        <div className="pointer-events-none absolute inset-x-6 bottom-10 z-[550] flex justify-center">
          <p className="rounded-md border border-line bg-paper/95 px-3 py-2 text-center text-xs text-muted shadow-card backdrop-blur">
            {t("No saved fields yet. Search, draw a boundary, or create a field to see it here.")}
          </p>
        </div>
      )}
    </div>
  );
}
