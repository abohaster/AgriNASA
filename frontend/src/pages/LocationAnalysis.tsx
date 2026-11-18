import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
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
import type {
  HistoryResponse,
  LocationOverview,
  SoilBlock,
  VegetationBlock,
} from "../api/types";
import { AlertCard } from "../components/data/AlertCard";
import { LocationHeader, SourceBadges } from "../components/location/LocationHeader";
import { ReadingGrid } from "../components/location/ReadingGrid";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/AsyncState";
import { ChartCard } from "../components/ui/ChartCard";
import { DataSourceBadge } from "../components/ui/DataSourceBadge";
import { InfoNote } from "../components/ui/InfoNote";
import { MetricCard } from "../components/ui/MetricCard";
import { StatusPill } from "../components/ui/StatusPill";
import { useTheme } from "../context/ThemeContext";
import { useAsync } from "../hooks/useAsync";
import { useI18n } from "../i18n/I18nContext";
import { formatDate, formatDateShort, formatNumber, titleCase } from "../lib/format";
import {
  ringRequest,
  useSelectedLocation,
  type SelectedLocation,
} from "../lib/location";

type TabKey = "overview" | "weather" | "soil" | "water" | "vegetation" | "historical";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "weather", label: "Weather" },
  { key: "soil", label: "Soil" },
  { key: "water", label: "Water" },
  { key: "vegetation", label: "Vegetation" },
  { key: "historical", label: "Historical data" },
];

const ALERT_TONE = { high: "danger", moderate: "warn", info: "info" } as const;

function signed(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "—";
  const formatted = formatNumber(value, decimals);
  return value > 0 ? `+${formatted}` : formatted;
}

function categoryLabel(category: string): string {
  switch (category) {
    case "surplus":
      return "Surplus";
    case "near_balance":
      return "Near balance";
    case "deficit":
      return "Deficit";
    case "severe_deficit":
      return "Severe deficit";
    default:
      return category;
  }
}

function Limitations({ items }: { items?: string[] }) {
  const { t } = useI18n();
  if (!items || items.length === 0) return null;
  return (
    <div className="card card-pad">
      <h3 className="text-sm font-semibold">{t("Limitations")}</h3>
      <ul className="mt-2 space-y-1.5 text-2xs leading-relaxed text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden="true" />
            <span>{t(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OverviewTab({ overview }: { overview: LocationOverview }) {
  const { t } = useI18n();
  const details = overview.location;

  const detailRows = [
    { label: "Country", value: [details.country, details.country_code].filter(Boolean).join(" · ") },
    { label: "Region", value: details.region },
    { label: "County / district", value: details.county },
    { label: "Nearest place", value: details.nearest_place },
    { label: "Suburb", value: details.suburb },
    { label: "Road", value: details.road },
    {
      label: "Analysis cell",
      value:
        details.analysis_latitude !== null && details.analysis_longitude !== null
          ? `${formatNumber(details.analysis_latitude, 4)}, ${formatNumber(details.analysis_longitude, 4)}`
          : null,
    },
    { label: "Geometry", value: details.geometry_source === "polygon" ? t("Polygon field") : t("Point") },
  ].filter((row) => row.value);

  return (
    <div className="space-y-5">
      {!overview.available && (
        <AlertCard tone="warn" title={t("Live conditions are unavailable right now")}>
          {t("The overview request returned no data. Weather and water values are withheld rather than estimated.")}
        </AlertCard>
      )}

      {overview.current.available ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("Current conditions")}</h2>
          <ReadingGrid
            readings={overview.current.readings ?? []}
            sources={overview.sources}
          />
          {overview.current.time && (
            <p className="text-2xs text-muted">
              {t("Observed: {value}", { value: overview.current.time })}
              {overview.current.elevation_m !== null && overview.current.elevation_m !== undefined
                ? ` · ${t("Elevation")}: ${formatNumber(overview.current.elevation_m, 0)} m`
                : ""}
            </p>
          )}
        </section>
      ) : (
        <AlertCard tone="info" title={t("Current weather is unavailable")}>
          {t(overview.current.reason ?? "The current-weather source did not answer.")}
        </AlertCard>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("Water balance, last {n} days", { n: overview.weather.days })}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label={t("Rain")}
            value={overview.water.rain_total_mm !== null ? formatNumber(overview.water.rain_total_mm, 1) : null}
            unit="mm"
            hint={t("Sum of daily precipitation")}
          />
          <MetricCard
            label={t("Reference ET₀")}
            value={overview.water.et0_total_mm !== null ? formatNumber(overview.water.et0_total_mm, 1) : null}
            unit="mm"
            hint={t("Grass reference evapotranspiration, FAO-56")}
          />
          <MetricCard
            label={t("Balance")}
            value={overview.water.balance_mm !== null ? formatNumber(overview.water.balance_mm, 1) : null}
            unit="mm"
            badge={
              <StatusPill
                tone={
                  overview.water.category === "surplus"
                    ? "good"
                    : overview.water.category === "near_balance"
                      ? "info"
                      : "warn"
                }
              >
                {t(categoryLabel(overview.water.category))}
              </StatusPill>
            }
            hint={t("Rain minus ET₀. A model balance, not a soil probe.")}
          />
        </div>
      </section>

      {overview.alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("Alerts")}</h2>
          {overview.alerts.map((alert) => (
            <AlertCard key={alert.key} tone={ALERT_TONE[alert.level]} title={t(alert.title)}>
              {t(alert.detail)}
            </AlertCard>
          ))}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="text-sm font-semibold">{t("Where this is")}</h2>
          <dl className="mt-2 space-y-1.5 text-xs">
            {detailRows.map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <dt className="text-muted">{t(row.label)}</dt>
                <dd className="text-end text-ink">{row.value}</dd>
              </div>
            ))}
            {details.area_ha !== null && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Area")}</dt>
                <dd className="text-ink">{formatNumber(details.area_ha, 2)} ha</dd>
              </div>
            )}
          </dl>
          {details.attribution && (
            <p className="mt-2 text-2xs text-muted">{details.attribution}</p>
          )}
        </section>

        <section className="card card-pad">
          <h2 className="text-sm font-semibold">{t("Data sources")}</h2>
          <div className="mt-2">
            <SourceBadges sources={overview.sources} />
          </div>
          <p className="mt-3 border-t border-line pt-2 text-2xs leading-relaxed text-muted">
            {t("Generated {value}. Values older than the stated period are not presented as current.", {
              value: formatDate(overview.generated_at.slice(0, 10)),
            })}
          </p>
        </section>
      </div>

      <Limitations items={overview.limitations} />
    </div>
  );
}

function WeatherTab({ overview }: { overview: LocationOverview }) {
  const { t } = useI18n();
  const { chart } = useTheme();
  const days = overview.weather.daily;

  return (
    <div className="space-y-5">
      <ChartCard
        title={t("Daily weather, last {n} days", { n: overview.weather.days })}
        description={t("Temperature lines use the left axis; rainfall bars use the right axis.")}
        source={<DataSourceBadge source={overview.sources[0]} />}
        footnote={t("{start} → {end} · daily values, not a forecast beyond the stated window.", {
          start: formatDate(overview.weather.period_start),
          end: formatDate(overview.weather.period_end),
        })}
        height={300}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={days} margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
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
              width={38}
              unit="°"
            />
            <YAxis
              yAxisId="rain"
              orientation="right"
              tick={{ fontSize: 10, fill: chart.tick }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip
              contentStyle={chart.tooltip.contentStyle}
              labelStyle={chart.tooltip.labelStyle}
              labelFormatter={(label) => formatDate(String(label))}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="rain" dataKey="precipitation_mm" name={t("Rainfall (mm)")} fill={chart.rain} radius={[2, 2, 0, 0]} maxBarSize={12} />
            <Line yAxisId="temp" type="monotone" dataKey="t_max_c" name={t("Max temperature (°C)")} stroke={chart.tempMax ?? chart.tempMean} strokeWidth={1.5} dot={false} connectNulls={false} />
            <Line yAxisId="temp" type="monotone" dataKey="t_mean_c" name={t("Mean temperature (°C)")} stroke={chart.tempMean} strokeWidth={2} dot={false} connectNulls={false} />
            <Line yAxisId="temp" type="monotone" dataKey="t_min_c" name={t("Min temperature (°C)")} stroke={chart.tempMin ?? chart.tick} strokeWidth={1.5} dot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("Period summary")}</h2>
        <ReadingGrid readings={overview.weather.readings} sources={overview.sources} />
      </section>

      <InfoNote tone="info">
        {t(
          "Weather values are model or gridded estimates for the nearest cell, not readings from an on-farm station. The window ends at the latest date the source reliably covers.",
        )}
      </InfoNote>
    </div>
  );
}

function WaterTab({ overview }: { overview: LocationOverview }) {
  const { t } = useI18n();
  const { chart } = useTheme();

  const series = useMemo(() => {
    let running = 0;
    return overview.weather.daily.map((day) => {
      if (day.precipitation_mm !== null && day.et0_mm !== null) {
        running += day.precipitation_mm - day.et0_mm;
      }
      return {
        date: day.date,
        precipitation_mm: day.precipitation_mm,
        et0_mm: day.et0_mm,
        cumulative_mm: running,
      };
    });
  }, [overview.weather.daily]);

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("Water readings")}</h2>
        <ReadingGrid readings={overview.water.readings} sources={overview.sources} columns={3} />
      </section>

      <ChartCard
        title={t("Rainfall, ET₀ and cumulative balance")}
        description={t(
          "Bars are daily rain, the left line is daily reference ET₀, and the right line is the running rain-minus-ET₀ balance.",
        )}
        source={<DataSourceBadge source={overview.sources[0]} />}
        footnote={t("Balance is a climatological water balance over the period, not an irrigation schedule.")}
        height={300}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
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
              yAxisId="daily"
              tick={{ fontSize: 10, fill: chart.tick }}
              axisLine={false}
              tickLine={false}
              width={38}
              unit="mm"
            />
            <YAxis
              yAxisId="cumulative"
              orientation="right"
              tick={{ fontSize: 10, fill: chart.tick }}
              axisLine={false}
              tickLine={false}
              width={40}
              unit="mm"
            />
            <Tooltip
              contentStyle={chart.tooltip.contentStyle}
              labelStyle={chart.tooltip.labelStyle}
              labelFormatter={(label) => formatDate(String(label))}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="daily" dataKey="precipitation_mm" name={t("Rain (mm/day)")} fill={chart.rain} radius={[2, 2, 0, 0]} maxBarSize={12} />
            <Line yAxisId="daily" type="monotone" dataKey="et0_mm" name={t("ET₀ (mm/day)")} stroke={chart.tempMean} strokeWidth={2} dot={false} connectNulls={false} />
            <Line yAxisId="cumulative" type="monotone" dataKey="cumulative_mm" name={t("Cumulative balance (mm)")} stroke={chart.tempMax ?? chart.tick} strokeWidth={2} dot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <AlertCard tone={overview.water.category === "surplus" ? "good" : overview.water.category === "near_balance" ? "info" : "warn"} title={t("Balance classification: {value}", { value: t(categoryLabel(overview.water.category)) })}>
        {t(overview.water.method)}
      </AlertCard>

      <InfoNote tone="warn">
        {t(
          "A negative balance means atmospheric demand exceeded rainfall; it does not by itself prove crop water stress. Soil water-holding capacity and irrigation are not included.",
        )}
      </InfoNote>
    </div>
  );
}

function SoilTab({ location }: { location: SelectedLocation }) {
  const { t } = useI18n();
  const state = useAsync<SoilBlock>(
    (signal) =>
      location.boundary
        ? api.locationSoilArea(ringRequest(location), signal)
        : api.locationSoil(location.latitude, location.longitude, { signal }),
    [location.latitude, location.longitude, location.boundary],
  );
  const soil = state.data;

  if (state.status === "loading") {
    return (
      <LoadingState
        label={t("Reading SoilGrids modelled soil properties…")}
        rows={4}
      />
    );
  }
  if (state.status === "error") {
    return (
      <ErrorState
        title={t("Soil data unavailable")}
        message={state.error?.message ?? t("The soil service could not answer.")}
        onRetry={state.reload}
      />
    );
  }
  if (!soil) return null;

  if (!soil.available) {
    return (
      <>
        <AlertCard tone="warn" title={t("No soil properties for this location")}>
          {t(soil.reason ?? "The soil source returned no values for this cell.")}
        </AlertCard>
        <Limitations items={soil.limitations} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <section className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{t("Texture class")}</h2>
            <p className="mt-1 text-2xl font-semibold text-ink">
              {soil.texture ? t(titleCase(soil.texture.class)) : "—"}
            </p>
            <p className="mt-1 text-2xs text-muted">{t(soil.texture?.method ?? "")}</p>
          </div>
          {soil.access && <StatusPill tone="neutral">{soil.access}</StatusPill>}
        </div>
        {soil.texture && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
            <div>
              <p className="text-muted">{t("Clay")}</p>
              <p className="text-ink">
                {soil.texture.clay_pct !== null ? `${formatNumber(soil.texture.clay_pct, 1)} %` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted">{t("Sand")}</p>
              <p className="text-ink">
                {soil.texture.sand_pct !== null ? `${formatNumber(soil.texture.sand_pct, 1)} %` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted">{t("Silt")}</p>
              <p className="text-ink">
                {soil.texture.silt_pct !== null ? `${formatNumber(soil.texture.silt_pct, 1)} %` : "—"}
              </p>
            </div>
          </div>
        )}
        {soil.aggregation && (
          <p className="mt-2 text-2xs text-muted">{t(soil.aggregation)}</p>
        )}
      </section>

      {soil.readings && soil.readings.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("Topsoil values, 0–30 cm")}</h2>
          <ReadingGrid readings={soil.readings} sources={soil.sources_detail ?? []} />
        </section>
      )}

      {soil.layers && soil.layers.length > 0 && (
        <section className="card overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold">{t("Soil properties by depth")}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {t("SoilGrids modelled values at 250 m resolution. Units follow the source.")}
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-start text-2xs uppercase tracking-[0.06em] text-muted">
                  <th className="px-4 py-2 text-start font-medium">{t("Depth")}</th>
                  <th className="px-3 py-2 text-end font-medium">pH</th>
                  <th className="px-3 py-2 text-end font-medium">{t("SOC g/kg")}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("Clay %")}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("Sand %")}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("Silt %")}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("CEC")}</th>
                  <th className="px-4 py-2 text-end font-medium">{t("N g/kg")}</th>
                </tr>
              </thead>
              <tbody>
                {soil.layers.map((layer) => (
                  <tr key={layer.depth} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 font-mono text-ink">{layer.depth}</td>
                    <td className="px-3 py-2 text-end text-ink">{layer.phh2o !== null && layer.phh2o !== undefined ? formatNumber(layer.phh2o, 1) : "—"}</td>
                    <td className="px-3 py-2 text-end text-ink">{layer.soc !== null && layer.soc !== undefined ? formatNumber(layer.soc, 1) : "—"}</td>
                    <td className="px-3 py-2 text-end text-ink">{layer.clay !== null && layer.clay !== undefined ? formatNumber(layer.clay, 1) : "—"}</td>
                    <td className="px-3 py-2 text-end text-ink">{layer.sand !== null && layer.sand !== undefined ? formatNumber(layer.sand, 1) : "—"}</td>
                    <td className="px-3 py-2 text-end text-ink">{layer.silt !== null && layer.silt !== undefined ? formatNumber(layer.silt, 1) : "—"}</td>
                    <td className="px-3 py-2 text-end text-ink">{layer.cec !== null && layer.cec !== undefined ? formatNumber(layer.cec, 1) : "—"}</td>
                    <td className="px-4 py-2 text-end text-ink">{layer.nitrogen !== null && layer.nitrogen !== undefined ? formatNumber(layer.nitrogen, 2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="border-t border-line px-5 py-3 text-2xs leading-relaxed text-muted">
            {t(
              "SoilGrids is a global model, not a soil test. Use laboratory analysis before fertiliser or lime decisions.",
            )}
            {soil.fetched_at ? ` ${t("Fetched: {value}", { value: soil.fetched_at })}` : ""}
          </footer>
        </section>
      )}

      {soil.alerts && soil.alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("Soil alerts")}</h2>
          {soil.alerts.map((alert) => (
            <AlertCard key={alert.key} tone={ALERT_TONE[alert.level]} title={t(alert.title)}>
              {t(alert.detail)}
            </AlertCard>
          ))}
        </section>
      )}

      <Limitations items={soil.limitations} />
    </div>
  );
}

function VegetationTab({ location }: { location: SelectedLocation }) {
  const { t } = useI18n();
  const { chart } = useTheme();
  const [months, setMonths] = useState(6);

  const state = useAsync<VegetationBlock>(
    (signal) =>
      location.boundary
        ? api.locationVegetationArea({ ...ringRequest(location), months }, signal)
        : api.locationVegetation(location.latitude, location.longitude, { months, signal }),
    [location.latitude, location.longitude, location.boundary, months],
  );
  const vegetation = state.data;

  const trend = useMemo(
    () =>
      (vegetation?.monthly_ndvi ?? []).map((point) => ({
        month: point.month,
        ndvi: point.ndvi,
        scenes: point.scenes,
      })),
    [vegetation?.monthly_ndvi],
  );

  if (state.status === "loading") {
    return (
      <LoadingState
        label={t("Asking Google Earth Engine for Sentinel-2 and SMAP… this can take a minute.")}
        rows={4}
      />
    );
  }
  if (state.status === "error") {
    return (
      <ErrorState
        title={t("Vegetation data unavailable")}
        message={state.error?.message ?? t("The satellite service could not answer.")}
        details={t("Earth Engine may be unauthenticated on this machine. The field pages still work.")}
        onRetry={state.reload}
      />
    );
  }
  if (!vegetation) return null;

  if (!vegetation.available) {
    return (
      <>
        <AlertCard tone="warn" title={t("No satellite vegetation summary")}>
          {t(vegetation.reason ?? "Earth Engine returned no usable observations for this area.")}
        </AlertCard>
        <Limitations items={vegetation.limitations} />
      </>
    );
  }

  const summary = vegetation.vegetation;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t("Vegetation indices")}</h2>
          {vegetation.period && (
            <p className="text-2xs text-muted">
              {t("Latest compositing window: {start} → {end}", {
                start: formatDate(vegetation.period.latest_start),
                end: formatDate(vegetation.period.latest_end),
              })}
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          {t("History")}
          <select
            className="input w-auto"
            value={months}
            onChange={(event) => setMonths(Number.parseInt(event.target.value, 10))}
          >
            <option value={3}>{t("3 months")}</option>
            <option value={6}>{t("6 months")}</option>
            <option value={12}>{t("12 months")}</option>
            <option value={24}>{t("24 months")}</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="NDVI"
          value={summary?.ndvi !== null && summary?.ndvi !== undefined ? formatNumber(summary.ndvi, 3) : null}
          hint={t("Sentinel-2 surface reflectance composite")}
        />
        <MetricCard
          label="EVI"
          value={summary?.evi !== null && summary?.evi !== undefined ? formatNumber(summary.evi, 3) : null}
          hint={t("Less saturated in dense canopies")}
        />
        <MetricCard
          label="NDMI"
          value={summary?.ndmi !== null && summary?.ndmi !== undefined ? formatNumber(summary.ndmi, 3) : null}
          hint={t("Canopy moisture index, not soil water")}
        />
        <MetricCard
          label={t("NDVI change")}
          value={summary?.ndvi_change !== null && summary?.ndvi_change !== undefined ? signed(summary.ndvi_change, 3) : null}
          badge={
            summary?.ndvi_change !== null && summary?.ndvi_change !== undefined ? (
              <StatusPill tone={summary.ndvi_change >= 0 ? "good" : "warn"}>
                {summary.ndvi_change >= 0 ? t("Greener") : t("Less green")}
              </StatusPill>
            ) : undefined
          }
          hint={
            summary?.previous_period
              ? t("Compared with {start} → {end}", {
                  start: formatDate(summary.previous_period.start),
                  end: formatDate(summary.previous_period.end),
                })
              : t("No comparable previous window")
          }
        />
      </div>

      <ChartCard
        title={t("Monthly NDVI")}
        description={t("Monthly mean of cloud-masked Sentinel-2 scenes. Gaps mean no usable scene, not zero vegetation.")}
        source={vegetation.sources_detail?.[0] ? <DataSourceBadge source={vegetation.sources_detail[0]} /> : undefined}
        footnote={t("{n} months · index values, unitless.", { n: months })}
        height={280}
      >
        {trend.length === 0 ? (
          <EmptyState title={t("No monthly NDVI")} description={t("Earth Engine returned no monthly composites.")} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
              <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={(value) => formatDateShort(`${String(value)}-01`)}
                tick={{ fontSize: 10, fill: chart.tick }}
                minTickGap={24}
                axisLine={{ stroke: chart.grid }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 10, fill: chart.tick }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={chart.tooltip.contentStyle}
                labelStyle={chart.tooltip.labelStyle}
                labelFormatter={(label) => formatDate(`${String(label)}-01`)}
              />
              <Line type="monotone" dataKey="ndvi" name="NDVI" stroke={chart.tempMean} strokeWidth={2} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card card-pad">
          <h3 className="text-sm font-semibold">{t("Land cover")}</h3>
          <p className="mt-1 text-base font-semibold text-ink">
            {vegetation.land_cover ? t(vegetation.land_cover.class) : "—"}
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-muted">
            {vegetation.land_cover?.note
              ? t(vegetation.land_cover.note)
              : t("Dynamic World class for the latest composite.")}
          </p>
        </section>
        <section className="card card-pad">
          <h3 className="text-sm font-semibold">{t("SMAP surface soil moisture")}</h3>
          <p className="mt-1 text-base font-semibold text-ink">
            {vegetation.soil_moisture_smap?.percent_by_volume !== null &&
            vegetation.soil_moisture_smap?.percent_by_volume !== undefined
              ? `${formatNumber(vegetation.soil_moisture_smap.percent_by_volume, 1)} %`
              : "—"}
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-muted">
            {vegetation.soil_moisture_smap
              ? t(vegetation.soil_moisture_smap.depth_note)
              : t("No SMAP value for this period.")}
          </p>
        </section>
        <section className="card card-pad">
          <h3 className="text-sm font-semibold">{t("GPM monthly precipitation")}</h3>
          <p className="mt-1 text-base font-semibold text-ink">
            {vegetation.gpm_monthly?.precipitation_mm !== null &&
            vegetation.gpm_monthly?.precipitation_mm !== undefined
              ? `${formatNumber(vegetation.gpm_monthly.precipitation_mm, 1)} mm`
              : "—"}
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-muted">
            {vegetation.gpm_monthly
              ? `${t(vegetation.gpm_monthly.note)} · ${vegetation.gpm_monthly.month}`
              : t("No monthly GPM value.")}
          </p>
        </section>
      </div>

      <Limitations items={vegetation.limitations} />
    </div>
  );
}

function HistoryTab({ location }: { location: SelectedLocation }) {
  const { t } = useI18n();
  const { chart } = useTheme();
  const [years, setYears] = useState(5);

  const state = useAsync<HistoryResponse>(
    (signal) => api.locationHistory(location.latitude, location.longitude, { years, signal }),
    [location.latitude, location.longitude, years],
  );
  const history = state.data;

  const monthly = useMemo(() => (history?.monthly ?? []).map((point) => ({ ...point })), [history?.monthly]);
  const yearly = history?.yearly ?? [];

  if (state.status === "loading") {
    return (
      <LoadingState
        label={t("Building the climate record from Open-Meteo ERA5… the first request can take up to a minute.")}
        rows={5}
      />
    );
  }
  if (state.status === "error") {
    return (
      <ErrorState
        title={t("Historical data unavailable")}
        message={state.error?.message ?? t("The archive service could not answer.")}
        onRetry={state.reload}
      />
    );
  }
  if (!history) return null;

  if (!history.available) {
    return (
      <>
        <AlertCard tone="warn" title={t("No historical series")}>
          {t(history.reason ?? "The archive returned no usable daily values for this point.")}
        </AlertCard>
        <Limitations items={history.limitations} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t("Historical climate")}</h2>
          {history.available_period && (
            <p className="mt-0.5 text-xs text-muted">
              {t("Available {start} → {end}.", {
                start: formatDate(history.available_period.start),
                end: formatDate(history.available_period.end),
              })}{" "}
              {t(history.available_period.note)}
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          {t("Window")}
          <select
            className="input w-auto"
            value={years}
            onChange={(event) => setYears(Number.parseInt(event.target.value, 10))}
          >
            <option value={3}>{t("3 years")}</option>
            <option value={5}>{t("5 years")}</option>
            <option value={10}>{t("10 years")}</option>
          </select>
        </label>
      </div>

      {history.comparisons && history.comparisons.length > 0 && (
        <section className="card overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold">{t("This period compared")}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {t("Anomalies are against the long-term baseline of the same calendar window. Missing comparison periods are omitted.")}
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-[0.06em] text-muted">
                  <th className="px-4 py-2 text-start font-medium">{t("Period")}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("Mean temp")}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("Temp anomaly")}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("Rain")}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("Rain anomaly")}</th>
                  <th className="px-3 py-2 text-end font-medium">{t("Humidity")}</th>
                  <th className="px-4 py-2 text-end font-medium">{t("Soil moisture")}</th>
                </tr>
              </thead>
              <tbody>
                {history.comparisons.map((row) => (
                  <tr key={row.key} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 text-ink">{t(row.label)}</td>
                    <td className="px-3 py-2 text-end text-ink">
                      {row.temp_mean_c !== null ? `${formatNumber(row.temp_mean_c, 1)} °C` : "—"}
                    </td>
                    <td className="px-3 py-2 text-end text-ink">{signed(row.temp_anomaly_c, 1)}</td>
                    <td className="px-3 py-2 text-end text-ink">
                      {row.precipitation_mm !== null ? `${formatNumber(row.precipitation_mm, 1)} mm` : "—"}
                    </td>
                    <td className="px-3 py-2 text-end text-ink">{signed(row.precipitation_anomaly_mm, 1)}</td>
                    <td className="px-3 py-2 text-end text-ink">
                      {row.humidity_pct !== null ? `${formatNumber(row.humidity_pct, 0)} %` : "—"}
                    </td>
                    <td className="px-4 py-2 text-end text-ink">
                      {row.soil_moisture_0_7cm_pct !== null && row.soil_moisture_0_7cm_pct !== undefined
                        ? `${formatNumber(row.soil_moisture_0_7cm_pct, 1)} %`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {history.drought && (
        <AlertCard
          tone={history.drought.category === "dry" || history.drought.category === "very_dry" ? "warn" : "info"}
          title={t("Drought screen: {value}", { value: t(history.drought.category) })}
        >
          {t(
            "{rain} mm over the last {days} days sits at the {pct}th {method}",
            {
              rain: history.drought.precipitation_mm !== null ? formatNumber(history.drought.precipitation_mm, 1) : "—",
              days: history.drought.window_days,
              pct: history.drought.percentile !== null ? formatNumber(history.drought.percentile, 0) : "—",
              method: history.drought.method,
            },
          )}
        </AlertCard>
      )}

      <ChartCard
        title={t("Monthly temperature and rainfall")}
        description={t("Every month the archive returned in the selected window. Rainfall uses the right axis.")}
        source={history.sources_detail?.[0] ? <DataSourceBadge source={history.sources_detail[0]} /> : undefined}
        footnote={t("ERA5 reanalysis through Open-Meteo. Grid-cell values, not a station record.")}
        height={300}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={monthly} margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: chart.tick }}
              minTickGap={36}
              axisLine={{ stroke: chart.grid }}
              tickLine={false}
            />
            <YAxis yAxisId="temp" tick={{ fontSize: 10, fill: chart.tick }} axisLine={false} tickLine={false} width={38} unit="°" />
            <YAxis yAxisId="rain" orientation="right" tick={{ fontSize: 10, fill: chart.tick }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={chart.tooltip.contentStyle} labelStyle={chart.tooltip.labelStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="rain" dataKey="precipitation_mm" name={t("Rainfall (mm)")} fill={chart.rain} radius={[2, 2, 0, 0]} maxBarSize={14} />
            <Line yAxisId="temp" type="monotone" dataKey="temp_mean_c" name={t("Mean temperature (°C)")} stroke={chart.tempMean} strokeWidth={2} dot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={t("Year by year")}
        description={t("Annual mean temperature and total rainfall for complete archive years, plus the current partial year.")}
        source={history.sources_detail?.[0] ? <DataSourceBadge source={history.sources_detail[0]} /> : undefined}
        footnote={t("Partial years are marked by fewer days present; they are not extrapolated.")}
        height={260}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={yearly} margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: chart.tick }} axisLine={{ stroke: chart.grid }} tickLine={false} />
            <YAxis yAxisId="temp" tick={{ fontSize: 10, fill: chart.tick }} axisLine={false} tickLine={false} width={38} unit="°" />
            <YAxis yAxisId="rain" orientation="right" tick={{ fontSize: 10, fill: chart.tick }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={chart.tooltip.contentStyle} labelStyle={chart.tooltip.labelStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="rain" dataKey="precipitation_mm" name={t("Rainfall (mm)")} fill={chart.rain} radius={[2, 2, 0, 0]} maxBarSize={26} />
            <Line yAxisId="temp" type="monotone" dataKey="temp_mean_c" name={t("Mean temperature (°C)")} stroke={chart.tempMean} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {history.sources_detail && <SourceBadges sources={history.sources_detail} />}
      <Limitations items={history.limitations} />
    </div>
  );
}

function LocationAnalysisBody({ location }: { location: SelectedLocation }) {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: TabKey = TABS.some((entry) => entry.key === rawTab) ? (rawTab as TabKey) : "overview";

  const overviewState = useAsync<LocationOverview>(
    (signal) =>
      location.boundary
        ? api.locationOverviewArea(
            { ...ringRequest(location), crop_id: location.cropId ?? undefined },
            signal,
          )
        : api.locationOverview(location.latitude, location.longitude, {
            label: location.label ?? undefined,
            cropId: location.cropId ?? undefined,
            signal,
          }),
    [location.latitude, location.longitude, location.label, location.boundary, location.cropId],
  );

  function setTab(next: TabKey) {
    const query = new URLSearchParams(params);
    if (next === "overview") query.delete("tab");
    else query.set("tab", next);
    setParams(query, { replace: true });
  }

  const overview = overviewState.data;

  return (
    <div className="container-page space-y-6 py-10">
      <LocationHeader
        location={location}
        title={location.label ?? t("Location analysis")}
        sources={overview?.sources}
        right={
          overview ? (
            <StatusPill tone={overview.available ? "good" : "warn"}>
              {overview.available ? t("Live analysis") : t("Partly unavailable")}
            </StatusPill>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-1 border-b border-line pb-1" role="tablist" aria-label={t("Location analysis sections")}>
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            onClick={() => setTab(entry.key)}
            className={
              tab === entry.key
                ? "rounded-t border-b-2 border-forest-600 px-3 py-2 text-xs font-semibold text-forest-800"
                : "border-b-2 border-transparent px-3 py-2 text-xs font-medium text-muted hover:text-ink"
            }
          >
            {t(entry.label)}
          </button>
        ))}
      </div>

      {tab === "overview" || tab === "weather" || tab === "water" ? (
        <>
          {overviewState.status === "loading" && (
            <LoadingState label={t("Reading current conditions and the last 30 days…")} rows={4} />
          )}
          {overviewState.status === "error" && (
            <ErrorState
              title={t("Location overview unavailable")}
              message={overviewState.error?.message ?? t("The location service could not answer.")}
              onRetry={overviewState.reload}
            />
          )}
          {overview && tab === "overview" && <OverviewTab overview={overview} />}
          {overview && tab === "weather" && <WeatherTab overview={overview} />}
          {overview && tab === "water" && <WaterTab overview={overview} />}
        </>
      ) : tab === "soil" ? (
        <SoilTab location={location} />
      ) : tab === "vegetation" ? (
        <VegetationTab location={location} />
      ) : (
        <HistoryTab location={location} />
      )}
    </div>
  );
}

/**
 * Location intelligence for any point, stored field or drawn outline.
 *
 * Each tab loads only its own source, so a slow archive or Earth Engine call
 * never blocks the weather overview, and every block states provenance and
 * limitations instead of filling gaps with estimates.
 */
export function LocationAnalysisPage() {
  const location = useSelectedLocation();
  const { t } = useI18n();

  if (location?.loading) {
    return (
      <div className="container-page py-10">
        <LoadingState label={t("Loading the saved field…")} rows={4} />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title={t("No location selected")}
          description={t("Choose a point or draw a field on the Explore Map first.")}
          action={
            <Link to="/explore" className="btn-primary btn-sm">
              {t("Open Explore Map")}
            </Link>
          }
        />
      </div>
    );
  }

  return <LocationAnalysisBody key={`${location.latitude}-${location.longitude}-${Boolean(location.boundary)}`} location={location} />;
}
