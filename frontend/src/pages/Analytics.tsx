import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Field } from "../api/types";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import type { EnvironmentResponse } from "../api/types";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/AsyncState";
import { ChartCard } from "../components/ui/ChartCard";
import { DataSourceBadge } from "../components/ui/DataSourceBadge";
import { InfoNote } from "../components/ui/InfoNote";
import { SectionHeading } from "../components/ui/SectionHeading";
import { useDataMode } from "../context/DataModeContext";
import { useTheme } from "../context/ThemeContext";
import { useAsync } from "../hooks/useAsync";
import { useFieldIdFromRoute } from "../hooks/useField";
import { useI18n } from "../i18n/I18nContext";
import { formatDate, formatDateShort, formatNumber } from "../lib/format";
import { VARIABLE_META } from "../lib/labels";
import { resolvePeriod, type DatePeriod } from "../lib/period";
import { PeriodSelector } from "../components/ui/PeriodSelector";
import { FieldLayout } from "../components/layout/FieldLayout";

function EnvironmentCharts({ environment }: { environment: EnvironmentResponse }) {
  const { chart } = useTheme();
  const { t } = useI18n();
  const points = environment.series;
  const source = <DataSourceBadge source={environment.source} isDemo={environment.is_demo} />;

  const tooltipProps = {
    contentStyle: chart.tooltip.contentStyle,
    labelStyle: chart.tooltip.labelStyle,
    labelFormatter: (label: unknown) => formatDate(String(label)),
  };

  const axis = { fontSize: 10, fill: chart.tick };

  if (points.length === 0) {
    return (
      <EmptyState
        title={t("No environmental points")}
        description={t("The selected window returned no daily values. Try a different range.")}
      />
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2" dir="ltr">
      <ChartCard
        title={t("Air temperature")}
        description={t("Daily mean, maximum and minimum at 2 m.")}
        height={280}
        source={source}
        footnote={t("°C · NASA POWER daily values")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={axis}
              minTickGap={26}
              tickLine={false}
              axisLine={{ stroke: chart.grid }}
            />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={40} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="t2m_max_c"
              name={t("T max (°C)")}
              stroke={chart.tempMax}
              strokeWidth={1.8}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="t2m_mean_c"
              name={t("T mean (°C)")}
              stroke={chart.tempMean}
              strokeWidth={2.2}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="t2m_min_c"
              name={t("T min (°C)")}
              stroke={chart.tempMin}
              strokeWidth={1.8}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={t("Rainfall and reference ET₀")}
        description={t(
          "Precipitation is a daily total; ET₀ is the FAO-56 atmospheric demand calculated from the same weather inputs.",
        )}
        height={280}
        source={source}
        footnote={t("mm and mm/day · bars are rainfall")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={axis}
              minTickGap={26}
              tickLine={false}
              axisLine={{ stroke: chart.grid }}
            />
            <YAxis yAxisId="rain" tick={axis} tickLine={false} axisLine={false} width={38} />
            <YAxis
              yAxisId="et0"
              orientation="right"
              tick={axis}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip {...tooltipProps} />
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
              yAxisId="et0"
              type="monotone"
              dataKey="et0_mm_day"
              name={t("ET₀ (mm/day)")}
              stroke={chart.et0}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={t("Relative humidity")}
        description={t("Daily mean relative humidity at 2 m.")}
        height={250}
        source={source}
        footnote={t("% · higher values reduce atmospheric demand")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={axis}
              minTickGap={26}
              tickLine={false}
              axisLine={{ stroke: chart.grid }}
            />
            <YAxis domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} width={38} />
            <Tooltip {...tooltipProps} />
            <Line
              type="monotone"
              dataKey="rh_mean_pct"
              name={t("Humidity (%)")}
              stroke={chart.humidity}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={t("Solar radiation")}
        description={t(
          "All-sky shortwave downward irradiance — the energy input to evapotranspiration.",
        )}
        height={250}
        source={source}
        footnote={t("MJ/m²/day")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
            <defs>
              <linearGradient id="solarFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chart.solar} stopOpacity={0.28} />
                <stop offset="100%" stopColor={chart.solar} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={axis}
              minTickGap={26}
              tickLine={false}
              axisLine={{ stroke: chart.grid }}
            />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={38} />
            <Tooltip {...tooltipProps} />
            <Area
              type="monotone"
              dataKey="solar_radiation_mj_m2_day"
              name={t("Solar radiation (MJ/m²/day)")}
              stroke={chart.solar}
              strokeWidth={2}
              fill="url(#solarFill)"
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={t("Wind speed")}
        description={t("Mean wind speed at 2 m, used by the Penman–Monteith ET₀ equation.")}
        height={250}
        source={source}
        footnote={t("m/s")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={axis}
              minTickGap={26}
              tickLine={false}
              axisLine={{ stroke: chart.grid }}
            />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={38} />
            <Tooltip {...tooltipProps} />
            <Line
              type="monotone"
              dataKey="wind_speed_2m_ms"
              name={t("Wind (m/s)")}
              stroke={chart.wind}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={t("Root-zone soil wetness")}
        description={t(
          "MERRA-2 model-derived wetness fraction. This is context for the water balance, not a soil-moisture probe.",
        )}
        height={250}
        source={source}
        footnote={t("0–1 fraction · not used as a measured input to the bucket model")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={axis}
              minTickGap={26}
              tickLine={false}
              axisLine={{ stroke: chart.grid }}
            />
            <YAxis domain={[0, 1]} tick={axis} tickLine={false} axisLine={false} width={38} />
            <Tooltip {...tooltipProps} />
            <Line
              type="monotone"
              dataKey="soil_moisture_root_fraction"
              name={t("Soil wetness (fraction)")}
              stroke={chart.soil}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function AnalyticsBody({ field }: { field: Field }) {
  const { t } = useI18n();
  const { mode, isDemo } = useDataMode();
  const [period, setPeriod] = useState<DatePeriod>(() => resolvePeriod("30d"));
  const fieldId = field.id;

  const environmentState = useAsync(
    (signal) =>
      api.environment(fieldId, {
        start: period.start,
        end: period.end,
        mode,
        signal,
      }),
    [fieldId, mode, period.start, period.end],
  );

  const environment = environmentState.data;

  // Demo replay returns its own fixed window, so display what was actually
  // returned instead of the requested dates.
  const shownStart = environment?.start ?? period.start;
  const shownEnd = environment?.end ?? period.end;

  return (
    <>
      <SectionHeading
        eyebrow={t("Environmental analytics")}
        title={t("Conditions over time")}
        description={t(
          "Daily NASA POWER values for the field's grid cell. Every chart states its units and source; missing values are gaps, not zeroes.",
        )}
      />

      {isDemo && (
        <InfoNote tone="warn" title={t("Demo mode uses a fixed window")}>
          {t("The cached Qena snapshot cannot change dates. Every request replays")}{" "}
          {environment ? (
            <>
              {formatDate(environment.start)} → {formatDate(environment.end)}
            </>
          ) : (
            t("the same fixed snapshot period")
          )}
          {t(", so the range controls are disabled.")}
        </InfoNote>
      )}

      <PeriodSelector
        period={period}
        onChange={setPeriod}
        plantingDate={field.planting_date}
        disabled={isDemo}
      />

      <p className="font-mono text-2xs text-muted" dir="ltr">
        {shownStart} → {shownEnd}
        {environment?.is_demo ? ` · ${t("demo replay")}` : ""}
      </p>

      {environmentState.status === "loading" && (
        <LoadingState label={t("Loading daily NASA POWER data…")} rows={2} variant="chart" />
      )}

      {environmentState.status === "error" && (
        <ErrorState
          title={t("Environmental data could not be loaded")}
          message={environmentState.error?.message ?? t("NASA POWER did not return data.")}
          details={t("Try a shorter range, retry, or enable Demo data in the header.")}
          onRetry={environmentState.reload}
        />
      )}

      {environment && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4">
              <p className="text-2xs uppercase tracking-[0.08em] text-muted">{t("Days returned")}</p>
              <p className="mono-data mt-1 text-xl font-semibold">{environment.summary.days_returned}</p>
            </div>
            <div className="card p-4">
              <p className="text-2xs uppercase tracking-[0.08em] text-muted">
                {t("ET₀ input coverage")}
              </p>
              <p className="mono-data mt-1 text-xl font-semibold">
                {formatNumber(environment.summary.coverage_fraction * 100, 0)}%
              </p>
            </div>
            <div className="card p-4">
              <p className="text-2xs uppercase tracking-[0.08em] text-muted">{t("Rainfall total")}</p>
              <p className="mono-data mt-1 text-xl font-semibold">
                {formatNumber(environment.summary.precipitation_total_mm, 1)}{" "}
                <span className="text-sm font-normal text-muted">{t("mm")}</span>
              </p>
            </div>
            <div className="card p-4">
              <p className="text-2xs uppercase tracking-[0.08em] text-muted">{t("Mean ET₀")}</p>
              <p className="mono-data mt-1 text-xl font-semibold">
                {formatNumber(environment.summary.et0_mean_mm_day, 2)}{" "}
                <span className="text-sm font-normal text-muted">{t("mm/day")}</span>
              </p>
            </div>
          </div>

          {environment.missing_variables.length > 0 && (
            <InfoNote title={t("Incomplete variables in this window")} tone="warn">
              {environment.missing_variables
                .map(
                  (variable) =>
                    t(VARIABLE_META[variable as keyof typeof VARIABLE_META]?.label ?? variable),
                )
                .join(", ")}
              {". "}
              {t(
                "These are shown as gaps; the platform does not fill them with estimated weather.",
              )}
            </InfoNote>
          )}

          <EnvironmentCharts environment={environment} />

          <section className="card card-pad">
            <h2 className="text-sm font-semibold">{t("Data provenance & limitations")}</h2>
            <div className="mt-2">
              <DataSourceBadge source={environment.source} isDemo={environment.is_demo} />
            </div>
            <ul className="mt-3 grid gap-2 text-xs leading-relaxed text-muted sm:grid-cols-2">
              {environment.limitations.map((limitation) => (
                <li key={limitation} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden="true" />
                  <span>{t(limitation)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-2xs text-muted">
              {t("Looking for the irrigation interpretation? Open")}{" "}
              <Link to={`/irrigation/${fieldId}`} className="link-underline">
                {t("Irrigation analysis")}
              </Link>
              .
            </p>
          </section>
        </>
      )}
    </>
  );
}

/** Historical environmental charts with 7/30/90-day and custom windows. */
export function AnalyticsPage() {
  const params = useParams();
  const fieldId = useFieldIdFromRoute(params.fieldId);
  const { t } = useI18n();

  if (!fieldId) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title={t("No field selected")}
          description={t("Choose a field before opening analytics.")}
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
    <FieldLayout fieldId={fieldId} activeTab="analytics">
      {(field) => <AnalyticsBody field={field} />}
    </FieldLayout>
  );
}
