import { Link, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import { api } from "../api/client";
import type { IrrigationAnalysis } from "../api/types";
import { AnalysisDateField } from "../components/ui/AnalysisDateField";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/AsyncState";
import { ChartCard } from "../components/ui/ChartCard";
import { ConfidenceBadge } from "../components/ui/ConfidenceBadge";
import { DataSourceBadge } from "../components/ui/DataSourceBadge";
import { Formula } from "../components/ui/Formula";
import { SoilIcon } from "../components/ui/Icons";
import { InfoNote } from "../components/ui/InfoNote";
import { SectionHeading } from "../components/ui/SectionHeading";
import { StatusPill } from "../components/ui/StatusPill";
import { useDataMode } from "../context/DataModeContext";
import { useTheme } from "../context/ThemeContext";
import { useAsync } from "../hooks/useAsync";
import { useFieldIdFromRoute } from "../hooks/useField";
import { useI18n } from "../i18n/I18nContext";
import { formatDate, formatDateShort, formatDateTime, formatNumber } from "../lib/format";
import { DEMAND_META } from "../lib/labels";
import { FieldLayout } from "../components/layout/FieldLayout";

function moistureLabelKey(assessment: IrrigationAnalysis["moisture_assessment"]) {
  if (assessment === "sufficient") return "Sufficient";
  if (assessment === "marginal") return "Marginal";
  if (assessment === "low") return "Low";
  return "Unknown";
}

function RobotMoisturePanel({ analysis }: { analysis: IrrigationAnalysis }) {
  const { t } = useI18n();
  const robot = analysis.robot_soil_moisture;
  const fresh = robot.status === "fresh";
  const assessmentTone =
    analysis.moisture_assessment === "sufficient"
      ? "good"
      : analysis.moisture_assessment === "marginal"
        ? "warn"
        : analysis.moisture_assessment === "low"
          ? "bad"
          : "neutral";

  return (
    <section className="card card-pad" aria-label={t("Robot soil moisture")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-sage-100 text-forest-700">
            <SoilIcon size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">{t("Robot soil moisture")}</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
              {t(
                "Measured by a field sensor at one point and depth. It is the primary irrigation signal; satellite and model moisture are never substituted for it.",
              )}
            </p>
          </div>
        </div>
        <StatusPill tone={fresh ? "good" : robot.status === "stale" ? "warn" : "neutral"}>
          {fresh
            ? t("Measured · current")
            : robot.status === "stale"
              ? t("Measured · stale")
              : t("Robot data unavailable")}
        </StatusPill>
      </div>

      {fresh ? (
        <>
          <div className="mt-4 rounded-md border border-forest-200 bg-forest-50 p-4">
            <p className="eyebrow text-forest-700">{t("Latest probe reading")}</p>
            <p className="mono-data mt-1 text-3xl font-semibold text-forest-900">
              {formatNumber(robot.latest_pct, 1)}
              <span className="ms-2 text-base font-normal text-forest-700">{t("% vol")}</span>
            </p>
            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-2xs sm:grid-cols-2">
              <div className="flex items-center justify-between gap-2 border-b border-forest-200/70 py-1.5">
                <dt className="text-forest-700">{t("Measured at")}</dt>
                <dd className="text-forest-900">{formatDateTime(robot.measured_at)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-forest-200/70 py-1.5">
                <dt className="text-forest-700">{t("Sensor")}</dt>
                <dd className="font-mono text-forest-900" dir="ltr">
                  {robot.sensor_id ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-forest-200/70 py-1.5">
                <dt className="text-forest-700">{t("Measurement status")}</dt>
                <dd className="text-forest-900">{robot.measurement_status ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-forest-200/70 py-1.5">
                <dt className="text-forest-700">{t("Readings, last 24 h")}</dt>
                <dd className="text-forest-900">
                  {robot.reading_count_24h} · {t("{count} sensor(s)", { count: robot.sensor_count })}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-forest-200/70 py-1.5">
                <dt className="text-forest-700">{t("24 h mean / min / max")}</dt>
                <dd className="text-forest-900">
                  {formatNumber(robot.mean_pct_24h, 1)} / {formatNumber(robot.min_pct_24h, 1)} /{" "}
                  {formatNumber(robot.max_pct_24h, 1)}%
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-forest-200/70 py-1.5">
                <dt className="text-forest-700">{t("Location")}</dt>
                <dd className="font-mono text-forest-900" dir="ltr">
                  {robot.latitude !== null && robot.longitude !== null
                    ? `${robot.latitude.toFixed(4)}, ${robot.longitude.toFixed(4)}`
                    : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-2xs leading-relaxed text-forest-800/80">{t(robot.note)}</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-line bg-card p-3">
              <p className="field-label">{t("Is moisture sufficient?")}</p>
              <StatusPill tone={assessmentTone}>{t(moistureLabelKey(analysis.moisture_assessment))}</StatusPill>
              <p className="mt-2 text-2xs leading-relaxed text-muted">
                {t(
                  "Relative to the refill range between wilting point and field capacity for the field's soil texture.",
                )}
              </p>
            </div>
            <div className="rounded-md border border-line bg-card p-3">
              <p className="field-label">{t("Is irrigation needed?")}</p>
              <StatusPill
                tone={
                  analysis.irrigation_needed === true
                    ? "bad"
                    : analysis.irrigation_needed === false
                      ? "good"
                      : "neutral"
                }
              >
                {analysis.irrigation_needed === true
                  ? t("Irrigation needed")
                  : analysis.irrigation_needed === false
                    ? t("No irrigation needed now")
                    : t("Not enough data to decide")}
              </StatusPill>
              <p className="mt-2 text-2xs leading-relaxed text-muted">
                {t(
                  "The probe is compared with the crop's refill threshold for its current growth stage.",
                )}
              </p>
            </div>
          </div>
        </>
      ) : (
        <InfoNote tone="warn" title={t("Robot data unavailable")} className="mt-4">
          {t(
            robot.reason ??
              "No current robot soil moisture reading is available. The app does not replace it with a model or satellite estimate.",
          )}
        </InfoNote>
      )}
    </section>
  );
}

function WaterRequirementPanel({ analysis }: { analysis: IrrigationAnalysis }) {
  const { t } = useI18n();
  const requirement = analysis.water_requirement;
  const estimated = requirement.status === "estimated";

  return (
    <section
      className={`card p-5 ${estimated ? "border-forest-200 bg-forest-50" : "border-clay-200"}`}
      aria-label={t("Estimated Water Requirement")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow text-forest-700">{t("Estimated Water Requirement")}</p>
          {estimated ? (
            <>
              <p className="mono-data mt-1 text-3xl font-semibold text-forest-900">
                {formatNumber(requirement.gross_mm ?? requirement.net_mm, 1)} mm
                <span className="ms-2 text-base font-normal text-forest-700">
                  {requirement.gross_mm !== null ? t("gross") : t("net")}
                </span>
              </p>
              {requirement.volume_m3 !== null && (
                <p className="mt-1 text-sm text-forest-800">
                  {t("≈ {volume} m³ for {area} ha", {
                    volume: formatNumber(requirement.volume_m3, 0),
                    area: formatNumber(requirement.area_ha, 2),
                  })}
                </p>
              )}
              {requirement.gross_mm !== null && requirement.net_mm !== null && (
                <p className="mt-1 text-xs text-forest-800/80">
                  {t("{net} mm net at field capacity target", {
                    net: formatNumber(requirement.net_mm, 1),
                  })}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-lg font-semibold text-clay-700">
              {t("Insufficient data to estimate water requirement")}
            </p>
          )}
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-forest-800/80">
            {t(
              estimated
                ? requirement.method === "robot_soil_moisture"
                  ? "Calculated from the current robot probe reading plus soil, rooting depth and area assumptions. The probe measures moisture; the volume is an estimate."
                  : "No current robot reading is available, so this estimate comes from the FAO-56 root-zone balance driven by coarse-grid weather."
                : requirement.reason ??
                  "A current robot reading and/or a complete water balance is required before a volume can be estimated.",
            )}
          </p>
        </div>
        <StatusPill tone={estimated ? "good" : "warn"}>
          {estimated ? t("Estimate · {level} confidence", { level: t(requirement.confidence) }) : t("No estimate")}
        </StatusPill>
      </div>

      {estimated && requirement.assumptions.length > 0 && (
        <details className="mt-4 border-t border-forest-200 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-forest-700 hover:underline">
            {t("Assumptions behind this estimate")}
          </summary>
          <ul className="mt-2 space-y-1">
            {requirement.assumptions.map((assumption) => (
              <li key={assumption} className="text-2xs leading-relaxed text-forest-800/85">
                • {t(assumption)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function BalanceChart({ analysis }: { analysis: IrrigationAnalysis }) {
  const { chart } = useTheme();
  const { t } = useI18n();

  if (analysis.balance_series.length === 0) {
    return (
      <EmptyState
        title={t("No simulated balance days")}
        description={t(
          "The water balance has no days to display. This usually means the crop had not been planted in the analysis window.",
        )}
      />
    );
  }

  const tooltipProps = {
    contentStyle: chart.tooltip.contentStyle,
    labelStyle: chart.tooltip.labelStyle,
    labelFormatter: (label: unknown) => formatDate(String(label)),
  };
  const axis = { fontSize: 10, fill: chart.tick };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={analysis.balance_series}
        margin={{ top: 8, right: 12, bottom: 4, left: -12 }}
      >
        <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateShort}
          tick={axis}
          minTickGap={30}
          tickLine={false}
          axisLine={{ stroke: chart.grid }}
        />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={42} unit=" mm" />
        <Tooltip {...tooltipProps} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="taw_mm"
          name={t("Total available water (TAW)")}
          stroke={chart.taw}
          strokeWidth={1.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="raw_mm"
          name={t("Readily available water (RAW)")}
          stroke={chart.raw}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="depletion_mm"
          name={t("Root-zone depletion")}
          stroke={chart.depletion}
          strokeWidth={2.4}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function BalanceBar({ fraction }: { fraction: number | null }) {
  const { t } = useI18n();
  const percent = fraction === null ? 0 : Math.min(100, Math.max(0, fraction * 100));
  const tone = percent >= 80 ? "bg-[#a63d33]" : percent >= 55 ? "bg-clay-500" : "bg-forest-500";

  return (
    <div>
      <div className="flex items-center justify-between text-2xs text-muted">
        <span>{t("Root-zone depletion")}</span>
        <span className="mono-data">
          {fraction === null ? "—" : t("{value}% of TAW", { value: formatNumber(percent, 0) })}
        </span>
      </div>
      <div
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sage-200"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label={t("Root-zone depletion as a percentage of total available water")}
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>0%</span>
        <span>{t("55% moderate")}</span>
        <span>{t("80% high")}</span>
      </div>
    </div>
  );
}

function IrrigationBody({ fieldId }: { fieldId: number }) {
  const { t, isRtl } = useI18n();
  const { mode } = useDataMode();
  const [analysisDate, setAnalysisDate] = useState<string | null>(null);
  const state = useAsync(
    (signal) => api.irrigation(fieldId, { mode, end: analysisDate ?? undefined, signal }),
    [fieldId, mode, analysisDate],
  );
  const analysis = state.data;

  const dateControl = <AnalysisDateField value={analysisDate} onChange={setAnalysisDate} />;
  const dateCaption = (
    <p className="text-2xs leading-relaxed text-muted">
      {t(
        "Season-to-date analysis from planting through {date}. The backend defaults to the most recent available day.",
        { date: analysis ? formatDate(analysis.computed_for) : "…" },
      )}
    </p>
  );

  if (state.status === "loading") {
    return (
      <>
        {dateControl}
        <LoadingState
          label={t("Fetching weather and running the FAO-56 water balance…")}
          rows={3}
          variant="chart"
        />
      </>
    );
  }

  if (state.status === "error") {
    return (
      <>
        {dateControl}
        <ErrorState
          title={t("Irrigation analysis unavailable")}
          message={state.error?.message ?? t("The water balance could not be computed.")}
          details={t("Retry, or enable Demo data in the header to use the cached snapshot.")}
          onRetry={state.reload}
        />
      </>
    );
  }

  if (!analysis) return null;

  const meta = DEMAND_META[analysis.demand];
  const seasonComplete = analysis.season_complete;
  const insufficient = analysis.status !== "ok";
  const balance = analysis.balance;
  const demandLabel = t(meta.label);

  return (
    <>
      <div className="space-y-1.5">
        {dateControl}
        {dateCaption}
      </div>
      <SectionHeading
        eyebrow={t("Irrigation analysis")}
        title={t("Crop water demand")}
        description={t(
          "Deterministic FAO-56 calculation for {date}. The model uses NASA POWER weather, a stage-based crop Kc curve and a root-zone water bucket.",
          { date: formatDate(analysis.computed_for) },
        )}
        actions={<DataSourceBadge source={analysis.source} isDemo={analysis.is_demo} />}
      />

      <section className={`card overflow-hidden ${insufficient ? "border-clay-200" : ""}`}>
        <div className="flex flex-col gap-4 border-b border-line bg-sage-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">{t("Irrigation demand")}</p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.03em]">
              {seasonComplete
                ? t("SEASON COMPLETE")
                : insufficient
                  ? t("INSUFFICIENT DATA")
                  : isRtl
                    ? demandLabel
                    : demandLabel.toUpperCase()}
            </p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
              {seasonComplete
                ? t(
                    "The crop season has ended. No irrigation demand is assessed after harvest.",
                  )
                : insufficient
                  ? t(
                      "No demand class is shown because the model's inputs are incomplete. Missing data is not replaced with estimates.",
                    )
                  : t(meta.description)}
            </p>
          </div>
          {seasonComplete ? (
            <StatusPill tone="neutral">{t("Season complete")}</StatusPill>
          ) : (
            !insufficient && <StatusPill tone={meta.tone}>{demandLabel}</StatusPill>
          )}
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <p className="field-label">{seasonComplete ? t("Season status") : t("Contributing factors")}</p>
            <ul className="space-y-1.5">
              {analysis.demand_reasons.map((reason) => (
                <li key={reason} className="flex gap-2 text-sm leading-relaxed text-ink/90">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-forest-500" aria-hidden="true" />
                  <span>{t(reason)}</span>
                </li>
              ))}
            </ul>

            {insufficient && analysis.missing_inputs.length > 0 && (
              <InfoNote title={t("Required inputs that are missing")} tone="warn" className="mt-4">
                <ul className="space-y-1">
                  {analysis.missing_inputs.map((item) => (
                    <li key={item}>• {t(item)}</li>
                  ))}
                </ul>
              </InfoNote>
            )}
          </div>

          {!seasonComplete && (
            <div className="rounded-md border border-line bg-card p-4">
              <p className="field-label">{t("Confidence")}</p>
              <ConfidenceBadge assessment={analysis.confidence} showReasons />
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <RobotMoisturePanel analysis={analysis} />
        <WaterRequirementPanel analysis={analysis} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <section className="card card-pad" aria-label={t("Calculation chain")}>
            <h2 className="text-sm font-semibold">{t("Calculation chain")}</h2>
            <ol className="mt-3 space-y-3">
              <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
                <span className="mono-data text-2xs text-forest-600">01</span>
                <div>
                  <p className="text-xs font-medium">{t("Growth stage and Kc")}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {analysis.stage
                      ? t("{stage} · day {day} after planting · Kc {kc}", {
                          stage: t(analysis.stage.name),
                          day: analysis.stage.days_after_planting ?? "—",
                          kc: formatNumber(analysis.stage.kc, 2),
                        })
                      : t("No growth stage is available for this analysis date.")}
                  </p>
                </div>
              </li>
              <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
                <span className="mono-data text-2xs text-forest-600">02</span>
                <div>
                  <p className="text-xs font-medium">{t("Reference evapotranspiration")}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {t(
                      "ET₀ {et0} mm/day from the latest day with complete temperature, humidity, wind, pressure and solar inputs.",
                      { et0: formatNumber(analysis.et0_mm_day, 2) },
                    )}
                  </p>
                </div>
              </li>
              <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
                <span className="mono-data text-2xs text-forest-600">03</span>
                <div>
                  <p className="text-xs font-medium">{t("Crop water use")}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    ETc = Kc × ET₀ = {formatNumber(analysis.kc, 2)} ×{" "}
                    {formatNumber(analysis.et0_mm_day, 2)} ={" "}
                    <span className="mono-data text-ink" dir="ltr">
                      {formatNumber(analysis.etc_mm_day, 2)} mm/day
                    </span>
                  </p>
                </div>
              </li>
              <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
                <span className="mono-data text-2xs text-forest-600">04</span>
                <div>
                  <p className="text-xs font-medium">{t("Root-zone water balance")}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {t(
                      "ΔS = P + I − ETc − D − R over {days} day(s), with I = 0, initial depletion {depletion} mm, runoff {runoff} mm and drainage {drainage} mm.",
                      {
                        days: balance.days_simulated,
                        depletion: formatNumber(balance.initial_depletion_mm, 1),
                        runoff: formatNumber(balance.runoff_mm, 1),
                        drainage: formatNumber(balance.drainage_mm, 1),
                      },
                    )}
                  </p>
                  <div className="mt-2">
                    <BalanceBar fraction={balance.depletion_fraction} />
                  </div>
                </div>
              </li>
            </ol>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-muted">{t("Depletion")}</dt>
                <dd className="mono-data mt-0.5 font-semibold">
                  {formatNumber(balance.depletion_mm, 1)} mm
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t("TAW")}</dt>
                <dd className="mono-data mt-0.5 font-semibold">{formatNumber(balance.taw_mm, 1)} mm</dd>
              </div>
              <div>
                <dt className="text-muted">{t("RAW")}</dt>
                <dd className="mono-data mt-0.5 font-semibold">{formatNumber(balance.raw_mm, 1)} mm</dd>
              </div>
              <div>
                <dt className="text-muted">{t("Stress days")}</dt>
                <dd className="mono-data mt-0.5 font-semibold">{balance.stress_days}</dd>
              </div>
            </dl>

            {balance.excluded_et0_days > 0 && (
              <InfoNote tone="warn" className="mt-3">
                {t(
                  "{days} day(s) lacked complete ET₀ inputs. Those days were simulated without crop water use; the model did not fill weather values.",
                  { days: balance.excluded_et0_days },
                )}
              </InfoNote>
            )}
          </section>

          <ChartCard
            title={t("Root-zone water balance")}
            description={t(
              "Simulated depletion compared with the readily available water (RAW) and total available water (TAW) limits.",
            )}
            height={290}
            source={<DataSourceBadge source={analysis.source} isDemo={analysis.is_demo} />}
            footnote={t("mm · deterministic bucket model · no irrigation events assumed")}
          >
            <BalanceChart analysis={analysis} />
          </ChartCard>
        </div>

        <div className="min-w-0 space-y-5">
          <section className="card card-pad" aria-label={t("Model drivers")}>
            <h2 className="text-sm font-semibold">{t("Model drivers")}</h2>
            <div className="mt-3 space-y-3">
              {analysis.drivers.map((driver) => (
                <div key={driver.key} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-medium">{t(driver.label)}</p>
                    <p className="mono-data shrink-0 text-xs text-ink" dir="ltr">
                      {typeof driver.value === "number"
                        ? formatNumber(driver.value, 2)
                        : driver.value ?? "—"}
                      {driver.unit ? ` ${t(driver.unit)}` : ""}
                    </p>
                  </div>
                  <p className="mt-0.5 text-2xs leading-relaxed text-muted">
                    {t(driver.interpretation)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="card card-pad" aria-label={t("Scientific method")}>
            <h2 className="text-sm font-semibold">{t("Method & assumptions")}</h2>
            <div className="mt-3 space-y-3">
              <Formula
                name="FAO-56 Penman–Monteith"
                expression={
                  "ET₀ = [0.408 Δ (Rn − G) + γ (900/(T+273)) u₂ (es − ea)]\n     ÷ [Δ + γ (1 + 0.34 u₂)]"
                }
                variables={[
                  { symbol: "Δ", meaning: "slope of the saturation vapour-pressure curve" },
                  { symbol: "Rn", meaning: "net radiation (MJ/m²/day)" },
                  { symbol: "T", meaning: "mean air temperature (°C)" },
                  { symbol: "u₂", meaning: "wind speed at 2 m (m/s)" },
                  { symbol: "es − ea", meaning: "vapour-pressure deficit (kPa)" },
                  { symbol: "γ", meaning: "psychrometric constant (kPa/°C)" },
                ]}
                note="G is assumed zero for daily steps. Missing inputs produce no ET₀ value rather than an invented one."
              />
              <Formula
                name="Crop water use"
                expression="ETc = Kc × ET₀"
                variables={[
                  {
                    symbol: "Kc",
                    meaning: "stage-dependent crop coefficient (linear interpolation)",
                  },
                  { symbol: "ET₀", meaning: "reference evapotranspiration (mm/day)" },
                ]}
              />
              <Formula
                name="Root-zone water balance"
                expression="ΔS = P + I − ETc − D − R"
                variables={[
                  { symbol: "P", meaning: "precipitation (mm)" },
                  { symbol: "I", meaning: "irrigation — assumed 0 in the baseline" },
                  { symbol: "ETc", meaning: "crop evapotranspiration (mm)" },
                  { symbol: "D", meaning: "deep drainage (mm)" },
                  { symbol: "R", meaning: "runoff — 10% of daily rain" },
                ]}
              />
            </div>
            <p className="mt-3 text-2xs leading-relaxed text-muted">
              {t(
                "Demand thresholds (55% and 80% of TAW) are documented agronomic heuristics, not a validated field prescription. See the backend ",
              )}
              <code>science/irrigation.py</code>.
            </p>
          </section>

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
            {analysis.missing_inputs.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
                  {t("Missing inputs")}
                </p>
                <ul className="mt-1 space-y-1 text-2xs leading-relaxed text-muted">
                  {analysis.missing_inputs.map((item) => (
                    <li key={item}>• {t(item)}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-2xs text-muted">
              {t("Need help reading this? Ask the")}{" "}
              <Link to={`/assistant/${fieldId}`} className="link-underline">
                {t("field assistant")}
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

/** Irrigation demand, calculation chain, balance chart and documented assumptions. */
export function IrrigationPage() {
  const params = useParams();
  const fieldId = useFieldIdFromRoute(params.fieldId);
  const { t } = useI18n();

  if (!fieldId) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title={t("No field selected")}
          description={t("Choose a field before opening irrigation analysis.")}
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
    <FieldLayout fieldId={fieldId} activeTab="irrigation">
      {() => <IrrigationBody fieldId={fieldId} />}
    </FieldLayout>
  );
}
