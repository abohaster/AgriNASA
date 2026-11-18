import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { DemoTrial, FieldCreate, GeocodeResult } from "../api/types";
import { AlertCard } from "../components/data/AlertCard";
import { DemoTrials } from "../components/data/DemoTrials";
import { FieldMap } from "../components/data/FieldMap";
import { InfoNote } from "../components/ui/InfoNote";
import {
  ArrowRightIcon,
  CheckIcon,
  MapPinIcon,
  SearchIcon,
  SparkIcon,
  WheatIcon,
} from "../components/ui/Icons";
import { SectionHeading } from "../components/ui/SectionHeading";
import { rememberFieldId } from "../hooks/useField";
import { useI18n } from "../i18n/I18nContext";
import { addDaysIso, todayIso } from "../lib/format";
import {
  geoJsonPolygon,
  isSimpleRing,
  ringAreaHectares,
  ringCentroid,
  type LatLon,
} from "../lib/geo";
import { CROPS, IRRIGATION_SYSTEMS, SOIL_TEXTURES } from "../lib/labels";

interface FormState {
  name: string;
  latitude: string;
  longitude: string;
  cropId: string;
  plantingDate: string;
  areaHa: string;
  soilTexture: string;
  irrigationSystem: string;
  locationLabel: string;
}

const INITIAL: FormState = {
  name: "",
  latitude: "",
  longitude: "",
  cropId: "wheat",
  plantingDate: todayIso(),
  areaHa: "",
  soilTexture: "",
  irrigationSystem: "",
  locationLabel: "",
};

function parseCoordinate(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Field creation.
 *
 * Location can come from a place search (proxied OpenStreetMap), manual
 * coordinates or a map click. The user can also draw the field outline by
 * clicking four corners; those corners are joined in order and stored as a
 * GeoJSON Polygon exactly as clicked. No boundary is invented for point-only
 * fields, and the outline never changes how weather is sampled.
 */
export function FieldSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() => {
    const lat = Number.parseFloat(searchParams.get("lat") ?? "");
    const lon = Number.parseFloat(searchParams.get("lon") ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return INITIAL;
    return {
      ...INITIAL,
      latitude: lat.toFixed(6),
      longitude: lon.toFixed(6),
      locationLabel: searchParams.get("label") ?? "",
    };
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const [labelLoading, setLabelLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Boundary drawing: corners are [latitude, longitude] in click order.
  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<LatLon[]>([]);

  const latitude = parseCoordinate(form.latitude);
  const longitude = parseCoordinate(form.longitude);
  const hasCoords =
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
  const areaHa = form.areaHa.trim() ? Number.parseFloat(form.areaHa) : null;

  const draftAreaHa = ringAreaHectares(draftPoints);
  const draftCentre = ringCentroid(draftPoints);
  const draftComplete = draftPoints.length >= 4;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addBoundaryPoint(lat: number, lon: number) {
    if (draftPoints.length >= 24) {
      setError("A boundary can have at most 24 corners in this version.");
      return;
    }
    const next = [...draftPoints, [lat, lon] as LatLon];
    setError(null);
    setDraftPoints(next);

    // The first corner also gives a field point when the user has not chosen one.
    setForm((current) => {
      const hasPoint =
        parseCoordinate(current.latitude) !== null && parseCoordinate(current.longitude) !== null;
      return hasPoint
        ? current
        : { ...current, latitude: lat.toFixed(6), longitude: lon.toFixed(6) };
    });
  }

  function undoBoundaryPoint() {
    setDraftPoints((current) => current.slice(0, -1));
  }

  function clearBoundary() {
    setDraftPoints([]);
    setError(null);
  }

  function toggleDrawing() {
    setDrawing((current) => !current);
    setError(null);
  }

  function applyTrial(trial: DemoTrial) {
    const geometry = trial.geometry as { coordinates?: number[][][] };
    const ring = geometry.coordinates?.[0] ?? [];
    const points: LatLon[] = ring
      .slice(0, Math.max(0, ring.length - 1))
      .filter((position) => Array.isArray(position) && position.length >= 2)
      .map(([longitude, latitude]) => [latitude, longitude]);

    setForm({
      name: `Demo trial · ${trial.name}`,
      latitude: trial.latitude.toFixed(6),
      longitude: trial.longitude.toFixed(6),
      cropId: trial.crop_id,
      plantingDate: addDaysIso(todayIso(), -trial.planting_offset_days),
      areaHa: String(trial.area_ha),
      soilTexture: trial.soil_texture,
      irrigationSystem: trial.irrigation_system,
      locationLabel: trial.name,
    });
    setDraftPoints(points);
    setDrawing(false);
    setError(null);
    setSearchResults([]);
    setSearchMessage(null);
    setDemoNotice(
      "Demo trial values are filled in. Review the location and boundary, then create the field to run the analyses.",
    );
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
        setSearchMessage("No matching place found. You can enter coordinates manually or click the map.");
      }
    } catch (err) {
      setSearchMessage(err instanceof Error ? err.message : "Location search is unavailable.");
    } finally {
      setSearching(false);
    }
  }

  function chooseResult(result: GeocodeResult) {
    setForm((current) => ({
      ...current,
      latitude: result.latitude.toFixed(6),
      longitude: result.longitude.toFixed(6),
      locationLabel: result.label,
    }));
    setSearchResults([]);
    setSearchMessage(null);
    // A drawn outline belongs to the previous location, so it cannot be reused.
    setDraftPoints([]);
    setDrawing(false);
  }

  async function handleLookupLabel() {
    if (!hasCoords) return;
    setLabelLoading(true);
    try {
      const result = await api.reverseGeocode(latitude as number, longitude as number);
      update("locationLabel", result.label);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The location name could not be looked up.");
    } finally {
      setLabelLoading(false);
    }
  }

  async function handleDemo() {
    setDemoLoading(true);
    setError(null);
    try {
      const info = await api.demoInfo();
      if (!info.enabled || !info.snapshot_field) {
        setError("The demo snapshot is not available. You can still create a field with live data.");
        return;
      }
      setForm({
        name: info.snapshot_field.name,
        latitude: String(info.snapshot_field.latitude),
        longitude: String(info.snapshot_field.longitude),
        cropId: "wheat",
        plantingDate: info.snapshot_field.planting_date,
        areaHa: "4.2",
        soilTexture: "loam",
        irrigationSystem: "sprinkler",
        locationLabel: info.snapshot_field.location_label,
      });
      setSearchQuery("");
      setSearchResults([]);
      setDraftPoints([]);
      setDrawing(false);
      setDemoNotice(info.notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo information could not be loaded.");
    } finally {
      setDemoLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Give the field a name so you can recognise it later.");
      return;
    }
    if (!hasCoords) {
      setError("Select a location with the search box, a map click, or valid latitude/longitude.");
      return;
    }
    if (!form.plantingDate) {
      setError("Choose a planting date.");
      return;
    }
    if (areaHa !== null && (!Number.isFinite(areaHa) || areaHa <= 0)) {
      setError("Field area must be a positive number of hectares, or left blank.");
      return;
    }
    if (draftPoints.length > 0 && draftPoints.length < 4) {
      setError(
        "The map outline needs four corners. Place the remaining corners, or clear the drawing to save a point-only field.",
      );
      return;
    }
    if (draftPoints.length >= 4 && !isSimpleRing(draftPoints)) {
      setError(
        "The outline crosses itself. Undo the last corner or clear the drawing, then re-draw the field in order around its edge.",
      );
      return;
    }

    const boundary = draftPoints.length >= 4 ? geoJsonPolygon(draftPoints) : null;
    // A complete outline locates the field at its centre; a single point stays as clicked.
    const centre = boundary ? draftCentre : null;
    const finalLatitude = centre ? centre[0] : (latitude as number);
    const finalLongitude = centre ? centre[1] : (longitude as number);
    // The area typed by the user wins; otherwise the drawn shape supplies an estimate.
    const drawnArea =
      draftComplete && draftAreaHa !== null && draftAreaHa > 0
        ? Number(draftAreaHa.toFixed(2))
        : null;
    const finalArea = areaHa ?? drawnArea;

    const payload: FieldCreate = {
      name: form.name.trim(),
      latitude: finalLatitude,
      longitude: finalLongitude,
      crop_id: form.cropId,
      planting_date: form.plantingDate,
      area_ha: finalArea,
      soil_texture: form.soilTexture || null,
      irrigation_system: form.irrigationSystem || null,
      location_label: form.locationLabel.trim() || null,
      elevation_m: null,
      boundary_geojson: boundary,
    };

    setSubmitting(true);
    try {
      const field = await api.createField(payload);
      rememberFieldId(field.id);
      navigate(`/dashboard/${field.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The field could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-5">
        <Link to="/fields" className="link-underline text-xs">
          <span aria-hidden="true" className="inline-block rtl:-scale-x-100">←</span>{" "}
          {t("Back to fields")}
        </Link>
      </div>

      <SectionHeading
        eyebrow={t("New field")}
        title={t("Create a field profile")}
        description={t(
          "Coordinates select the NASA POWER grid cell. Crop and planting date drive the growth-stage coefficients. Soil and irrigation details improve the water-balance estimate but are optional.",
        )}
      />

      <div className="mt-6">
        <DemoTrials onSelect={applyTrial} />
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <section className="card card-pad">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <WheatIcon size={16} />
              {t("Field identity")}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="field-name" className="field-label">
                  {t("Field name")} <span className="text-clay-600">*</span>
                </label>
                <input
                  id="field-name"
                  className="input"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder={t("e.g. North pivot — wheat 2026")}
                  maxLength={120}
                  required
                />
              </div>
              <div>
                <label htmlFor="crop" className="field-label">
                  {t("Crop")} <span className="text-clay-600">*</span>
                </label>
                <select
                  id="crop"
                  className="input"
                  value={form.cropId}
                  onChange={(event) => update("cropId", event.target.value)}
                >
                  {CROPS.map((crop) => (
                    <option key={crop.value} value={crop.value}>
                      {t(crop.label)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-2xs leading-relaxed text-muted">
                  {t(CROPS.find((crop) => crop.value === form.cropId)?.note ?? "")}
                </p>
              </div>
              <div>
                <label htmlFor="planting-date" className="field-label">
                  {t("Planting date")} <span className="text-clay-600">*</span>
                </label>
                <input
                  id="planting-date"
                  type="date"
                  className="input"
                  value={form.plantingDate}
                  max={addDaysIso(todayIso(), 365)}
                  onChange={(event) => update("plantingDate", event.target.value)}
                  required
                />
                <p className="mt-1 text-2xs text-muted">
                  {t(
                    "Future dates are allowed for planning; analyses will report that the crop has not started.",
                  )}
                </p>
              </div>
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MapPinIcon size={16} />
              {t("Location")}
            </h2>

            <div className="mt-4">
              <label htmlFor="place-search" className="field-label">
                {t("Search for a place")}
              </label>
              <div className="flex gap-2">
                <input
                  id="place-search"
                  className="input"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSearch();
                    }
                  }}
                  placeholder={t("e.g. Qena, Egypt or a farm address")}
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
              <p className="mt-1 text-2xs text-muted">
                {t("Search uses OpenStreetMap Nominatim through the backend. It is not a NASA service.")}
              </p>

              {searchMessage && (
                <p className="mt-2 text-xs text-clay-600" role="status">
                  {t(searchMessage)}
                </p>
              )}

              {searchResults.length > 0 && (
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-md border border-line">
                  {searchResults.map((result) => (
                    <li key={`${result.latitude}-${result.longitude}-${result.label}`}>
                      <button
                        type="button"
                        onClick={() => chooseResult(result)}
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

            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-ink">{t("Map and field outline")}</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleDrawing}
                    aria-pressed={drawing}
                    className={drawing ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                  >
                    {drawing ? t("Drawing: click the map") : t("Draw field boundary")}
                  </button>
                  {draftPoints.length > 0 && (
                    <>
                      <button type="button" onClick={undoBoundaryPoint} className="btn-secondary btn-sm">
                        {t("Undo corner")}
                      </button>
                      <button type="button" onClick={clearBoundary} className="btn-secondary btn-sm">
                        {t("Clear outline")}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <p className="mt-1.5 text-2xs leading-relaxed text-muted" role="status">
                {drawing
                  ? draftComplete
                    ? t(
                        "{n} corners placed and joined in order. Click more corners to refine the outline, or switch drawing off when finished.",
                        { n: draftPoints.length },
                      )
                    : t("Click the map to place corner {n} of 4. Corners are joined in the order you click.", {
                        n: draftPoints.length + 1,
                      })
                  : draftPoints.length > 0
                    ? t(
                        "Outline placed. Turn drawing back on to add corners, or clear the outline to move the field point.",
                      )
                    : t(
                        "Click the map once to set the field point, or start drawing to outline the field with four corners.",
                      )}
              </p>

              <div className="mt-2">
                <FieldMap
                  latitude={hasCoords ? (latitude as number) : 26.15}
                  longitude={hasCoords ? (longitude as number) : 32.72}
                  label={form.locationLabel || form.name || null}
                  areaHa={draftComplete ? draftAreaHa : areaHa}
                  showMarker={!drawing && hasCoords}
                  height={360}
                  zoom={hasCoords ? 13 : 6}
                  draftPoints={draftPoints}
                  onAddDraftPoint={drawing ? addBoundaryPoint : undefined}
                  onPick={
                    drawing || draftPoints.length > 0
                      ? undefined
                      : (lat, lon) => {
                          setForm((current) => ({
                            ...current,
                            latitude: lat.toFixed(6),
                            longitude: lon.toFixed(6),
                            locationLabel: "",
                          }));
                        }
                  }
                />
              </div>

              {draftPoints.length > 0 && (
                <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:items-start">
                  <ol className="max-h-36 overflow-auto rounded-md border border-line bg-paper px-3 py-2 text-2xs scroll-thin">
                    {draftPoints.map((point, index) => (
                      <li
                        key={`${point[0]}-${point[1]}-${index}`}
                        className="flex items-baseline justify-between gap-3 py-0.5 font-mono"
                      >
                        <span className="text-muted">{t("Corner {n}", { n: index + 1 })}</span>
                        <span className="text-ink" dir="ltr">
                          {point[0].toFixed(6)}, {point[1].toFixed(6)}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="rounded-md border border-line bg-forest-50/70 px-3 py-2 text-2xs leading-relaxed">
                    {draftComplete && draftAreaHa !== null ? (
                      <>
                        <span className="font-semibold text-ink">{draftAreaHa.toFixed(2)} ha</span>
                        <span className="text-muted">
                          {" "}
                          · {t("{n} feddan", { n: (draftAreaHa / 0.4201).toFixed(1) })}
                        </span>
                        <span className="mt-1 block text-muted">
                          {t(
                            "Estimated from the corners you clicked, not a survey. Used only when the area field is left blank.",
                          )}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">
                        {t(
                          "Area appears after the third corner; four corners are required to save the outline.",
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="latitude" className="field-label">
                  {t("Latitude")} <span className="text-clay-600">*</span>
                </label>
                <input
                  id="latitude"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={-90}
                  max={90}
                  className="input font-mono text-sm"
                  value={form.latitude}
                  onChange={(event) => update("latitude", event.target.value)}
                  placeholder="26.150000"
                  required
                />
              </div>
              <div>
                <label htmlFor="longitude" className="field-label">
                  {t("Longitude")} <span className="text-clay-600">*</span>
                </label>
                <input
                  id="longitude"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={-180}
                  max={180}
                  className="input font-mono text-sm"
                  value={form.longitude}
                  onChange={(event) => update("longitude", event.target.value)}
                  placeholder="32.720000"
                  required
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="location-label" className="field-label">
                {t("Location label")} <span className="font-normal text-muted">{t("(optional)")}</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="location-label"
                  className="input"
                  value={form.locationLabel}
                  onChange={(event) => update("locationLabel", event.target.value)}
                  placeholder={t("Human-readable place name")}
                  maxLength={255}
                />
                <button
                  type="button"
                  onClick={() => void handleLookupLabel()}
                  disabled={!hasCoords || labelLoading}
                  className="btn-secondary shrink-0 text-xs"
                >
                  {labelLoading ? t("Looking up…") : t("Look up name")}
                </button>
              </div>
            </div>

            <p className="mt-3 text-2xs leading-relaxed text-muted">
              {t(
                "The outline is drawn by you and stored exactly as clicked. It is not a satellite measurement or a surveyed boundary. NASA POWER weather is still sampled at the field point / grid cell, not averaged over the whole polygon.",
              )}
            </p>
          </section>

          <section className="card card-pad">
            <h2 className="text-sm font-semibold">{t("Optional agronomy details")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {t(
                "These improve the water balance. If omitted, the model uses loam soil and does not apply an irrigation-system efficiency.",
              )}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="area" className="field-label">
                  {t("Area (ha)")}
                </label>
                <input
                  id="area"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  className="input"
                  value={form.areaHa}
                  onChange={(event) => update("areaHa", event.target.value)}
                  placeholder={t("Optional")}
                />
                <p className="mt-1 text-2xs text-muted">
                  {t("Leave blank to use the drawn outline estimate.")}
                </p>
              </div>
              <div>
                <label htmlFor="soil" className="field-label">
                  {t("Soil texture")}
                </label>
                <select
                  id="soil"
                  className="input"
                  value={form.soilTexture}
                  onChange={(event) => update("soilTexture", event.target.value)}
                >
                  <option value="">{t("Not provided (assume loam)")}</option>
                  {SOIL_TEXTURES.map((soil) => (
                    <option key={soil.value} value={soil.value}>
                      {t(soil.label)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="irrigation" className="field-label">
                  {t("Irrigation system")}
                </label>
                <select
                  id="irrigation"
                  className="input"
                  value={form.irrigationSystem}
                  onChange={(event) => update("irrigationSystem", event.target.value)}
                >
                  <option value="">{t("Not provided")}</option>
                  {IRRIGATION_SYSTEMS.map((system) => (
                    <option key={system.value} value={system.value}>
                      {t(system.label)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {error && (
            <AlertCard tone="danger" title={t("Could not create the field")}>
              {t(error)}
            </AlertCard>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-2xs text-muted">
              <span className="text-clay-600">*</span> {t("Required fields")}
            </p>
            <div className="flex gap-2">
              <Link to="/fields" className="btn-secondary">
                {t("Cancel")}
              </Link>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? t("Creating…") : t("Create field")}
                {!submitting && <ArrowRightIcon size={15} className="rtl:-scale-x-100" />}
              </button>
            </div>
          </div>
        </form>

        <aside className="space-y-4 self-start lg:sticky lg:top-24">
          <div className="card card-pad">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MapPinIcon size={15} />
              {t("Location summary")}
            </h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t("Clicked point")}</dt>
                <dd className="font-mono text-2xs" dir="ltr">
                  {hasCoords
                    ? `${(latitude as number).toFixed(5)}, ${(longitude as number).toFixed(5)}`
                    : t("Not set")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t("Outline")}</dt>
                <dd className="text-end">
                  {draftComplete
                    ? t("{n} corners, closed", { n: draftPoints.length })
                    : draftPoints.length > 0
                      ? t("{n} of 4 corners", { n: draftPoints.length })
                      : t("None — point only")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t("Area")}</dt>
                <dd className="text-end">
                  {areaHa !== null && Number.isFinite(areaHa)
                    ? t("{value} ha (entered)", { value: areaHa.toFixed(2) })
                    : draftComplete && draftAreaHa !== null
                      ? t("{value} ha (estimate)", { value: draftAreaHa.toFixed(2) })
                      : t("Not set")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t("Saved field centre")}</dt>
                <dd className="text-end font-mono text-2xs" dir="ltr">
                  {draftComplete && draftCentre
                    ? `${draftCentre[0].toFixed(5)}, ${draftCentre[1].toFixed(5)}`
                    : hasCoords
                      ? `${(latitude as number).toFixed(5)}, ${(longitude as number).toFixed(5)}`
                      : t("Not set")}
                </dd>
              </div>
            </dl>
            <p className="mt-3 border-t border-line pt-3 text-2xs leading-relaxed text-muted">
              {t(
                "NASA POWER weather is sampled for the nearest grid cell of the saved centre. The outline is stored for display and area; it is not used to sample or average weather.",
              )}
            </p>
          </div>

          {demoNotice && (
            <InfoNote title={t("Demo snapshot selected")} tone="warn">
              {t(demoNotice)}
            </InfoNote>
          )}

          <div className="card card-pad">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <SparkIcon size={15} />
              {t("Explore without live data")}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              {t(
                "Prefill a field from the cached NASA POWER snapshot (real values for Qena, Egypt, 2025-11-01 → 2026-03-10). Demo analyses are labelled everywhere.",
              )}
            </p>
            <button
              type="button"
              onClick={() => void handleDemo()}
              disabled={demoLoading}
              className="btn-secondary btn-sm mt-3"
            >
              {demoLoading ? t("Loading demo…") : t("Use demo field values")}
            </button>
          </div>

          <div className="card card-pad">
            <h3 className="text-sm font-semibold">{t("What happens next")}</h3>
            <ol className="mt-2 space-y-2 text-xs leading-relaxed text-muted">
              <li className="flex gap-2">
                <span className="mono-data text-forest-600">01</span>
                {t("NASA POWER daily data is requested for the nearest grid cell.")}
              </li>
              <li className="flex gap-2">
                <span className="mono-data text-forest-600">02</span>
                {t("ET₀ and the stage-based crop coefficient produce ETc.")}
              </li>
              <li className="flex gap-2">
                <span className="mono-data text-forest-600">03</span>
                {t("A root-zone water balance estimates depletion and refill demand.")}
              </li>
              <li className="flex gap-2">
                <span className="mono-data text-forest-600">04</span>
                {t("The dashboard explains the result and its confidence.")}
              </li>
            </ol>
          </div>

        </aside>
      </div>
    </div>
  );
}
