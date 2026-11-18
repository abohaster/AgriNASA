import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import type { EnvironmentSeriesPoint, Field } from "../api/types";
import { AIChat } from "../components/data/AIChat";
import { AlertCard } from "../components/data/AlertCard";
import { CropHealthCard } from "../components/data/CropHealthCard";
import { FieldMap } from "../components/data/FieldMap";
import { IrrigationCard } from "../components/data/IrrigationCard";
import { WeatherCard } from "../components/data/WeatherCard";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/AsyncState";
import { ChartCard } from "../components/ui/ChartCard";
import { DataSourceBadge } from "../components/ui/DataSourceBadge";
import { HumidityIcon, RainIcon, SoilIcon, ThermometerIcon } from "../components/ui/Icons";
import { InfoNote } from "../components/ui/InfoNote";
import { PeriodSelector } from "../components/ui/PeriodSelector";
import { SectionHeading } from "../components/ui/SectionHeading";
import { useDataMode } from "../context/DataModeContext";
import { useTheme } from "../context/ThemeContext";
import { useAsync } from "../hooks/useAsync";
import { useFieldIdFromRoute } from "../hooks/useField";
import { useI18n } from "../i18n/I18nContext";
import { formatDate, formatDateShort, formatNumber } from "../lib/format";
import { resolvePeriod, type DatePeriod } from "../lib/period";
import { FieldLayout } from "../components/layout/FieldLayout";

/** Sum only real daily values; return null when the window has no data. */
function sumPrecipitation(points: EnvironmentSeriesPoint[]): number | null {
  const values = points.map((point) => point.precipitation_mm).filter((value) => value !== null);
  if (values.length === 0) return null;
  return values.reduce<number>((total, value) => total + (value as number), 0);
}

function DashboardBody({ field }: { field: Field }) {
  const { mode, isDemo } = useDataMode();
  const { chart } = useTheme();
  const { t } = useI18n();
  const [period, setPeriod] = useState<DatePeriod>(() => resolvePeriod("30d"));

  // Both the environment window and the "as of" date of the analyses are sent
  // to the API, so changing the period re-queries rather than slicing old data.
  const environmentState = useAsync(
    (signal) =>
      api.environment(field.id, {
        start: period.start,
        end: period.end,
        mode,
        signal,
      }),
    [field.id, mode, period.start, period.end],
  );
  const irrigationState = useAsync(
    (signal) => api.irrigation(field.id, { end: period.end, mode, signal }),
    [field.id, mode, period.end],
  );
  const healthState = useAsync(
    (signal) => api.healthAnalysis(field.id, { end: period.end, mode, signal }),
    [field.id, mode, period.end],
  );

  const environment = environmentState.data;
  const irrigation = irrigationState.data;
  const health = healthState.data;

  const periodPoints = environment?.series ?? [];
  const rainSelected = environment ? sumPrecipitation(periodPoints) : null;
  const hasUsableData = Boolean(
    environment &&
      periodPoints.some(
        (point) =>
          point.t2m_mean_c !== null ||
          point.precipitation_mm !== null ||
          point.rh_mean_pct !== null ||
          point.soil_moisture_root_fraction !== null,
      ),
  );
  const trendFor = (variable: string) =>
    environment?.summary.trends.find((trend) => trend.variable === variable);

  const priorities = [];
  if (irrigation?.status === "ok" && irrigation.demand === "high") {
    priorities.push(
      <AlertCard
        key="water"
        tone="danger"
        title={t("Irrigation demand is HIGH")}
        action={
          <Link to={`/irrigation/${field.id}`} className="btn-secondary btn-sm">
            {t("See calculation")}
          </Link>
        }
      >
        {t(
          irrigation.demand_reasons[0] ??
            "The root-zone water balance has crossed the high-demand threshold.",
        )}
      </AlertCard>,
    );
  }
  if (health?.status === "stressed") {
    priorities.push(
      <AlertCard
        key="health"
        tone="warn"
        title={t("Crop health is STRESSED")}
        action={
          <Link to={`/health/${field.id}`} className="btn-secondary btn-sm">
            {t("Review indicators")}
          </Link>
        }
      >
        {t(health.status_reason)}
      </AlertCard>,
    );
  }
  if (environment && environment.summary.coverage_fraction < 0.95) {
    priorities.push(
      <AlertCard
        key="coverage"
        tone="info"
        title={t("Some environmental inputs are incomplete")}
      >
        {t(
          "{n}% of days in this window have a complete set of ET₀ inputs. Missing values are shown as unavailable, never filled by estimation.",
          { n: formatNumber(environment.summary.coverage_fraction * 100, 0) },
        )}
      </AlertCard>,
    );
  }

  return (
    <>
      <SectionHeading
        eyebrow={t("Selected period")}
        title={t("Field overview")}
        description={
          environment
            ? t(
                "Environmental window {start} → {end}. NASA POWER values are model-derived for a coarse grid cell.",
                {
                  start: formatDate(environment.start),
                  end: formatDate(environment.end),
                },
              )
            : t("Loading the environmental window for this field.")
        }
        actions={
          environment ? (
            <DataSourceBadge source={environment.source} isDemo={environment.is_demo} />
          ) : undefined
        }
      />

      <PeriodSelector
        period={period}
        onChange={setPeriod}
        plantingDate={field.planting_date}
        disabled={isDemo}
      />

      {isDemo && (
        <InfoNote tone="warn" title={t("Demo mode uses a fixed window")}>
          {t(
            "The cached Qena snapshot cannot change dates. Switch to live data in the header to query a different period.",
          )}
        </InfoNote>
      )}

      {environment && (
        <p className="text-2xs leading-relaxed text-muted">
          {t("Actual data window: {start} → {end}", {
            start: formatDate(environment.start),
            end: formatDate(environment.end),
          })}
          {" · "}
          {t(
            "Source coverage: NASA POWER daily archive, 1981 → present (published with a delay).",
          )}
          {" · "}
          {t("Reanalysis (model)")}
        </p>
      )}

      {environmentState.status === "loading" && (
        <LoadingState label={t("Loading NASA POWER conditions…")} rows={4} />
      )}
      {environmentState.status === "error" && (
        <ErrorState
          title={t("Environmental data unavailable")}
          message={environmentState.error?.message ?? t("NASA POWER could not be reached.")}
          details={t(
            "You can retry, or switch on Demo data in the header to use the cached snapshot.",
          )}
          onRetry={environmentState.reload}
        />
      )}

      {environment && !hasUsableData && (
        <AlertCard tone="warn" title={t("Data unavailable for this period.")}>
          {t(
            "NASA POWER returned no usable daily values for the selected window. Choose another period; missing values are never filled with estimates.",
          )}
        </AlertCard>
      )}

      {environment && hasUsableData && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <WeatherCard
              label={t("Mean temperature")}
              value={environment.summary.latest.t2m_mean_c}
              unit={environment.units.t2m_mean_c ?? "°C"}
              icon={<ThermometerIcon size={18} />}
              date={environment.summary.latest_dates.t2m_mean_c}
              trend={trendFor("t2m_mean_c")}
              source={environment.source}
              isDemo={environment.is_demo}
            />
            <WeatherCard
              label={t("Rain, selected period")}
              value={rainSelected}
              unit="mm"
              icon={<RainIcon size={18} />}
              date={environment.end}
              source={environment.source}
              hint={t("Sum of daily corrected precipitation for the selected period.")}
              isDemo={environment.is_demo}
            />
            <WeatherCard
              label={t("Relative humidity")}
              value={environment.summary.latest.rh_mean_pct}
              unit="%"
              icon={<HumidityIcon size={18} />}
              date={environment.summary.latest_dates.rh_mean_pct}
              trend={trendFor("rh_mean_pct")}
              source={environment.source}
              decimals={0}
              isDemo={environment.is_demo}
            />
            <WeatherCard
              label={t("Root-zone soil wetness")}
              value={environment.summary.latest.soil_moisture_root_fraction}
              unit="fraction"
              icon={<SoilIcon size={18} />}
              date={environment.summary.latest_dates.soil_moisture_root_fraction}
              trend={trendFor("soil_moisture_root_fraction")}
              source={environment.source}
              hint={t(
                "MERRA-2 model-derived wetness — context only, not a soil probe or the bucket model.",
              )}
              decimals={2}
              isDemo={environment.is_demo}
            />
          </div>

          <ChartCard
            title={t("Temperature and rainfall")}
            description={t(
              "Daily NASA POWER values for {start} → {end}. Rainfall uses the right-hand axis.",
              {
                start: formatDate(environment.start),
                end: formatDate(environment.end),
              },
            )}
            height={270}
            source={<DataSourceBadge source={environment.source} isDemo={environment.is_demo} />}
            footnote={t("Daily means · °C / mm · bars are daily totals")}
          >
            {periodPoints.length === 0 ? (
              <EmptyState
                title={t("No daily values")}
                description={t(
                  "The selected period returned no environmental points.",
                )}
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={periodPoints} margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 10, fill: chart.tick }}
                    minTickGap={28}
                    axisLine={{ stroke: chart.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="temp"
                    tick={{ fontSize: 10, fill: chart.tick }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    unit="°"
                  />
                  <YAxis
                    yAxisId="rain"
                    orientation="right"
                    tick={{ fontSize: 10, fill: chart.tick }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={chart.tooltip.contentStyle}
                    labelStyle={chart.tooltip.labelStyle}
                    labelFormatter={(label) => formatDate(String(label))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    yAxisId="rain"
                    dataKey="precipitation_mm"
                    name={t("Rainfall (mm)")}
                    fill={chart.rain}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={12}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="t2m_mean_c"
                    name={t("Mean temperature (°C)")}
                    stroke={chart.tempMean}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {priorities.length > 0 && (
            <section aria-label={t("Current priorities")} className="space-y-3">
              <h2 className="text-sm font-semibold">{t("Current priorities")}</h2>
              {priorities}
            </section>
          )}
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <section aria-label={t("Irrigation demand")}>
            {irrigationState.status === "loading" && (
              <LoadingState label={t("Running the irrigation model…")} rows={2} variant="list" />
            )}
            {irrigationState.status === "error" && (
              <ErrorState
                title={t("Irrigation analysis unavailable")}
                message={irrigationState.error?.message ?? t("The water balance could not be computed.")}
                onRetry={irrigationState.reload}
              />
            )}
            {irrigation && <IrrigationCard analysis={irrigation} fieldId={field.id} />}
          </section>

          <section aria-label={t("Crop health")}>
            {healthState.status === "loading" && (
              <LoadingState label={t("Assessing environmental stress…")} rows={2} variant="list" />
            )}
            {healthState.status === "error" && (
              <ErrorState
                title={t("Crop health unavailable")}
                message={healthState.error?.message ?? t("The health indicators could not be computed.")}
                onRetry={healthState.reload}
              />
            )}
            {health && <CropHealthCard analysis={health} fieldId={field.id} compact />}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card overflow-hidden" aria-label={t("Field location")}>
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">{t("Field location")}</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {field.location_label ?? t("Custom coordinates")}
                </p>
              </div>
              <span className="font-mono text-2xs text-muted" dir="ltr">
                {field.latitude.toFixed(4)}, {field.longitude.toFixed(4)}
              </span>
            </header>
            <div className="p-3">
              <FieldMap
                latitude={field.latitude}
                longitude={field.longitude}
                label={field.name}
                boundary={field.boundary_geojson}
                areaHa={field.area_ha}
                height={260}
                allowGibs
              />
            </div>
            <div className="border-t border-line px-5 py-3 text-2xs leading-relaxed text-muted">
              {t(
                field.boundary_geojson
                  ? "Boundary supplied by the field profile."
                  : "Coordinate point only — no field boundary is stored, so none is drawn.",
              )}{" "}
              {t("NASA GIBS imagery is optional visual context; no values are read from it.")}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
              <Link
                to={`/location?field=${field.id}&tab=soil`}
                className="btn-secondary btn-sm"
              >
                {t("Soil properties")}
              </Link>
              <Link
                to={`/location?field=${field.id}&tab=vegetation`}
                className="btn-secondary btn-sm"
              >
                {t("Vegetation")}
              </Link>
              <Link to={`/crop?field=${field.id}`} className="btn-secondary btn-sm">
                {t("Crop suitability")}
              </Link>
            </div>
          </section>

          <section aria-label={t("Assistant preview")}>
            <AIChat fieldId={field.id} compact />
          </section>

          {environment && (
            <section className="card card-pad" aria-label={t("Data sources")}>
              <h2 className="text-sm font-semibold">{t("Data sources & limits")}</h2>
              <div className="mt-2.5 space-y-2.5">
                <DataSourceBadge source={environment.source} isDemo={environment.is_demo} />
                {irrigation && <DataSourceBadge source={irrigation.source} isDemo={irrigation.is_demo} />}
              </div>
              <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-2xs leading-relaxed text-muted">
                {environment.limitations.slice(0, 3).map((limitation) => (
                  <li key={limitation} className="flex gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden="true" />
                    <span>{t(limitation)}</span>
                  </li>
                ))}
              </ul>
              {isDemo && (
                <InfoNote tone="warn" className="mt-3">
                  {t(
                    "Demo mode replays the cached Qena snapshot. Values, units and calculations are real; the location and dates are not this field's.",
                  )}
                </InfoNote>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

/**
 * Main field dashboard.
 *
 * Section order mirrors the decision hierarchy: environmental status → irrigation
 * demand → crop health → location/map → assistant → data provenance.
 */
export function DashboardPage() {
  const params = useParams();
  const fieldId = useFieldIdFromRoute(params.fieldId);
  const { t } = useI18n();

  if (!fieldId) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title={t("No field selected")}
          description={t("Choose or create a field to open its dashboard.")}
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
    <FieldLayout fieldId={fieldId} activeTab="dashboard">
      {(field) => <DashboardBody field={field} />}
    </FieldLayout>
  );
}
