import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { DataSourceRef, EnvironmentResponse, Field } from "../api/types";
import { AlertCard } from "../components/data/AlertCard";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/AsyncState";
import { DataSourceBadge } from "../components/ui/DataSourceBadge";
import {
  AlertIcon,
  DropIcon,
  HumidityIcon,
  LeafIcon,
  RainIcon,
  ThermometerIcon,
  WindIcon,
} from "../components/ui/Icons";
import { InfoNote } from "../components/ui/InfoNote";
import { StatusPill } from "../components/ui/StatusPill";
import { useDataMode } from "../context/DataModeContext";
import { useAsync } from "../hooks/useAsync";
import { readLastFieldId, rememberFieldId } from "../hooks/useField";
import { useI18n } from "../i18n/I18nContext";
import {
  addDaysIso,
  daysBetween,
  formatDate,
  formatNumber,
  todayIso,
} from "../lib/format";
import { DEMAND_META } from "../lib/labels";

type LandStatus = "good" | "attention" | "critical" | "unknown";

const LAND_STATUS: Record<
  LandStatus,
  { label: string; tone: "good" | "warn" | "bad" | "neutral"; description: string }
> = {
  good: {
    label: "Good",
    tone: "good",
    description: "The available indicators do not show a problem in this field.",
  },
  attention: {
    label: "Needs attention",
    tone: "warn",
    description: "One indicator needs a look. Check the notes below.",
  },
  critical: {
    label: "Critical",
    tone: "bad",
    description: "The field needs action soon. Read the important alerts.",
  },
  unknown: {
    label: "Status unknown",
    tone: "neutral",
    description: "There is not enough data to judge the field right now.",
  },
};

function sumRain(points: EnvironmentResponse["series"]): number | null {
  const values = points
    .map((point) => point.precipitation_mm)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0);
}

function SectionTitle({ title, icon }: { title: string; icon: ReactNode }) {
  const { t, isRtl } = useI18n();
  const localized = t(title);
  return (
    <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
      <span className="text-forest-700">{icon}</span>
      {localized}
      {localized !== title && (
        <span className="text-xs font-normal text-muted" dir={isRtl ? "ltr" : "rtl"}>
          — {title}
        </span>
      )}
    </h2>
  );
}

function SimpleCard({
  title,
  icon,
  children,
  aside,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="card card-pad space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <SectionTitle title={title} icon={icon} />
        {aside}
      </div>
      {children}
    </section>
  );
}

function FarmerBody({ field }: { field: Field }) {
  const { t } = useI18n();
  const { mode, isDemo } = useDataMode();
  const [showDetails, setShowDetails] = useState(false);

  const today = todayIso();
  const yesterday = addDaysIso(today, -1);
  const weekStart = addDaysIso(yesterday, -6);
  const daysAfterPlanting = daysBetween(field.planting_date, today);
  const planted = daysAfterPlanting >= 0;

  const environmentState = useAsync(
    (signal) =>
      api.environment(field.id, { start: weekStart, end: yesterday, mode, signal }),
    [field.id, mode, yesterday],
  );
  const irrigationState = useAsync(
    (signal) => api.irrigation(field.id, { end: yesterday, mode, signal }),
    [field.id, mode, yesterday],
  );
  const healthState = useAsync(
    (signal) => api.healthAnalysis(field.id, { end: yesterday, mode, signal }),
    [field.id, mode, yesterday],
  );
  const summaryState = useAsync(
    (signal) =>
      api.farmerSummary(
        {
          latitude: field.latitude,
          longitude: field.longitude,
          crop_id: field.crop_id,
          intent: planted ? "already_planted" : "plant_now",
          days_since_planting:
            planted && daysAfterPlanting <= 180 ? daysAfterPlanting : null,
          geometry: field.boundary_geojson ?? null,
        },
        { mode, signal },
      ),
    [field.id, mode, planted, daysAfterPlanting],
  );

  const environment = environmentState.data;
  const irrigation = irrigationState.data;
  const health = healthState.data;
  const summary = summaryState.data;

  const demand = irrigation?.status === "ok" ? irrigation.demand : null;
  const healthStatus = health?.status ?? "insufficient_data";
  const knownSignals: Array<"good" | "warn" | "bad"> = [];
  if (demand !== null) {
    knownSignals.push(demand === "high" ? "bad" : demand === "moderate" ? "warn" : "good");
  }
  if (health && health.status !== "insufficient_data") {
    knownSignals.push(
      health.status === "stressed" ? "bad" : health.status === "moderate" ? "warn" : "good",
    );
  }
  const landStatus: LandStatus =
    knownSignals.includes("bad") && knownSignals.includes("warn")
      ? "critical"
      : knownSignals.includes("bad") || knownSignals.includes("warn")
        ? "attention"
        : knownSignals.length > 0
          ? "good"
          : "unknown";
  const statusMeta = LAND_STATUS[landStatus];

  const rain7 = environment ? sumRain(environment.series) : null;
  const rainDays = environment?.series.length ?? 0;
  const rainWindowLabel = environment
    ? rainDays >= 7
      ? t("Rain in the last 7 days")
      : t("Rain since {date}", { date: formatDate(environment.start) })
    : t("Rain in the last 7 days");
  const soil = summary?.soil;
  const depletion = irrigation?.balance?.depletion_fraction ?? null;
  const forecastDay = summary?.forecast.available ? summary.forecast.days[0] : null;
  const weather = summary?.weather;
  const tempMin = forecastDay?.temperature_min_c ?? weather?.temperature_min_c ?? null;
  const tempMax = forecastDay?.temperature_max_c ?? weather?.temperature_max_c ?? null;
  const rainToday = forecastDay?.rain_mm ?? weather?.rain_mm ?? null;
  const wind = forecastDay?.wind_max_ms ?? weather?.wind_ms ?? null;
  const humidity = weather?.humidity_pct ?? null;
  const forecastDays = summary?.forecast.available ? summary.forecast.days : [];
  const rainSoon = forecastDays
    .slice(0, 2)
    .map((day) => day.rain_mm)
    .filter((value): value is number => value !== null);
  const rainSoonTotal = rainSoon.length > 0 ? rainSoon.reduce((a, b) => a + b, 0) : null;
  const maxSoon = forecastDays
    .slice(0, 2)
    .map((day) => day.temperature_max_c)
    .filter((value): value is number => value !== null);
  const minSoon = forecastDays
    .slice(0, 2)
    .map((day) => day.temperature_min_c)
    .filter((value): value is number => value !== null);

  const waterHeadline = irrigation?.season_complete
    ? t("The season has ended; irrigation is not assessed for this crop.")
    : demand === "high"
      ? t("The field needs irrigation")
      : demand === "moderate"
        ? t("The field will soon need irrigation")
        : demand === "low"
          ? t("The soil is moist right now")
          : t("Not enough data to judge irrigation right now.");
  const waterTone =
    demand === "high" ? "bad" : demand === "moderate" ? "warn" : demand === "low" ? "good" : "neutral";

  const cropSentence = health?.season_complete
    ? t("The season has ended; crop condition is not assessed.")
    : healthStatus === "good"
      ? t("The crop looks good.")
      : healthStatus === "moderate"
        ? t("The crop looks moderate; keep watching it.")
        : healthStatus === "stressed"
          ? t("The crop may be under stress; inspect the field.")
          : t("Crop condition cannot be assessed right now.");
  const cropTone =
    healthStatus === "good"
      ? "good"
      : healthStatus === "moderate"
        ? "warn"
        : healthStatus === "stressed"
          ? "bad"
          : "neutral";

  const alerts: { tone: "danger" | "warn" | "info" | "good"; text: string }[] = [];
  if (demand === "high") alerts.push({ tone: "danger", text: t("The field needs irrigation.") });
  if (healthStatus === "stressed") alerts.push({ tone: "warn", text: t("Possible crop stress.") });
  if (maxSoon.length > 0 && Math.max(...maxSoon) >= 38) {
    alerts.push({ tone: "warn", text: t("Unusually high temperature.") });
  }
  if (minSoon.length > 0 && Math.min(...minSoon) <= 4) {
    alerts.push({ tone: "danger", text: t("Frost risk; protect the plants.") });
  }
  if (rainSoonTotal !== null && rainSoonTotal >= 5) {
    alerts.push({ tone: "info", text: t("Rain is expected.") });
  }
  if (healthStatus === "stressed" || healthStatus === "moderate") {
    alerts.push({ tone: "info", text: t("Inspect the plants in the marked area.") });
  }
  if (!planted) {
    alerts.push({
      tone: "info",
      text: t("The crop has not been planted yet; the planting guide can help."),
    });
  }

  const forecastSource: DataSourceRef | undefined = summary?.sources.find(
    (source) => source.id === "open-meteo-forecast",
  );

  const anyUnavailable =
    environmentState.status === "error" ||
    irrigationState.status === "error" ||
    healthState.status === "error" ||
    summaryState.status === "error";

  return (
    <>
      {isDemo && (
        <InfoNote tone="warn" title={t("Demo mode uses a fixed window")}>
          {t(
            "Values come from the cached Qena snapshot. Calculations are real; the location and dates are not this field's.",
          )}
        </InfoNote>
      )}

      {anyUnavailable && (
        <InfoNote tone="warn" title={t("Some data is unavailable right now")}>
          {t(
            "What is shown is real. Missing values are not estimated or replaced.",
          )}
        </InfoNote>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line bg-sage-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-card text-forest-700 ring-1 ring-line">
              <LeafIcon size={20} />
            </span>
            <div>
              <p className="eyebrow">{t("Field status")}</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.02em]">
                {t(statusMeta.label)}
              </p>
              <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
                {t(statusMeta.description)}
              </p>
            </div>
          </div>
          <StatusPill tone={statusMeta.tone}>{t(statusMeta.label)}</StatusPill>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-2xs text-muted">
          <span>
            {t(field.crop_name)} ·{" "}
            {planted
              ? t("Planted on {date} · day {n}", {
                  date: formatDate(field.planting_date),
                  n: daysAfterPlanting,
                })
              : t("Planting planned for {date}", { date: formatDate(field.planting_date) })}
          </span>
          <Link to={`/dashboard/${field.id}`} className="link-underline">
            {t("Open the full dashboard")}
          </Link>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <SimpleCard
          title="Water"
          icon={<DropIcon size={18} />}
          aside={<StatusPill tone={waterTone}>{waterHeadline}</StatusPill>}
        >
          {irrigationState.status === "loading" && (
            <LoadingState label={t("Checking the water balance…")} rows={2} variant="list" />
          )}
          {irrigationState.status === "error" && (
            <p className="text-sm leading-relaxed text-muted">
              {t("Water data could not be loaded right now.")}
            </p>
          )}
          {irrigation && (
            <div className="space-y-2.5 text-sm leading-relaxed">
              <p className="font-semibold text-ink">{waterHeadline}</p>
              {(demand === "high" || demand === "moderate") && (
                <p className="text-muted">
                  {t("Best time to irrigate: early morning or after sunset.")}
                </p>
              )}
              {irrigation.net_requirement_mm !== null && (
                <p className="text-muted">
                  {t("Water needed to refill the root zone: {value} mm", {
                    value: formatNumber(irrigation.net_requirement_mm, 1),
                  })}
                </p>
              )}
              <p className="text-muted">
                {rain7 === null || environment === null
                  ? t("Rain in the last 7 days is unavailable.")
                  : rain7 > 0
                    ? rainDays >= 7
                      ? t("Rain in the last 7 days: {value} mm", {
                          value: formatNumber(rain7, 1),
                        })
                      : t("Rain since {date}: {value} mm", {
                          date: formatDate(environment.start),
                          value: formatNumber(rain7, 1),
                        })
                    : rainDays >= 7
                      ? t("No rain recorded in the last 7 days.")
                      : t("No rain recorded since {date}.", {
                          date: formatDate(environment.start),
                        })}
              </p>
              <p className="text-muted">
                {depletion !== null
                  ? depletion >= 0.7
                    ? t("Soil moisture: dry")
                    : depletion >= 0.4
                      ? t("Soil moisture: getting dry")
                      : t("Soil moisture: suitable")
                  : soil?.available && soil.category === "dry"
                    ? t("Surface soil moisture (satellite): dry")
                    : soil?.available && soil.category === "near_normal"
                      ? t("Surface soil moisture (satellite): suitable")
                      : soil?.available && soil.category === "wet"
                        ? t("Surface soil moisture (satellite): very wet")
                        : t("Soil moisture reading is unavailable right now.")}
              </p>
              {rainSoonTotal !== null && rainSoonTotal >= 2 && (
                <p className="font-medium text-survey-700">
                  {t("Expected rain may reduce the need for irrigation.")}
                </p>
              )}
            </div>
          )}
        </SimpleCard>

        <SimpleCard title="Weather" icon={<ThermometerIcon size={18} />}>
          {summaryState.status === "loading" && (
            <LoadingState label={t("Loading today's weather…")} rows={2} variant="list" />
          )}
          {summaryState.status === "error" && (
            <p className="text-sm leading-relaxed text-muted">
              {t("Weather data is not available right now.")}
            </p>
          )}
          {summary && (tempMax !== null || weather?.available) ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-md border border-line bg-paper px-3 py-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <ThermometerIcon size={15} />
                  {t("Temperature")}
                </p>
                <p className="mt-1 text-xl font-semibold text-ink">
                  {tempMax !== null && tempMin !== null
                    ? `${formatNumber(tempMin, 0)}° – ${formatNumber(tempMax, 0)}°`
                    : tempMax !== null
                      ? `${formatNumber(tempMax, 0)}°`
                      : "—"}
                </p>
              </div>
              <div className="rounded-md border border-line bg-paper px-3 py-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <RainIcon size={15} />
                  {t("Expected rain")}
                </p>
                <p className="mt-1 text-xl font-semibold text-ink">
                  {rainToday !== null ? `${formatNumber(rainToday, 1)} mm` : "—"}
                </p>
              </div>
              <div className="rounded-md border border-line bg-paper px-3 py-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <HumidityIcon size={15} />
                  {t("Humidity")}
                </p>
                <p className="mt-1 text-xl font-semibold text-ink">
                  {humidity !== null ? `${formatNumber(humidity, 0)}%` : "—"}
                </p>
              </div>
              <div className="rounded-md border border-line bg-paper px-3 py-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <WindIcon size={15} />
                  {t("Wind")}
                </p>
                <p className="mt-1 text-xl font-semibold text-ink">
                  {wind !== null ? `${formatNumber(wind, 1)} m/s` : "—"}
                </p>
              </div>
            </div>
          ) : (
            summaryState.status === "success" && (
              <p className="text-sm leading-relaxed text-muted">
                {t("Weather data is not available right now.")}
              </p>
            )
          )}
          {summary?.weather.date && (
            <p className="text-2xs text-muted">
              {t("Latest weather reading: {date}", {
                date: formatDate(summary.weather.date),
              })}
            </p>
          )}
        </SimpleCard>

        <SimpleCard
          title="Crop condition"
          icon={<LeafIcon size={18} />}
          aside={<StatusPill tone={cropTone}>{t(healthStatus === "good" ? "Good" : healthStatus === "moderate" ? "Moderate" : healthStatus === "stressed" ? "Stressed" : "Status unknown")}</StatusPill>}
        >
          {healthState.status === "loading" && (
            <LoadingState label={t("Checking the crop…")} rows={2} variant="list" />
          )}
          {healthState.status === "error" && (
            <p className="text-sm leading-relaxed text-muted">
              {t("Crop condition cannot be assessed right now.")}
            </p>
          )}
          {health && (
            <div className="space-y-2 text-sm leading-relaxed">
              <p className="font-semibold text-ink">{cropSentence}</p>
              {health.vegetation.available && health.vegetation.latest_date && (
                <p className="text-muted">
                  {t("Latest satellite reading: {date}", {
                    date: formatDate(health.vegetation.latest_date),
                  })}
                </p>
              )}
              {healthStatus === "moderate" && (
                <p className="text-muted">{t("Keep watching it in the coming days.")}</p>
              )}
              {healthStatus === "stressed" && (
                <p className="text-muted">{t("Inspect the plants in the marked area.")}</p>
              )}
            </div>
          )}
        </SimpleCard>

        <SimpleCard
          title="Weather warnings"
          icon={<AlertIcon size={18} />}
          aside={
            summary?.outlook.available ? (
              <StatusPill
                tone={
                  summary.outlook.headline === "stable"
                    ? "good"
                    : summary.outlook.headline === "unknown"
                      ? "neutral"
                      : "warn"
                }
              >
                {summary.outlook.headline === "stable"
                  ? t("No warning")
                  : summary.outlook.headline === "unknown"
                    ? t("Status unknown")
                    : t("Attention")}
              </StatusPill>
            ) : undefined
          }
        >
          {summary?.outlook.available && summary.outlook.advice.length > 0 ? (
            <ul className="space-y-1.5 text-sm leading-relaxed text-ink/85">
              {summary.outlook.advice
                .filter((advice) => advice !== "good_growing_weather")
                .map((advice) => (
                  <li key={advice} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay-500" />
                    <span>{t(WEATHER_ADVICE[advice])}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              {t("No weather warnings right now.")}
            </p>
          )}
        </SimpleCard>
      </div>

      <section className="card card-pad" aria-label={t("Important alerts")}>
        <SectionTitle title="Important alerts" icon={<AlertIcon size={18} />} />
        <div className="mt-3 space-y-2.5">
          {alerts.length === 0 ? (
            <AlertCard tone="good" title={t("No important alerts right now.")}>
              {t("Keep checking the field every few days.")}
            </AlertCard>
          ) : (
            alerts.map((alert) => (
              <AlertCard key={alert.text} tone={alert.tone} title={alert.text} />
            ))
          )}
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => setShowDetails((value) => !value)}
          aria-expanded={showDetails}
        >
          {showDetails ? t("Hide details") : t("More details")}
        </button>
        <Link to="/farmer-guide" className="text-xs text-muted link-underline">
          {t("Need a step-by-step guide? Open the detailed farmer guide")}
        </Link>
      </section>

      {showDetails && (
        <section className="card card-pad space-y-4" aria-label={t("Advanced data")}>
          <div>
            <SectionTitle title="Advanced data" icon={<LeafIcon size={18} />} />
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {t(
                "These numbers come from satellites and models, not from on-farm sensors.",
              )}
            </p>
          </div>

          <dl className="grid gap-x-5 gap-y-3 border-t border-line pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">
                {t("NDVI (vegetation index)")}
              </dt>
              <dd className="mono-data mt-0.5 font-semibold">
                {health?.vegetation.available && health.vegetation.ndvi !== null
                  ? formatNumber(health.vegetation.ndvi, 2)
                  : t("Data unavailable")}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">
                {t("Reference evapotranspiration (ET₀)")}
              </dt>
              <dd className="mono-data mt-0.5 font-semibold">
                {irrigation?.et0_mm_day !== null && irrigation?.et0_mm_day !== undefined
                  ? `${formatNumber(irrigation.et0_mm_day, 2)} mm/day`
                  : t("Data unavailable")}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">
                {t("Root-zone soil wetness (model)")}
              </dt>
              <dd className="mono-data mt-0.5 font-semibold">
                {environment?.summary.latest.soil_moisture_root_fraction !== null &&
                environment?.summary.latest.soil_moisture_root_fraction !== undefined
                  ? formatNumber(environment.summary.latest.soil_moisture_root_fraction, 2)
                  : t("Data unavailable")}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">
                {rainWindowLabel}
              </dt>
              <dd className="mono-data mt-0.5 font-semibold">
                {rain7 !== null ? `${formatNumber(rain7, 1)} mm` : t("Data unavailable")}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">
                {t("Irrigation demand class")}
              </dt>
              <dd className="mt-0.5 font-semibold">
                {demand ? t(DEMAND_META[demand].label) : t("Data unavailable")}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">
                {t("Analysis as of {date}", {
                  date: irrigation ? formatDate(irrigation.computed_for) : "—",
                })}
              </dt>
              <dd className="mt-0.5 font-semibold">
                {environment ? `${formatDate(environment.start)} → ${formatDate(environment.end)}` : "—"}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-2xs text-muted">{t("Source")}</span>
            {environment && <DataSourceBadge source={environment.source} isDemo={environment.is_demo} compact />}
            {irrigation && <DataSourceBadge source={irrigation.source} isDemo={irrigation.is_demo} compact />}
            {health && <DataSourceBadge source={health.source} isDemo={health.is_demo} compact />}
            {forecastSource && <DataSourceBadge source={forecastSource} compact />}
          </div>

          <Link to={`/dashboard/${field.id}`} className="btn-primary btn-sm self-start">
            {t("Open the full dashboard")}
          </Link>
        </section>
      )}
    </>
  );
}

const WEATHER_ADVICE: Record<string, string> = {
  irrigate_early_morning: "Irrigate early in the morning to reduce evaporation.",
  protect_from_frost: "Protect seedlings from frost overnight.",
  hold_irrigation_rain: "Hold irrigation if the expected rain is enough.",
  avoid_spraying_wind: "Delay spraying or foliar feeding while the wind is strong.",
  good_growing_weather: "The weather is suitable for farm work.",
};

/** Simple, decision-first page for a farmer who does not need the technical view. */
export function ForFarmersPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const fieldsState = useAsync((signal) => api.listFields(signal), []);

  const requested = Number.parseInt(searchParams.get("field") ?? "", 10);
  const fields = fieldsState.data ?? [];
  const field =
    fields.find((item) => item.id === requested) ??
    fields.find((item) => item.id === readLastFieldId()) ??
    fields[0];

  function selectField(id: number) {
    rememberFieldId(id);
    setSearchParams({ field: String(id) });
  }

  return (
    <div className="container-page py-7 sm:py-9">
      <header className="border-b border-line pb-5">
        <p className="eyebrow">{t("Simple farmer view")}</p>
        <h1 className="mt-1 text-2xl tracking-[-0.025em] sm:text-3xl">{t("For Farmers")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            "What is happening in the field, and what should I do? No scientific terms by default.",
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link to="/farmer-guide" className="btn-secondary btn-sm">
            {t("Step-by-step farmer guide")}
          </Link>
          <Link to="/fields" className="btn-secondary btn-sm">
            {t("My Fields")}
          </Link>
        </div>
      </header>

      <div className="space-y-6 pt-6">
        {fieldsState.status === "loading" && (
          <LoadingState label={t("Loading your fields…")} rows={2} />
        )}

        {fieldsState.status === "error" && (
          <ErrorState
            title={t("Your fields could not be loaded")}
            message={fieldsState.error?.message ?? t("The server could not be reached.")}
            onRetry={fieldsState.reload}
          />
        )}

        {fieldsState.status === "success" && fields.length === 0 && (
          <EmptyState
            title={t("No fields yet")}
            description={t(
              "Add a field first, then this page will show simple advice for it.",
            )}
            action={
              <Link to="/fields/new" className="btn-primary btn-sm">
                {t("Add a field")}
              </Link>
            }
          />
        )}

        {field && (
          <>
            <div className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-end sm:justify-between">
              <label className="min-w-0">
                <span className="field-label">{t("Choose a field")}</span>
                <select
                  className="input"
                  value={field.id}
                  onChange={(event) => selectField(Number.parseInt(event.target.value, 10))}
                >
                  {fields.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {t(item.crop_name)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-2xs text-muted">
                {field.location_label ?? t("Custom coordinates")} ·{" "}
                <span className="font-mono" dir="ltr">
                  {field.latitude.toFixed(3)}, {field.longitude.toFixed(3)}
                </span>
              </p>
            </div>

            <FarmerBody key={field.id} field={field} />
          </>
        )}
      </div>
    </div>
  );
}
