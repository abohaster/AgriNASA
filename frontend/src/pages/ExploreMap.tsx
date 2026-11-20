import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type {
  FieldSensors,
  GeocodeResult,
  LocationOverview,
  SatelliteLayerTile,
} from "../api/types";
import { AgriculturalMap, type MapFocus, type MapSummary } from "../components/map/AgriculturalMap";
import type { MapOverlays, NdviLayerState } from "../components/map/MapLayerControl";
import { FieldInformationPanel } from "../components/map/FieldInformationPanel";
import {
  buildFieldEntry,
  type FieldLayerEntry,
} from "../components/map/mapData";
import type { BasemapId } from "../components/map/mapConfig";
import { SourceBadges } from "../components/location/LocationHeader";
import { ErrorState, LoadingState } from "../components/ui/AsyncState";
import { InfoNote } from "../components/ui/InfoNote";
import { SectionHeading } from "../components/ui/SectionHeading";
import { StatusPill } from "../components/ui/StatusPill";
import {
  ArrowRightIcon,
  CheckIcon,
  LayersIcon,
  MapPinIcon,
  SearchIcon,
} from "../components/ui/Icons";
import { useAsync } from "../hooks/useAsync";
import { useI18n } from "../i18n/I18nContext";
import { addDaysIso, formatNumber, todayIso } from "../lib/format";
import {
  geoJsonPolygon,
  isSimpleRing,
  ringAreaHectares,
  ringCentroid,
  type LatLon,
} from "../lib/geo";
import { rememberLocation, saveExploreGeometry } from "../lib/location";

const MAX_CORNERS = 24;
const ALERT_TONE = { high: "bad", moderate: "warn", info: "info" } as const;
const IDLE_NDVI: NdviLayerState = {
  status: "idle",
  tile: null,
  acquisitionDate: null,
  message: null,
};

function alertTone(level: "info" | "moderate" | "high") {
  return ALERT_TONE[level];
}

/**
 * Map-first workspace.
 *
 * The map draws saved field boundaries, sensor nodes and the robot's stored GPS
 * trail. Clicking the map still selects a coordinate for analysis, and drawing
 * mode still turns clicked corners into a saved outline. NDVI is loaded on
 * demand from Earth Engine and appears only when real Sentinel-2 tiles exist.
 * Nothing on this page invents a boundary, a position or a satellite value.
 */
export function ExploreMapPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [point, setPoint] = useState<LatLon | null>(null);
  const [pointLabel, setPointLabel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<LatLon[]>([]);

  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const focusCounter = useRef(0);

  const [basemap, setBasemap] = useState<BasemapId>("satellite");
  const [overlays, setOverlays] = useState<MapOverlays>({
    boundaries: true,
    sensors: true,
    robot: true,
  });
  const [ndvi, setNdvi] = useState<NdviLayerState>(IDLE_NDVI);
  const [ndviEnabled, setNdviEnabled] = useState(false);
  const ndviRequest = useRef(0);

  const draftAreaHa = ringAreaHectares(draftPoints);
  const draftCentre = ringCentroid(draftPoints);
  const ringValid = draftPoints.length >= 3 && isSimpleRing(draftPoints);
  const draftBlocked = draftPoints.length >= MAX_CORNERS;

  // Fields and their sensor history are loaded together so markers and the
  // side panel always describe the same readings.
  const fieldsState = useAsync<FieldLayerEntry[]>(async (signal) => {
    const fields = await api.listFields(signal);
    const sensorSets = await Promise.all(
      fields.map(async (field) => {
        try {
          return await api.fieldSensors(field.id, signal);
        } catch (error) {
          if (signal.aborted) throw error;
          return null;
        }
      }),
    );
    return fields.map((field, index) =>
      buildFieldEntry(field, sensorSets[index] as FieldSensors | null),
    );
  }, []);

  const entries = fieldsState.data ?? [];
  const selectedEntry = entries.find((entry) => entry.field.id === selectedFieldId) ?? null;

  const summary = useMemo<MapSummary>(() => {
    const totalAreaHa = entries.reduce((sum, entry) => sum + (entry.field.area_ha ?? 0), 0);
    const sensors = entries.reduce((sum, entry) => sum + entry.nodes.length, 0);
    const onlineRobots = entries.filter((entry) => entry.online).length;
    const lastReadingAt =
      entries
        .map((entry) => entry.lastMeasurementAt)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
    return { fields: entries.length, totalAreaHa, sensors, onlineRobots, lastReadingAt };
  }, [entries]);

  const preview = useAsync<LocationOverview | null>(
    (signal) =>
      point && !drawing
        ? api.locationOverview(point[0], point[1], { label: pointLabel ?? undefined, signal })
        : Promise.resolve(null),
    [point?.[0], point?.[1], pointLabel, drawing],
  );

  useEffect(() => {
    ndviRequest.current += 1;
    setNdvi(IDLE_NDVI);
    setNdviEnabled(false);
  }, [selectedFieldId]);

  function focusOn(latitude: number, longitude: number, zoom: number) {
    focusCounter.current += 1;
    setFocus({ latitude, longitude, zoom, token: focusCounter.current });
  }

  function selectField(fieldId: number) {
    const entry = entries.find((candidate) => candidate.field.id === fieldId);
    setSelectedFieldId(fieldId);
    setPoint(null);
    setPointLabel(null);
    setDrawing(false);
    setDraftPoints([]);
    setNotice(null);
    if (entry) {
      focusOn(
        entry.field.latitude,
        entry.field.longitude,
        entry.field.boundary_geojson ? 16 : 15,
      );
    }
  }

  function selectPoint(latitude: number, longitude: number, label: string | null) {
    const next: LatLon = [latitude, longitude];
    setPoint(next);
    setPointLabel(label);
    setSelectedFieldId(null);
    setDrawing(false);
    setDraftPoints([]);
    setSearchResults([]);
    setSearchMessage(null);
    setNotice(null);
    rememberLocation({ latitude, longitude, label });
    focusOn(latitude, longitude, 13);
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchMessage("Enter at least two characters to search.");
      return;
    }
    setSearching(true);
    setSearchMessage(null);
    setSearchResults([]);
    try {
      const results = await api.geocodeSearch(query);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchMessage("No matching place found. Try a nearby town, or click the map directly.");
      }
    } catch (error) {
      setSearchMessage(error instanceof Error ? error.message : "Location search is unavailable.");
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setNotice("This browser does not provide a location.");
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        selectPoint(position.coords.latitude, position.coords.longitude, "My location");
      },
      () => {
        setLocating(false);
        setNotice("The browser could not determine your position. You can click the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function toggleDrawing() {
    const next = !drawing;
    setDrawing(next);
    setDraftPoints([]);
    setNotice(null);
    if (next) {
      setSelectedFieldId(null);
      setPoint(null);
      setPointLabel(null);
    }
  }

  function addCorner(latitude: number, longitude: number) {
    if (draftBlocked) {
      setNotice(`A field outline can have at most ${MAX_CORNERS} corners here.`);
      return;
    }
    setDraftPoints((current) => [...current, [latitude, longitude] as LatLon]);
    setNotice(null);
  }

  function analyseDrawing() {
    if (!ringValid || !draftCentre) return;
    const geometry = geoJsonPolygon(draftPoints) as unknown as Record<string, unknown>;
    saveExploreGeometry({
      geometry,
      latitude: draftCentre[0],
      longitude: draftCentre[1],
      areaHa: draftAreaHa,
      label: null,
    });
    rememberLocation({ latitude: draftCentre[0], longitude: draftCentre[1], label: null });
    const params = new URLSearchParams({
      lat: String(draftCentre[0]),
      lon: String(draftCentre[1]),
      area: "1",
    });
    navigate(`/location?${params.toString()}`);
  }

  async function loadNdvi() {
    if (!selectedFieldId) return;
    const requestId = ndviRequest.current + 1;
    ndviRequest.current = requestId;
    setNdvi({ status: "loading", tile: null, acquisitionDate: null, message: null });
    try {
      const end = todayIso();
      const analysis = await api.satelliteField(selectedFieldId, {
        start: addDaysIso(end, -30),
        end,
        max_cloud_percent: 30,
        buffer_km: 0.5,
        include_tiles: true,
      });
      if (requestId !== ndviRequest.current) return;
      const tile: SatelliteLayerTile | null = analysis.tiles.ndvi;
      if (!tile) {
        setNdvi({
          status: "error",
          tile: null,
          acquisitionDate: null,
          message:
            "Earth Engine returned no NDVI tile for this field in the last 30 days. Try again later or check the Satellite page.",
        });
        return;
      }
      setNdvi({
        status: "ready",
        tile,
        acquisitionDate: analysis.vegetation.acquisition_date,
        message: null,
      });
      setNdviEnabled(true);
    } catch (error) {
      if (requestId !== ndviRequest.current) return;
      const detail =
        error instanceof ApiError
          ? [error.message, error.details].filter(Boolean).join(" ")
          : error instanceof Error
            ? error.message
            : "NDVI could not be loaded.";
      setNdvi({
        status: "error",
        tile: null,
        acquisitionDate: null,
        message: detail,
      });
    }
  }

  const onMapClick = drawing
    ? addCorner
    : (latitude: number, longitude: number) => selectPoint(latitude, longitude, null);

  const pointHeading = preview.data?.location
    ? preview.data.location.label ??
      preview.data.location.nearest_place ??
      preview.data.location.county ??
      t("Selected point")
    : pointLabel ?? t("Selected point");

  return (
    <div className="container-page space-y-6 py-10">
      <SectionHeading
        eyebrow={t("Explore map")}
        title={t("Inspect any point or field")}
        description={t(
          "Saved field boundaries, on-farm sensor positions and the robot's stored GPS trail on one map. Search a place, click for conditions, or draw a field outline for analysis.",
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="order-2 space-y-4 xl:order-1">
          {drawing && (
            <section className="card card-pad space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{t("Drawn field")}</h2>
                <StatusPill tone="info" dot={false}>
                  {t("Drawing")}
                </StatusPill>
              </div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("Corners")}</dt>
                  <dd className="text-ink">
                    {draftPoints.length} / {MAX_CORNERS}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("Area")}</dt>
                  <dd className="text-ink">
                    {draftAreaHa !== null ? `${formatNumber(draftAreaHa, 2)} ha` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("Centre")}</dt>
                  <dd className="font-mono text-2xs text-ink" dir="ltr">
                    {draftCentre
                      ? `${draftCentre[0].toFixed(4)}, ${draftCentre[1].toFixed(4)}`
                      : "—"}
                  </dd>
                </div>
              </dl>
              {draftPoints.length >= 3 && !isSimpleRing(draftPoints) && (
                <p className="text-xs text-clay-600">
                  {t("The outline crosses itself. Undo a corner so the edges do not intersect.")}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDraftPoints((current) => current.slice(0, -1))}
                  disabled={draftPoints.length === 0}
                  className="btn-secondary btn-sm"
                >
                  {t("Undo corner")}
                </button>
                <button
                  type="button"
                  onClick={() => setDraftPoints([])}
                  disabled={draftPoints.length === 0}
                  className="btn-secondary btn-sm"
                >
                  {t("Clear outline")}
                </button>
                <button
                  type="button"
                  onClick={analyseDrawing}
                  disabled={!ringValid}
                  className="btn-primary btn-sm"
                >
                  {t("Analyse field")}
                </button>
              </div>
              <InfoNote tone="info">
                {t(
                  "Weather is sampled at the centre of the outline. Area is planar geometry from your corners, not a survey.",
                )}
              </InfoNote>
            </section>
          )}

          {!drawing && point && (
            <>
              <section className="card card-pad space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="eyebrow">{t("Selected point")}</p>
                    <h2 className="truncate text-sm font-semibold">{pointHeading}</h2>
                    <p className="mt-0.5 font-mono text-2xs text-muted" dir="ltr">
                      {point[0].toFixed(5)}, {point[1].toFixed(5)}
                    </p>
                  </div>
                  {preview.data?.current.available ? (
                    <StatusPill tone="good">{t("Live")}</StatusPill>
                  ) : null}
                </div>

                {preview.status === "loading" && (
                  <LoadingState label={t("Reading current conditions…")} rows={3} variant="list" />
                )}
                {preview.status === "error" && (
                  <ErrorState
                    title={t("Conditions unavailable")}
                    message={preview.error?.message ?? t("The location service could not answer.")}
                    onRetry={preview.reload}
                  />
                )}

                {preview.data && (
                  <>
                    {preview.data.current.available ? (
                      <dl className="space-y-1.5 text-xs">
                        {(preview.data.current.readings ?? []).slice(0, 6).map((reading) => (
                          <div key={reading.key} className="flex justify-between gap-3">
                            <dt className="text-muted">{t(reading.label)}</dt>
                            <dd className="text-end text-ink">
                              {reading.value ?? "—"}
                              {reading.unit ? ` ${reading.unit}` : ""}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-xs text-muted">
                        {preview.data.current.reason ?? t("Current weather is unavailable.")}
                      </p>
                    )}

                    <div className="border-t border-line pt-2 text-xs">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted">{t("Water balance, 30 days")}</span>
                        <span className="text-ink">
                          {preview.data.water.balance_mm !== null
                            ? `${formatNumber(preview.data.water.balance_mm, 0)} mm`
                            : "—"}
                        </span>
                      </div>
                      <p className="mt-1 text-2xs text-muted">
                        {t("Rain minus reference evapotranspiration. Model output, not a soil probe.")}
                      </p>
                    </div>

                    {preview.data.alerts.length > 0 && (
                      <ul className="space-y-1.5 border-t border-line pt-2">
                        {preview.data.alerts.slice(0, 3).map((alert) => (
                          <li key={alert.key} className="flex items-start gap-2 text-xs">
                            <StatusPill tone={alertTone(alert.level)}>{t(alert.level)}</StatusPill>
                            <span className="min-w-0 text-ink">{t(alert.title)}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="border-t border-line pt-2">
                      <SourceBadges sources={preview.data.sources} />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link
                        to={`/location?lat=${point[0]}&lon=${point[1]}${
                          pointLabel ? `&label=${encodeURIComponent(pointLabel)}` : ""
                        }`}
                        className="btn-primary btn-sm"
                      >
                        {t("Location analysis")}
                        <ArrowRightIcon size={14} />
                      </Link>
                      <Link
                        to={`/crop?lat=${point[0]}&lon=${point[1]}`}
                        className="btn-secondary btn-sm"
                      >
                        {t("Crop suitability")}
                      </Link>
                    </div>
                  </>
                )}
              </section>

              <InfoNote tone="warn">
                {t(
                  "Open-Meteo, NASA POWER and satellite products are models or gridded estimates. They are not measurements taken in this field.",
                )}
              </InfoNote>
            </>
          )}

          {fieldsState.status === "loading" && (
            <LoadingState label={t("Loading fields and sensors…")} rows={4} variant="list" />
          )}
          {fieldsState.status === "error" && (
            <ErrorState
              title={t("Fields and sensors unavailable")}
              message={fieldsState.error?.message ?? t("The field list could not be loaded.")}
              onRetry={fieldsState.reload}
            />
          )}
          {fieldsState.status === "success" && (
            <FieldInformationPanel
              entries={entries}
              selectedId={selectedFieldId}
              onSelectField={selectField}
              showDetail={!drawing && !point}
            />
          )}
        </aside>

        <div className="order-1 space-y-3 xl:order-2">
          <div className="card overflow-hidden">
            <div className="space-y-3 border-b border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="explore-search" className="sr-only">
                  {t("Search for a place")}
                </label>
                <div className="flex min-w-[220px] flex-1 gap-2">
                  <input
                    id="explore-search"
                    className="input"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSearch();
                      }
                    }}
                    placeholder={t("e.g. Qena, Egypt or a village name")}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSearch()}
                    disabled={searching}
                    className="btn-secondary shrink-0"
                  >
                    <SearchIcon size={15} />
                    {searching ? t("Searching…") : t("Search")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  className="btn-secondary"
                >
                  <MapPinIcon size={15} />
                  {locating ? t("Locating…") : t("My location")}
                </button>
                <button
                  type="button"
                  onClick={toggleDrawing}
                  aria-pressed={drawing}
                  className={drawing ? "btn-primary" : "btn-secondary"}
                >
                  <LayersIcon size={15} />
                  {drawing ? t("Drawing: click corners") : t("Draw field boundary")}
                </button>
              </div>

              <p className="text-2xs text-muted">
                {t(
                  "Place search uses OpenStreetMap Nominatim through the backend. It names a place; it is not a measurement.",
                )}
              </p>

              {searchMessage && (
                <p className="text-xs text-clay-600" role="status">
                  {t(searchMessage)}
                </p>
              )}
              {notice && (
                <p className="text-xs text-clay-600" role="status">
                  {t(notice)}
                </p>
              )}

              {searchResults.length > 0 && (
                <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
                  {searchResults.map((result) => (
                    <li key={`${result.latitude}-${result.longitude}-${result.label}`}>
                      <button
                        type="button"
                        onClick={() => selectPoint(result.latitude, result.longitude, result.label)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-start text-xs hover:bg-forest-50"
                      >
                        <span className="min-w-0">
                          <span className="block text-ink">{result.label}</span>
                          <span className="mt-0.5 block font-mono text-2xs text-muted">
                            {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
                            {result.kind ? ` · ${result.kind}` : ""}
                          </span>
                        </span>
                        <CheckIcon size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <AgriculturalMap
              entries={entries}
              selectedFieldId={selectedFieldId}
              onSelectField={selectField}
              basemap={basemap}
              onBasemapChange={setBasemap}
              overlays={overlays}
              onToggleOverlay={(key, value) =>
                setOverlays((current) => ({ ...current, [key]: value }))
              }
              ndvi={ndvi}
              ndviEnabled={ndviEnabled}
              onToggleNdvi={setNdviEnabled}
              onLoadNdvi={() => void loadNdvi()}
              canLoadNdvi={Boolean(selectedEntry)}
              selectedFieldName={selectedEntry?.field.name ?? null}
              drawing={drawing}
              draftPoints={draftPoints}
              onMapClick={onMapClick}
              focus={focus}
              summary={summary}
              pickedPoint={drawing ? null : point}
              height={620}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5">
              <p className="text-2xs leading-relaxed text-muted">
                {drawing
                  ? t("Corners are joined in click order. A polygon is sent only when you choose Analyse field.")
                  : t("Scroll is left to the page; use the map buttons to zoom. Click a boundary, sensor or robot marker for details.")}
              </p>
              {selectedEntry && (
                <span className="text-2xs text-muted">
                  {t("Selected field")}: <span className="text-ink">{selectedEntry.field.name}</span>
                </span>
              )}
            </div>
          </div>

          <InfoNote tone="info">
            {t(
              "Satellite imagery is orientation only. Field boundaries are drawn by you. Robot positions and sensor values are measurements uploaded by your robot — no positions or readings are simulated. NDVI appears only after Earth Engine returns real Sentinel-2 tiles.",
            )}
          </InfoNote>
        </div>
      </div>
    </div>
  );
}
