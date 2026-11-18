import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { GeocodeResult, LocationOverview } from "../api/types";
import { FieldMap } from "../components/data/FieldMap";
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
import { formatNumber } from "../lib/format";
import {
  geoJsonPolygon,
  isSimpleRing,
  ringAreaHectares,
  ringCentroid,
  type LatLon,
} from "../lib/geo";
import {
  readStoredLocation,
  rememberLocation,
  saveExploreGeometry,
} from "../lib/location";

const MAX_CORNERS = 24;
const FALLBACK_CENTRE: LatLon = [26.82, 30.8];

const ALERT_TONE = { high: "bad", moderate: "warn", info: "info" } as const;

function alertTone(level: "info" | "moderate" | "high") {
  return ALERT_TONE[level];
}

/**
 * Map-first exploration.
 *
 * A click selects a coordinate for analysis; drawing mode collects corners
 * exactly as clicked and turns them into a polygon only after three corners
 * that form a non-self-intersecting ring. Nothing is sampled until the user
 * opens an analysis, and drawing never invents a boundary for a point.
 */
export function ExploreMapPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const stored = readStoredLocation();

  const [point, setPoint] = useState<LatLon | null>(
    stored ? [stored.latitude, stored.longitude] : null,
  );
  const [pointLabel, setPointLabel] = useState<string | null>(stored?.label ?? null);
  const [mapCentre, setMapCentre] = useState<LatLon>(
    stored ? [stored.latitude, stored.longitude] : FALLBACK_CENTRE,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<LatLon[]>([]);

  const draftAreaHa = ringAreaHectares(draftPoints);
  const draftCentre = ringCentroid(draftPoints);
  const ringValid = draftPoints.length >= 3 && isSimpleRing(draftPoints);
  const draftBlocked = draftPoints.length >= MAX_CORNERS;

  const preview = useAsync<LocationOverview | null>(
    (signal) =>
      point && !drawing
        ? api.locationOverview(point[0], point[1], { label: pointLabel ?? undefined, signal })
        : Promise.resolve(null),
    [point?.[0], point?.[1], pointLabel, drawing],
  );

  function selectPoint(latitude: number, longitude: number, label: string | null) {
    const next: LatLon = [latitude, longitude];
    setPoint(next);
    setPointLabel(label);
    setMapCentre(next);
    setDrawing(false);
    setDraftPoints([]);
    setSearchResults([]);
    setSearchMessage(null);
    setNotice(null);
    rememberLocation({ latitude, longitude, label });
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
    const areaHa = draftAreaHa;
    saveExploreGeometry({
      geometry,
      latitude: draftCentre[0],
      longitude: draftCentre[1],
      areaHa,
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

  const previewLocation = preview.data?.location;
  const heading = previewLocation
    ? previewLocation.label ??
      previewLocation.nearest_place ??
      previewLocation.county ??
      t("Selected point")
    : pointLabel ?? t("Selected point");

  return (
    <div className="container-page space-y-6 py-10">
      <SectionHeading
        eyebrow={t("Explore map")}
        title={t("Inspect any point or field")}
        description={t(
          "Click the map, search for a place, or draw a field outline. Analyses use openly licensed weather, soil and satellite services through this app's backend.",
        )}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
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
                      onClick={() =>
                        selectPoint(result.latitude, result.longitude, result.label)
                      }
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

          <FieldMap
            latitude={drawing ? mapCentre[0] : (point?.[0] ?? mapCentre[0])}
            longitude={drawing ? mapCentre[1] : (point?.[1] ?? mapCentre[1])}
            label={pointLabel}
            height={540}
            allowGibs
            zoom={point || drawing ? 12 : 6}
            showMarker={!drawing && point !== null}
            onPick={drawing ? undefined : (latitude, longitude) => selectPoint(latitude, longitude, null)}
            onAddDraftPoint={drawing ? addCorner : undefined}
            draftPoints={drawing ? draftPoints : []}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
            <p className="text-2xs leading-relaxed text-muted">
              {drawing
                ? t(
                    "Corners are joined in click order. A polygon is sent only when you choose Analyse field.",
                  )
                : t(
                    "Click anywhere to select a coordinate. NASA GIBS imagery is optional visual context only.",
                  )}
            </p>
            {point && !drawing && (
              <span className="font-mono text-2xs text-muted" dir="ltr">
                {point[0].toFixed(5)}, {point[1].toFixed(5)}
              </span>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          {drawing ? (
            <section className="card card-pad space-y-3">
              <h2 className="text-sm font-semibold">{t("Drawn field")}</h2>
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
                  {t(
                    "The outline crosses itself. Undo a corner so the edges do not intersect.",
                  )}
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
          ) : point ? (
            <>
              <section className="card card-pad space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{heading}</h2>
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
          ) : (
            <section className="card card-pad space-y-2">
              <h2 className="text-sm font-semibold">{t("How to start")}</h2>
              <ul className="space-y-1.5 text-xs text-muted">
                <li>{t("Search for a town or address, then choose a result.")}</li>
                <li>{t("Or click any point on the map.")}</li>
                <li>{t("To analyse a whole field, draw its outline and choose Analyse field.")}</li>
                <li>{t("Saved field profiles stay available from Fields and the field switcher.")}</li>
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
