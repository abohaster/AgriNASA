import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import type {
  CropHealthAnalysis,
  Field,
  MoistureCondition,
  VegetationCondition,
  VegetationResponse,
} from "../api/types";
import { SatelliteMap } from "../components/data/SatelliteMap";
import { FieldLayout } from "../components/layout/FieldLayout";
import { AnalysisDateField } from "../components/ui/AnalysisDateField";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/AsyncState";
import { DataSourceBadge } from "../components/ui/DataSourceBadge";
import { Formula } from "../components/ui/Formula";
import { InfoNote } from "../components/ui/InfoNote";
import { SectionHeading } from "../components/ui/SectionHeading";
import { StatusPill } from "../components/ui/StatusPill";
import type { Tone } from "../components/ui/StatusPill";
import { useDataMode } from "../context/DataModeContext";
import { useTheme } from "../context/ThemeContext";
import { useAsync } from "../hooks/useAsync";
import { useFieldIdFromRoute } from "../hooks/useField";
import { useI18n } from "../i18n/I18nContext";
import { formatDate, formatDateShort, formatNumber } from "../lib/format";
import { HEALTH_META, INDICATOR_TONE } from "../lib/labels";

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

function IndicatorList({ analysis }: { analysis: CropHealthAnalysis }) {
  const { t } = useI18n();

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {analysis.indicators.map((indicator) => (
        <li key={indicator.id} className="rounded-md border border-line bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{t(indicator.label)}</p>
              <p className="mono-data mt-1 text-lg text-ink">
                {indicator.value === null ? (
                  <span className="text-sm font-normal text-muted">{t("No value")}</span>
                ) : (
                  <>
                    {typeof indicator.value === "number"
                      ? formatNumber(indicator.value, 1)
                      : indicator.value}
                    {indicator.unit ? (
                      <span className="ms-1 text-xs font-normal text-muted">{t(indicator.unit)}</span>
                    ) : null}
                  </>
                )}
              </p>
            </div>
            <StatusPill tone={INDICATOR_TONE[indicator.status]} dot={false}>
              {indicator.status === "unknown" ? t("No data") : t(indicator.status)}
            </StatusPill>
          </div>
          <p className="mt-2 text-2xs leading-relaxed text-muted">{t(indicator.interpretation)}</p>
        </li>
      ))}
    </ul>
  );
}

function NdviChart({ vegetation }: { vegetation: VegetationResponse }) {
  const { chart } = useTheme();
  const { t } = useI18n();

  if (vegetation.series.length < 2) {
    return (
      <InfoNote tone="info" title={t("One usable Sentinel-2 pass in the window")}>
        <p className="leading-relaxed">
          {t(
            "A trend needs two cloud-free acquisitions. The value above is the latest pass; a two-date comparison will appear after the next usable Sentinel-2 overpass.",
          )}
        </p>
      </InfoNote>
    );
  }

  const tooltipProps = {
    contentStyle: chart.tooltip.contentStyle,
    labelStyle: chart.tooltip.labelStyle,
    labelFormatter: (label: unknown) => formatDate(String(label)),
  };
  const axis = { fontSize: 10, fill: chart.tick };

  return (
    <div dir="ltr" className="h-[220px] min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={vegetation.series} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
        <defs>
          <linearGradient id="ndviFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chart.ndvi} stopOpacity={0.35} />
            <stop offset="100%" stopColor={chart.ndvi} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateShort}
          tick={axis}
          minTickGap={30}
          tickLine={false}
          axisLine={{ stroke: chart.grid }}
        />
        <YAxis domain={[0, 1]} tick={axis} tickLine={false} axisLine={false} width={42} />
        <Tooltip
          {...tooltipProps}
          formatter={(value: number) => [formatNumber(value, 3), t("NDVI")]}
        />
        <Area
          type="monotone"
          dataKey="ndvi"
          stroke={chart.ndvi}
          strokeWidth={2}
          fill="url(#ndviFill)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}

function VegetationPanel({
  health,
  vegetation,
  field,
  loading,
  error,
}: {
  health: CropHealthAnalysis;
  vegetation: VegetationResponse | null;
  field: Field;
  loading: boolean;
  error: string | null;
}) {
  const { t } = useI18n();

  const live = Boolean(vegetation?.available && vegetation.latest);
  const available = vegetation ? vegetation.available : health.vegetation.available;
  const passDate = vegetation?.acquisition_date ?? vegetation?.latest?.date ?? null;

  return (
    <section className="card card-pad" aria-label={t("Vegetation index")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t("Vegetation index (NDVI)")}</h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-muted">
            {t(
              "Sentinel-2 surface reflectance via Google Earth Engine. It describes canopy condition; it is not a crop-stage measurement and cannot identify disease.",
            )}
          </p>
          {vegetation?.provider ? (
            <p className="mt-1 text-2xs text-muted">{vegetation.provider}</p>
          ) : null}
        </div>
        <StatusPill tone={available ? "good" : "neutral"} dot={false}>
          {available ? t("Available") : t("Unavailable")}
        </StatusPill>
      </div>

      {loading && (
        <p className="mt-3 text-xs text-muted">{t("Checking vegetation observations…")}</p>
      )}

      {!loading && (error || !vegetation || !vegetation.available) && (
        <InfoNote tone="warn" className="mt-3" title={t("NDVI is not available for this field")}>
          <p className="leading-relaxed">
            {error
              ? t(error)
              : vegetation?.reason
                ? t(vegetation.reason)
                : health.vegetation.note
                  ? t(health.vegetation.note)
                  : t("Earth Engine is not configured on this server.")}
          </p>
          <p className="mt-1.5 leading-relaxed">
            {t(
              "No NDVI value is invented or substituted. Crop health continues to use the environmental indicators that are available.",
            )}
          </p>
        </InfoNote>
      )}

      {!loading && live && vegetation && vegetation.latest && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="field-label">{t("NDVI")}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="mono-data text-3xl font-semibold">
                  {formatNumber(vegetation.latest.ndvi, 3)}
                </p>
                <StatusPill tone={NDVI_TONE[vegetation.ndvi_condition]} dot={false}>
                  {t(NDVI_LABEL[vegetation.ndvi_condition])}
                </StatusPill>
              </div>
            </div>
            {vegetation.ndmi !== null && (
              <div>
                <p className="field-label">{t("NDMI")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="mono-data text-3xl font-semibold">
                    {formatNumber(vegetation.ndmi, 3)}
                  </p>
                  <StatusPill tone={NDMI_TONE[vegetation.ndmi_condition]} dot={false}>
                    {t(NDMI_LABEL[vegetation.ndmi_condition])}
                  </StatusPill>
                </div>
              </div>
            )}
            <div>
              <p className="field-label">{t("Trend")}</p>
              <p className="mt-1 text-sm font-medium text-ink">{t(vegetation.trend)}</p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted">
            {vegetation.composite ? t("Median composite") : t("Latest usable scene")}
            {passDate ? (
              <>
                {" · "}
                {t("Sentinel-2 pass {date}", { date: formatDate(passDate) })}
              </>
            ) : null}
            {vegetation.cloud_cover_percent !== null ? (
              <>
                {" · "}
                {t("Cloud cover {percent}%", {
                  percent: formatNumber(vegetation.cloud_cover_percent, 1),
                })}
              </>
            ) : null}
            {vegetation.scene_count !== null ? (
              <>
                {" · "}
                {t("{count} scenes in the window", { count: vegetation.scene_count })}
              </>
            ) : null}
          </p>

          {vegetation.interpretation && (
            <p className="text-xs leading-relaxed text-muted">{t(vegetation.interpretation)}</p>
          )}

          {vegetation.tile && (
            <SatelliteMap
              latitude={field.latitude}
              longitude={field.longitude}
              label={field.name}
              boundary={field.boundary_geojson}
              areaHa={field.area_ha}
              tiles={{
                ndvi: vegetation.tile,
                ndmi: null,
                soil_moisture: null,
                true_color: null,
              }}
              height={240}
            />
          )}

          <NdviChart vegetation={vegetation} />

          <p className="text-2xs leading-relaxed text-muted">{t(vegetation.formula)}</p>
        </div>
      )}

      {vegetation && vegetation.limitations.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-2xs leading-relaxed text-muted">
          {vegetation.limitations.map((limitation) => (
            <li key={limitation} className="flex gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden="true" />
              <span>{t(limitation)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HealthBody({ fieldId, field }: { fieldId: number; field: Field }) {
  const { t, isRtl } = useI18n();
  const { mode } = useDataMode();
  const [analysisDate, setAnalysisDate] = useState<string | null>(null);
  const healthState = useAsync(
    (signal) => api.healthAnalysis(fieldId, { mode, end: analysisDate ?? undefined, signal }),
    [fieldId, mode, analysisDate],
  );
  const vegetationState = useAsync((signal) => api.vegetation(fieldId, { mode, signal }), [
    fieldId,
    mode,
  ]);

  const dateControl = <AnalysisDateField value={analysisDate} onChange={setAnalysisDate} />;

  if (healthState.status === "loading") {
    return (
      <>
        {dateControl}
        <LoadingState
          label={t("Assessing environmental stress indicators…")}
          rows={3}
          variant="cards"
        />
      </>
    );
  }

  if (healthState.status === "error") {
    return (
      <>
        {dateControl}
        <ErrorState
          title={t("Crop health analysis unavailable")}
          message={healthState.error?.message ?? t("The health indicators could not be computed.")}
          details={t("Retry, or enable Demo data in the header to use the cached snapshot.")}
          onRetry={healthState.reload}
        />
      </>
    );
  }

  const analysis = healthState.data;
  if (!analysis) return null;

  const meta = HEALTH_META[analysis.status];
  const seasonComplete = analysis.season_complete;
  const insufficient = analysis.status === "insufficient_data";
  const statusLabel = seasonComplete ? t("Season complete") : t(meta.label);
  const agreement = analysis.indicator_agreement;

  return (
    <>
      <div className="space-y-1.5">
        {dateControl}
        <p className="text-2xs leading-relaxed text-muted">
          {t("The satellite index always shows the latest usable pass, not the selected date.")}
        </p>
      </div>
      <SectionHeading
        eyebrow={t("Crop health")}
        title={t("Environmental stress indicators")}
        description={t(
          "Assessed for {date} from weather, water-balance and optional vegetation inputs. This module does not diagnose disease, pests or nutrient deficiency.",
          { date: formatDate(analysis.computed_for) },
        )}
        actions={<DataSourceBadge source={analysis.source} isDemo={analysis.is_demo} />}
      />

      <section
        className={`card overflow-hidden ${insufficient && !seasonComplete ? "border-clay-200" : ""}`}
      >
        <div className="flex flex-col gap-4 border-b border-line bg-sage-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">{t("Overall assessment")}</p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.03em]">
              {seasonComplete
                ? t("SEASON COMPLETE")
                : isRtl
                  ? statusLabel
                  : statusLabel.toUpperCase()}
            </p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
              {seasonComplete ? t(analysis.status_reason) : t(meta.description)}
            </p>
            {!seasonComplete && (
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
                {t(analysis.status_reason)}
              </p>
            )}
          </div>
          <StatusPill tone={seasonComplete ? "neutral" : meta.tone}>{statusLabel}</StatusPill>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <p className="text-sm leading-relaxed text-ink/90">
              {seasonComplete
                ? t("Create a new field with the next planting date to analyse the new season.")
                : t(analysis.summary)}
            </p>
            {agreement && agreement.percent !== null && !seasonComplete && (
              <div className="mt-4 rounded-md border border-line bg-card px-4 py-3">
                <p className="field-label">{t("Indicator agreement")}</p>
                <p className="mono-data mt-1 text-2xl font-semibold text-ink">
                  {formatNumber(agreement.percent, 0)}%
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {t("Not at stress level: {clean} of {known} available indicators.", {
                    clean: agreement.known - agreement.stressed,
                    known: agreement.known,
                  })}
                </p>
                <p className="mt-1.5 text-2xs leading-relaxed text-muted">
                  {t(agreement.definition)}
                </p>
              </div>
            )}
            {!seasonComplete && (
              <div className="mt-4">
                <p className="field-label">{t("Indicators")}</p>
                <IndicatorList analysis={analysis} />
              </div>
            )}
          </div>

          <aside className="space-y-3">
            {analysis.missing_inputs.length > 0 && (
              <InfoNote title={t("Missing inputs")} tone="warn">
                <ul className="space-y-1">
                  {analysis.missing_inputs.map((item) => (
                    <li key={item}>• {t(item)}</li>
                  ))}
                </ul>
              </InfoNote>
            )}
            <div className="rounded-md border border-line bg-card p-4">
              <p className="text-xs font-semibold text-ink">{t("How the status is decided")}</p>
              <p className="mt-1 text-2xs leading-relaxed text-muted">
                {t(
                  "Each known indicator is classified independently. The overall status needs at least two known indicators; otherwise it stays “insufficient data”. Unknown indicators are never treated as good.",
                )}
              </p>
            </div>
            <p className="rounded-md border border-line bg-sage-50 p-4 text-2xs leading-relaxed text-muted">
              {t(
                "This is an environmental screening tool. It is not a disease, pest or nutrient diagnosis, and no confidence percentage is attached to a stress class.",
              )}
            </p>
          </aside>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <VegetationPanel
            health={analysis}
            vegetation={vegetationState.data}
            field={field}
            loading={vegetationState.status === "loading"}
            error={vegetationState.error?.message ?? null}
          />

          <section className="card card-pad" aria-label={t("Indicator method")}>
            <h2 className="text-sm font-semibold">{t("Indicator definitions")}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Formula
                name="Heat stress"
                expression="T max ≥ 30 °C  →  stress"
                variables={[
                  { symbol: "T max", meaning: "daily maximum air temperature (°C)" },
                  { symbol: "watch", meaning: "25–30 °C is flagged for monitoring" },
                ]}
                note="Thresholds are documented agronomic heuristics, not a crop model."
              />
              <Formula
                name="Frost risk"
                expression="T min ≤ 0 °C  →  stress"
                variables={[
                  { symbol: "T min", meaning: "daily minimum air temperature (°C)" },
                  { symbol: "watch", meaning: "0–3 °C is flagged for monitoring" },
                ]}
              />
              <Formula
                name="Water stress"
                expression={"depletion ÷ TAW ≥ 0.55  →  watch\n≥ 0.80  →  stress"}
                variables={[
                  { symbol: "depletion", meaning: "root-zone water deficit from the bucket model" },
                  { symbol: "TAW", meaning: "total available water for the assumed soil" },
                ]}
                note="Inherits every assumption of the irrigation model."
              />
              <Formula
                name="Rainfall anomaly"
                expression="P window ÷ P climatology − 1"
                variables={[
                  { symbol: "P window", meaning: "observed precipitation in the analysis window" },
                  { symbol: "P climatology", meaning: "1991–2020 monthly normals for the same months" },
                ]}
                note="Shown as unknown when climatology is unavailable — no value is substituted."
              />
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card card-pad" aria-label={t("Limitations")}>
            <h2 className="text-sm font-semibold">{t("Limitations")}</h2>
            <ul className="mt-2 space-y-2 text-2xs leading-relaxed text-muted">
              {analysis.limitations.map((limitation) => (
                <li key={limitation} className="flex gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden="true" />
                  <span>{t(limitation)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
                {t("What this page will not do")}
              </p>
              <ul className="mt-1 space-y-1 text-2xs leading-relaxed text-muted">
                <li>• {t("Identify a disease, pest or nutrient deficiency.")}</li>
                <li>• {t("Assign a confidence percentage to a stress class.")}</li>
                <li>• {t("Treat missing indicators as healthy.")}</li>
              </ul>
            </div>
            <p className="mt-3 text-2xs text-muted">
              {t("For the water-balance detail behind the stress indicator, open")}{" "}
              <Link to={`/irrigation/${fieldId}`} className="link-underline">
                {t("irrigation analysis")}
              </Link>
              .
            </p>
          </section>

          <section className="card card-pad" aria-label={t("Ask the assistant")}>
            <h2 className="text-sm font-semibold">{t("Explain these results")}</h2>
            <p className="mt-1 text-2xs leading-relaxed text-muted">
              {t(
                "The field assistant can explain why an indicator is flagged, using the same computed data shown here. It cannot add observations or diagnose a disease.",
              )}
            </p>
            <Link to={`/assistant/${fieldId}`} className="btn-secondary btn-sm mt-3">
              {t("Ask the field assistant")}
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}

/** Environmental stress screening: indicators, live Sentinel-2 NDVI/NDMI and limitations. */
export function CropHealthPage() {
  const params = useParams();
  const fieldId = useFieldIdFromRoute(params.fieldId);
  const { t } = useI18n();

  if (!fieldId) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title={t("No field selected")}
          description={t("Choose a field before opening the crop-health analysis.")}
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
    <FieldLayout fieldId={fieldId} activeTab="health">
      {(field) => <HealthBody fieldId={fieldId} field={field} />}
    </FieldLayout>
  );
}
