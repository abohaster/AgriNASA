import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api/client";
import type {
  Field,
  MoistureCondition,
  SatelliteAnalysis,
  SoilMoistureResult,
  VegetationCondition,
  VegetationIndicesResult,
  WetnessCategory,
} from "../api/types";
import { SatelliteMap } from "../components/data/SatelliteMap";
import { FieldLayout } from "../components/layout/FieldLayout";
import { ErrorState, EmptyState, LoadingState } from "../components/ui/AsyncState";
import { DataSourceBadge } from "../components/ui/DataSourceBadge";
import { Formula } from "../components/ui/Formula";
import { InfoNote } from "../components/ui/InfoNote";
import { SectionHeading } from "../components/ui/SectionHeading";
import { StatusPill } from "../components/ui/StatusPill";
import type { Tone } from "../components/ui/StatusPill";
import { useAsync } from "../hooks/useAsync";
import { useFieldIdFromRoute } from "../hooks/useField";
import { useI18n } from "../i18n/I18nContext";
import { addDaysIso, formatDate, formatDateTime, formatNumber, todayIso } from "../lib/format";

const WETNESS_LABEL: Record<WetnessCategory, string> = {
  dry: "Dry",
  near_normal: "Near normal",
  wet: "Wet",
  unknown: "Unknown",
};

const WETNESS_TONE: Record<WetnessCategory, Tone> = {
  dry: "warn",
  near_normal: "good",
  wet: "info",
  unknown: "neutral",
};

const NDVI_LABEL: Record<VegetationCondition, string> = {
  sparse: "Sparse canopy",
  moderate: "Moderate canopy",
  dense: "Dense canopy",
  unknown: "Unknown",
};

const NDVI_TONE: Record<VegetationCondition, Tone> = {
  sparse: "warn",
  moderate: "good",
  dense: "good",
  unknown: "neutral",
};

const NDMI_LABEL: Record<MoistureCondition, string> = {
  low: "Low canopy water",
  moderate: "Moderate canopy water",
  high: "High canopy water",
  unknown: "Unknown",
};

const NDMI_TONE: Record<MoistureCondition, Tone> = {
  low: "warn",
  moderate: "good",
  high: "info",
  unknown: "neutral",
};

const CLOUD_OPTIONS = [10, 30, 50, 80];

function SoilMoistureCard({ result }: { result: SoilMoistureResult }) {
  const { t } = useI18n();

  return (
    <section className="card card-pad" aria-label={t("Surface wetness")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{t("Sentinel-1 · C-band SAR")}</p>
          <h2 className="mt-1 text-sm font-semibold">{t("Surface wetness (relative)")}</h2>
        </div>
        <StatusPill tone={WETNESS_TONE[result.category]} dot={false}>
          {t(WETNESS_LABEL[result.category])}
        </StatusPill>
      </div>

      {result.available ? (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="mono-data text-3xl font-semibold">{t(WETNESS_LABEL[result.category])}</p>
            <p className="text-xs text-muted">
              {t("relative score {value} of 1", {
                value: formatNumber(result.relative_score, 2),
              })}
              {result.relative_percent !== null &&
                ` · ${t("≈ {percent}% of the documented VV range", {
                  percent: formatNumber(result.relative_percent, 0),
                })}`}
            </p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-muted">VV</dt>
              <dd className="mono-data">{formatNumber(result.vv_db, 1)} dB</dd>
            </div>
            <div>
              <dt className="text-muted">VH</dt>
              <dd className="mono-data">{formatNumber(result.vh_db, 1)} dB</dd>
            </div>
            <div>
              <dt className="text-muted">VH − VV</dt>
              <dd className="mono-data">{formatNumber(result.vh_minus_vv_db, 1)} dB</dd>
            </div>
            <div>
              <dt className="text-muted">{t("Acquisition")}</dt>
              <dd>{formatDate(result.acquisition_date)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("Scenes in window")}</dt>
              <dd className="mono-data">{result.scene_count}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("Valid pixels")}</dt>
              <dd className="mono-data">{formatNumber(result.valid_pixels, 0)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-2xs leading-relaxed text-muted">{t(result.interpretation)}</p>
        </>
      ) : (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink">{t("Unavailable")}</p>
          <p className="mt-1 text-2xs leading-relaxed text-muted">
            {result.reason ? t(result.reason) : t("No Sentinel-1 classification is available.")}
          </p>
          <p className="mt-2 text-2xs leading-relaxed text-muted">{t(result.interpretation)}</p>
        </div>
      )}
    </section>
  );
}

function VegetationCard({ result }: { result: VegetationIndicesResult }) {
  const { t } = useI18n();

  return (
    <section className="card card-pad" aria-label={t("Canopy condition")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{t("Sentinel-2 · optical")}</p>
          <h2 className="mt-1 text-sm font-semibold">{t("Canopy condition")}</h2>
        </div>
        <StatusPill tone={result.available ? "good" : "neutral"} dot={false}>
          {result.available ? t("Available") : t("Unavailable")}
        </StatusPill>
      </div>

      {result.available ? (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <div>
              <p className="text-2xs uppercase tracking-[0.08em] text-muted">NDVI</p>
              <p className="mono-data text-3xl font-semibold">{formatNumber(result.ndvi, 2)}</p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-[0.08em] text-muted">NDMI</p>
              <p className="mono-data text-xl font-semibold">{formatNumber(result.ndmi, 2)}</p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-[0.08em] text-muted">NDWI</p>
              <p className="mono-data text-xl font-semibold">{formatNumber(result.ndwi, 2)}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusPill tone={NDVI_TONE[result.ndvi_condition]} dot={false}>
              {t(NDVI_LABEL[result.ndvi_condition])}
            </StatusPill>
            <StatusPill tone={NDMI_TONE[result.ndmi_condition]} dot={false}>
              {t(NDMI_LABEL[result.ndmi_condition])}
            </StatusPill>
            {result.composite ? (
              <StatusPill tone="warn" dot={false}>
                {t("Median composite")}
              </StatusPill>
            ) : (
              <StatusPill tone="neutral" dot={false}>
                {t("Latest usable scene")}
              </StatusPill>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted">{t("Acquisition")}</dt>
              <dd>{formatDate(result.acquisition_date)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("Scenes in window")}</dt>
              <dd className="mono-data">{result.scene_count}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("Scene cloud cover")}</dt>
              <dd className="mono-data">
                {result.cloud_cover_percent === null
                  ? "—"
                  : `${formatNumber(result.cloud_cover_percent, 1)}%`}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("Valid fraction")}</dt>
              <dd className="mono-data">
                {result.valid_fraction === null
                  ? "—"
                  : `${formatNumber(result.valid_fraction * 100, 0)}%`}
              </dd>
            </div>
          </dl>

          {result.reason && (
            <p className="mt-3 text-2xs leading-relaxed text-muted">{t(result.reason)}</p>
          )}
          <p className="mt-2 text-2xs leading-relaxed text-muted">{t(result.interpretation)}</p>
        </>
      ) : (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink">{t("Unavailable")}</p>
          <p className="mt-1 text-2xs leading-relaxed text-muted">
            {result.reason ? t(result.reason) : t("No Sentinel-2 indices are available.")}
          </p>
          <p className="mt-2 text-2xs leading-relaxed text-muted">{t(result.interpretation)}</p>
        </div>
      )}
    </section>
  );
}

function AnalysisResults({ field, analysis }: { field: Field; analysis: SatelliteAnalysis }) {
  const { t } = useI18n();
  const hasTiles = Boolean(
    analysis.tiles.ndvi ||
      analysis.tiles.ndmi ||
      analysis.tiles.soil_moisture ||
      analysis.tiles.true_color,
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span>
          {t("Analysis window")}: {formatDate(analysis.start)} – {formatDate(analysis.end)}
        </span>
        <span>
          {t("Geometry")}:{" "}
          {analysis.geometry_source === "polygon"
            ? t("saved field boundary")
            : t("field centre + buffer")}
        </span>
        <span>
          {t("Area")}: {formatNumber(analysis.area_ha, 2)} ha
        </span>
        <span>
          {t("Generated")}: {formatDateTime(analysis.generated_at)}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SoilMoistureCard result={analysis.soil_moisture} />
        <VegetationCard result={analysis.vegetation} />
      </div>

      <section aria-label={t("Satellite map")}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("Layer map")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {analysis.sources.map((source) => (
              <DataSourceBadge key={source.id} source={source} compact />
            ))}
          </div>
        </div>
        <SatelliteMap
          latitude={field.latitude}
          longitude={field.longitude}
          label={field.name}
          boundary={field.boundary_geojson}
          areaHa={analysis.area_ha}
          tiles={analysis.tiles}
        />
        {!hasTiles && (
          <InfoNote tone="warn" className="mt-3" title={t("No display layers returned")}>
            {t(
              "The numeric results are still shown above, but Earth Engine returned no tile URLs for this window.",
            )}
          </InfoNote>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card card-pad" aria-label={t("Index definitions")}>
          <h2 className="text-sm font-semibold">{t("How the indices are computed")}</h2>
          <p className="mt-1 text-2xs leading-relaxed text-muted">
            {t(
              "Earth Engine reduces cloud-masked pixels inside the selected geometry. The formulas are standard, but the classes are documented heuristic thresholds.",
            )}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Formula
              name="NDVI"
              expression="(B8 − B4) ÷ (B8 + B4)"
              variables={[
                { symbol: "B8", meaning: "near-infrared surface reflectance" },
                { symbol: "B4", meaning: "red surface reflectance" },
              ]}
              note="NDVI describes canopy greenness, not disease or yield."
            />
            <Formula
              name="NDMI"
              expression="(B8 − B11) ÷ (B8 + B11)"
              variables={[
                { symbol: "B8", meaning: "near-infrared surface reflectance" },
                { symbol: "B11", meaning: "short-wave infrared (20 m) surface reflectance" },
              ]}
              note="NDMI tracks canopy water content; it is not volumetric soil moisture."
            />
            <Formula
              name="NDWI"
              expression="(B3 − B8) ÷ (B3 + B8)"
              variables={[
                { symbol: "B3", meaning: "green surface reflectance" },
                { symbol: "B8", meaning: "near-infrared surface reflectance" },
              ]}
              note="NDWI is sensitive to open water and surface moisture in vegetation."
            />
            <Formula
              name="Relative wetness"
              expression={"clamp((VV + 22) ÷ 17, 0, 1)\n−22 dB → 0      −5 dB → 1"}
              variables={[
                { symbol: "VV", meaning: "Sentinel-1 VV backscatter in dB (speckle-filtered)" },
                { symbol: "class", meaning: "dry < −17 dB · near normal −17…−12 dB · wet > −12 dB" },
              ]}
              note="A relative surface signal: roughness and canopy also change VV."
            />
          </div>
        </section>

        <aside className="space-y-5">
          <section className="card card-pad" aria-label={t("Limitations")}>
            <h2 className="text-sm font-semibold">{t("Limitations")}</h2>
            <ul className="mt-2 space-y-2 text-2xs leading-relaxed text-muted">
              {analysis.limitations.map((limitation) => (
                <li key={limitation} className="flex gap-1.5">
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50"
                    aria-hidden="true"
                  />
                  <span>{t(limitation)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card card-pad" aria-label={t("Data sources")}>
            <h2 className="text-sm font-semibold">{t("Data sources")}</h2>
            <div className="mt-3 space-y-3">
              {analysis.sources.map((source) => (
                <div key={source.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                  <DataSourceBadge source={source} />
                </div>
              ))}
            </div>
            <p className="mt-3 text-2xs leading-relaxed text-muted">
              {t(
                "No satellite values are simulated in demo mode. If Earth Engine is not configured, this page says so instead of showing mock data.",
              )}
            </p>
          </section>

          <section className="card card-pad" aria-label={t("Related analyses")}>
            <h2 className="text-sm font-semibold">{t("Related analyses")}</h2>
            <p className="mt-1 text-2xs leading-relaxed text-muted">
              {t(
                "Satellite indices are an independent observation. Compare them with the water balance and environmental indicators rather than treating either as a measurement of the other.",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to={`/irrigation/${field.id}`} className="btn-secondary btn-sm">
                {t("Irrigation")}
              </Link>
              <Link to={`/health/${field.id}`} className="btn-secondary btn-sm">
                {t("Crop health")}
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function SatelliteBody({ field }: { field: Field }) {
  const { t } = useI18n();
  const today = todayIso();
  const [start, setStart] = useState(addDaysIso(today, -30));
  const [end, setEnd] = useState(today);
  const [cloud, setCloud] = useState(30);
  const [applied, setApplied] = useState({
    start: addDaysIso(today, -30),
    end: today,
    max_cloud_percent: 30,
    buffer_km: 0.5,
  });
  const [runToken, setRunToken] = useState(0);

  const state = useAsync(
    (signal) => api.satelliteField(field.id, applied, signal),
    [field.id, applied.start, applied.end, applied.max_cloud_percent, runToken],
  );

  const rangeInvalid = start > end || end > today || start > today;

  const runAnalysis = () => {
    if (rangeInvalid) return;
    setApplied({
      start,
      end,
      max_cloud_percent: cloud,
      buffer_km: 0.5,
    });
    setRunToken((token) => token + 1);
  };

  const geeMisconfigured =
    state.error instanceof ApiError &&
    state.error.code === "GEE_UNAVAILABLE" &&
    ["GEE_NOT_CONFIGURED", "GEE_NOT_INSTALLED", "GEE_AUTH_FAILED"].includes(
      state.error.details ?? "",
    );

  return (
    <>
      <SectionHeading
        eyebrow={t("Satellite")}
        title={t("Latest Sentinel observations")}
        description={t(
          "Sentinel-1 C-band SAR for relative surface wetness and Sentinel-2 optical indices for canopy condition, reduced over the field geometry by Google Earth Engine.",
        )}
        actions={
          <span className="eyebrow">
            {field.boundary_geojson ? t("Saved boundary") : t("Centre + 0.5 km buffer")}
          </span>
        }
      />

      <section className="card card-pad" aria-label={t("Analysis settings")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="field-label">{t("Start date")}</span>
              <input
                type="date"
                value={start}
                max={today}
                onChange={(event) => setStart(event.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="field-label">{t("End date")}</span>
              <input
                type="date"
                value={end}
                max={today}
                onChange={(event) => setEnd(event.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="field-label">{t("Max cloud cover")}</span>
              <select
                value={cloud}
                onChange={(event) => setCloud(Number(event.target.value))}
                className="input"
              >
                {CLOUD_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={rangeInvalid || state.status === "loading"}
            className="btn-primary btn-sm"
          >
            {state.status === "loading" ? t("Analysing…") : t("Run satellite analysis")}
          </button>
        </div>
        {rangeInvalid ? (
          <p className="mt-3 text-2xs text-clay-600">
            {t("Choose a start date on or before the end date, and no future dates.")}
          </p>
        ) : (
          <p className="mt-3 text-2xs leading-relaxed text-muted">
            {t(
              "The analysis uses the saved boundary when one exists; otherwise it uses the field centre plus a 0.5 km buffer. The window can be at most 90 days.",
            )}
          </p>
        )}
      </section>

      {state.status === "loading" && (
        <div className="space-y-3">
          <LoadingState label={t("Earth Engine is reducing satellite pixels…")} rows={2} />
          <p className="text-center text-2xs text-muted">
            {t("The first analysis can take up to a minute while Earth Engine starts.")}
          </p>
        </div>
      )}

      {state.status === "error" && geeMisconfigured && (
        <div className="space-y-4">
          <InfoNote tone="warn" title={t("Satellite analysis is not enabled on this server")}>
            <p>{t(state.error?.message ?? "")}</p>
            <p className="mt-1.5">
              {t(
                "The backend needs an Earth Engine service account. Set GEE_SERVICE_ACCOUNT, GEE_PROJECT and either GEE_PRIVATE_KEY_FILE or GEE_PRIVATE_KEY_JSON, then restart the API.",
              )}
            </p>
            <p className="mt-1.5">
              {t(
                "No satellite values are invented while the integration is disabled; the rest of the platform keeps using NASA POWER and FAO-56.",
              )}
            </p>
          </InfoNote>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={state.reload} className="btn-secondary btn-sm">
              {t("Retry")}
            </button>
            <Link to={`/dashboard/${field.id}`} className="btn-secondary btn-sm">
              {t("Back to dashboard")}
            </Link>
          </div>
        </div>
      )}

      {state.status === "error" && !geeMisconfigured && (
        <ErrorState
          title={t("Satellite analysis unavailable")}
          message={state.error?.message ?? t("The satellite analysis could not be completed.")}
          details={t("Check the date window, or try again in a few minutes.")}
          onRetry={state.reload}
        />
      )}

      {state.status === "success" && state.data && (
        <AnalysisResults field={field} analysis={state.data} />
      )}
    </>
  );
}

/** Sentinel-1/2 snapshot through Google Earth Engine; never simulated. */
export function SatellitePage() {
  const params = useParams();
  const fieldId = useFieldIdFromRoute(params.fieldId);
  const { t } = useI18n();

  if (!fieldId) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title={t("No field selected")}
          description={t("Choose a field before opening the satellite analysis.")}
          action={
            <Link to="/fields" className="btn-primary btn-sm">
              {t("Go to fields")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <FieldLayout fieldId={fieldId} activeTab="satellite">
      {(field) => <SatelliteBody field={field} />}
    </FieldLayout>
  );
}
