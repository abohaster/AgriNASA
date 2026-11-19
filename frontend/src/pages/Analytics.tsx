import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  DataSourceRef,
  Field,
  HealthyReference,
  MoisturePoint,
  PlantImageAnalysis,
  RobotImage,
} from "../api/types";
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
import { StatusPill, type Tone } from "../components/ui/StatusPill";
import { useDataMode } from "../context/DataModeContext";
import { useTheme } from "../context/ThemeContext";
import { useAsync } from "../hooks/useAsync";
import { useFieldIdFromRoute } from "../hooks/useField";
import { useI18n } from "../i18n/I18nContext";
import {
  formatDate,
  formatDateShort,
  formatDateTime,
  formatNumber,
  formatTimestampClock,
  formatTimestampDay,
  titleCase,
} from "../lib/format";
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

const ROBOT_MOISTURE_SOURCE: DataSourceRef = {
  id: "robot-soil-moisture",
  name: "AgriNASA robot",
  nature: "measured",
  resolution: "Point reading at the robot's soil probe",
  attribution: "Field-level sensor data collected directly by the AgriNASA robot",
  url: null,
};

function SensorMoistureChart({ sensor, points }: { sensor: string; points: MoisturePoint[] }) {
  const { t } = useI18n();
  const { chart } = useTheme();
  const axis = { fontSize: 10, fill: chart.tick };
  const data = points.map((point) => ({
    time: new Date(point.measured_at).getTime(),
    pct: point.soil_moisture_pct,
  }));
  const sameDay =
    data.length > 1 &&
    data[data.length - 1].time - data[0].time <= 36 * 60 * 60 * 1000;

  return (
    <ChartCard
      title={t("Robot soil moisture")}
      description={t(
        "Measured volumetric soil moisture at the robot's probe. A gap means the robot did not report; it is never filled with an estimate.",
      )}
      source={<DataSourceBadge source={ROBOT_MOISTURE_SOURCE} />}
      footnote={
        <>
          {sensor} · {t("% volumetric")} · {points.length} {t(points.length === 1 ? "reading" : "readings")}
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value: number) =>
              sameDay ? formatTimestampClock(value) : formatTimestampDay(value)
            }
            tick={axis}
            minTickGap={26}
            tickLine={false}
            axisLine={{ stroke: chart.grid }}
          />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={40} unit="%" />
          <Tooltip
            contentStyle={chart.tooltip.contentStyle}
            labelStyle={chart.tooltip.labelStyle}
            labelFormatter={(label) => formatDateTime(new Date(Number(label)).toISOString())}
            formatter={(value) => [`${formatNumber(Number(value), 1)} %`, t("Soil moisture")]}
          />
          <Line
            type="monotone"
            dataKey="pct"
            name={t("Soil moisture (%)")}
            stroke={chart.tempMean}
            strokeWidth={2.2}
            dot={{ r: 2 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function RobotMoistureHistory({ fieldId, period }: { fieldId: number; period: DatePeriod }) {
  const { t } = useI18n();
  const state = useAsync(
    (signal) =>
      api.fieldMoisture(
        fieldId,
        { start: `${period.start}T00:00:00`, end: `${period.end}T23:59:59`, limit: 2000 },
        signal,
      ),
    [fieldId, period.start, period.end],
  );

  const data = state.data;

  const groups = useMemo(() => {
    const grouped = new Map<string, MoisturePoint[]>();
    for (const point of data?.points ?? []) {
      const key = point.sensor_label || point.sensor_id || "Robot soil sensor";
      const list = grouped.get(key) ?? [];
      list.push(point);
      grouped.set(key, list);
    }
    return Array.from(grouped, ([sensor, points]) => ({
      sensor,
      points: points.slice().sort((a, b) => a.measured_at.localeCompare(b.measured_at)),
    }));
  }, [data]);

  const fresh = data?.status === "fresh";

  return (
    <section aria-labelledby="robot-moisture-heading" className="space-y-3">
      <div>
        <h2 id="robot-moisture-heading" className="text-sm font-semibold">
          {t("Robot soil moisture history")}
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {t(
            "Readings stored exactly as the robot sent them, with their own timestamps, sensor ids and measurement status. When the robot is offline the platform reports that soil moisture is unavailable instead of inventing a value.",
          )}
        </p>
      </div>

      {state.status === "loading" && (
        <LoadingState label={t("Loading robot soil-moisture readings…")} rows={2} variant="chart" />
      )}

      {state.status === "error" && (
        <ErrorState
          title={t("Robot soil-moisture history could not be loaded")}
          message={state.error?.message ?? t("The robot history endpoint did not respond.")}
          onRetry={state.reload}
        />
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4">
              <p className="text-2xs uppercase tracking-[0.08em] text-muted">{t("Latest reading")}</p>
              <p className="mono-data mt-1 text-xl font-semibold">
                {data.latest_pct != null ? (
                  <>
                    {formatNumber(data.latest_pct, 1)}{" "}
                    <span className="text-sm font-normal text-muted">{t("% volumetric")}</span>
                  </>
                ) : (
                  t("Unavailable")
                )}
              </p>
              {data.latest_measured_at && (
                <p className="mt-1 text-2xs text-muted">
                  {t("Measured at")} {formatDateTime(data.latest_measured_at)}
                </p>
              )}
              {data.latest_sensor_id && (
                <p className="text-2xs font-mono text-muted">{data.latest_sensor_id}</p>
              )}
            </div>
            <div className="card p-4">
              <p className="text-2xs uppercase tracking-[0.08em] text-muted">{t("Readings in period")}</p>
              <p className="mono-data mt-1 text-xl font-semibold">{data.reading_count}</p>
              <p className="mt-1 text-2xs text-muted">
                {data.sensor_count} {data.sensor_count === 1 ? t("sensor") : t("sensors")}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-2xs uppercase tracking-[0.08em] text-muted">{t("Mean in period")}</p>
              <p className="mono-data mt-1 text-xl font-semibold">
                {data.mean_pct != null ? formatNumber(data.mean_pct, 1) : "—"}{" "}
                <span className="text-sm font-normal text-muted">{t("% volumetric")}</span>
              </p>
            </div>
            <div className="card p-4">
              <p className="text-2xs uppercase tracking-[0.08em] text-muted">{t("Range in period")}</p>
              <p className="mono-data mt-1 text-xl font-semibold">
                {data.min_pct != null && data.max_pct != null
                  ? `${formatNumber(data.min_pct, 1)}–${formatNumber(data.max_pct, 1)}`
                  : "—"}{" "}
                <span className="text-sm font-normal text-muted">{t("% volumetric")}</span>
              </p>
            </div>
          </div>

          {!fresh && groups.length > 0 && (
            <InfoNote tone="warn" title={t("Robot data unavailable")}>
              {data.reason
                ? t(data.reason)
                : t("The robot has not reported fresh soil moisture for this field recently.")}
            </InfoNote>
          )}

          {groups.length === 0 ? (
            data.status === "unavailable" ? (
              <InfoNote tone="warn" title={t("Robot data unavailable")}>
                {data.reason
                  ? t(data.reason)
                  : t("No soil-moisture readings were recorded by the robot in the selected period.")}
              </InfoNote>
            ) : (
              <InfoNote title={t("No readings in this period")}>
                {t(
                  "The robot's latest reading falls outside the selected period. Choose Today or a custom period that includes it.",
                )}
              </InfoNote>
            )
          ) : (
            <div className={`grid gap-5 ${groups.length > 1 ? "xl:grid-cols-2" : ""}`}>
              {groups.map((group) => (
                <SensorMoistureChart key={group.sensor} sensor={group.sensor} points={group.points} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function imageReview(analysis: PlantImageAnalysis | null): { text: string; tone: Tone } {
  if (!analysis) return { text: "Not analysed yet", tone: "neutral" };
  if (analysis.status === "unavailable") return { text: "AI review unavailable", tone: "neutral" };
  if (analysis.label === "healthy_appearance") {
    return { text: analysis.label_text ?? "Healthy appearance", tone: "good" };
  }
  if (analysis.label === "uncertain") {
    return { text: analysis.label_text ?? "Uncertain — additional inspection recommended", tone: "neutral" };
  }
  return { text: analysis.label_text ?? "Possible stress", tone: "warn" };
}

function PlantImageTile({
  title,
  image,
  emptyText,
}: {
  title: string;
  image: RobotImage | null;
  emptyText: string;
}) {
  const { t } = useI18n();

  if (!image) {
    return (
      <div className="flex min-h-44 flex-col justify-between rounded-lg border border-dashed border-line p-4">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">{title}</p>
        <p className="mt-3 text-xs leading-relaxed text-muted">{emptyText}</p>
      </div>
    );
  }

  const review = imageReview(image.analysis);

  return (
    <article className="overflow-hidden rounded-lg border border-line">
      <img
        src={image.file_url}
        alt={t("Plant photo captured by the robot")}
        className="aspect-[4/3] w-full object-cover"
        loading="lazy"
      />
      <div className="space-y-1.5 p-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">{title}</p>
        <p className="text-2xs text-muted">
          {t("Captured at")} {formatDateTime(image.captured_at)}
        </p>
        {image.growth_stage && (
          <p className="text-2xs text-muted">
            {t("Growth stage")}: {t(titleCase(image.growth_stage))}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill tone={review.tone}>{t(review.text)}</StatusPill>
          {image.analysis?.confidence_pct != null && (
            <span className="font-mono text-2xs text-muted">
              {formatNumber(image.analysis.confidence_pct, 0)}% {t("confidence")}
            </span>
          )}
        </div>
        {image.analysis?.summary && (
          <p className="text-2xs leading-relaxed text-muted">{t(image.analysis.summary)}</p>
        )}
        {image.note && <p className="text-2xs leading-relaxed text-muted">{image.note}</p>}
      </div>
    </article>
  );
}

function ReferenceTile({ reference }: { reference: HealthyReference | null }) {
  const { t } = useI18n();

  if (!reference) {
    return (
      <div className="flex min-h-44 flex-col justify-between rounded-lg border border-dashed border-line p-4">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
          {t("Healthy reference")}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {t(
            "No healthy reference photo is stored for this crop yet, so the review can only describe the photo.",
          )}
        </p>
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-lg border border-line">
      <img
        src={reference.file_url}
        alt={t("Healthy reference photo for this crop")}
        className="aspect-[4/3] w-full object-cover"
        loading="lazy"
      />
      <div className="space-y-1.5 p-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
          {t("Healthy reference")}
        </p>
        <p className="text-xs font-medium">{reference.label}</p>
        <p className="text-2xs text-muted">
          {t("Added")} {formatDateTime(reference.created_at)}
        </p>
        {reference.source_note && (
          <p className="text-2xs leading-relaxed text-muted">{reference.source_note}</p>
        )}
      </div>
    </article>
  );
}

function HistoricalPlantImages({ field, period }: { field: Field; period: DatePeriod }) {
  const { t } = useI18n();
  const state = useAsync(
    (signal) =>
      api.fieldImages(
        field.id,
        { start: `${period.start}T00:00:00`, end: `${period.end}T23:59:59`, limit: 200 },
        signal,
      ),
    [field.id, period.start, period.end],
  );

  const images = state.data?.images ?? [];
  const reference = state.data?.references[0] ?? null;

  return (
    <section aria-labelledby="plant-images-heading" className="card card-pad">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="plant-images-heading" className="text-sm font-semibold">
            {t("Plant images and health comparison")}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {t(
              "The latest robot photo, the one before it, and the healthy reference for this crop. AI review labels stay cautious and always carry a confidence value; they are not a confirmed diagnosis.",
            )}
          </p>
        </div>
        <Link to={`/robot/${field.id}`} className="btn-secondary btn-sm shrink-0">
          {t("Robot camera")}
        </Link>
      </div>

      {state.status === "loading" && (
        <div className="mt-4">
          <LoadingState label={t("Loading robot plant images…")} rows={2} />
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-4">
          <ErrorState
            title={t("Robot plant images could not be loaded")}
            message={state.error?.message ?? t("The robot image endpoint did not respond.")}
            onRetry={state.reload}
          />
        </div>
      )}

      {state.data && (
        <>
          {images.length === 0 && (
            <div className="mt-4">
              <InfoNote title={t("No plant photos in this period")}>
                {t(
                  "The robot did not upload a plant photo inside the selected period. Health comparison resumes when a new image arrives.",
                )}
              </InfoNote>
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <PlantImageTile
              title={t("Current image")}
              image={images[0] ?? null}
              emptyText={t("No photo was captured by the robot in this period.")}
            />
            <PlantImageTile
              title={t("Previous image")}
              image={images[1] ?? null}
              emptyText={t("There is no earlier photo to compare inside this period.")}
            />
            <ReferenceTile reference={reference} />
          </div>
        </>
      )}
    </section>
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

      <RobotMoistureHistory fieldId={fieldId} period={period} />
      <HistoricalPlantImages field={field} period={period} />
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
