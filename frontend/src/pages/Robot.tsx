import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import type {
  DeviceToken,
  Field,
  FieldImages,
  FieldSensors,
  PlantImageAnalysis,
  RobotDevice,
  RobotImage,
  SatelliteAnalysis,
} from "../api/types";
import { FieldLayout } from "../components/layout/FieldLayout";
import { ChartCard } from "../components/ui/ChartCard";
import { InfoNote } from "../components/ui/InfoNote";
import {
  AlertIcon,
  CpuIcon,
  DatabaseIcon,
  DropIcon,
  HumidityIcon,
  LeafIcon,
  RefreshIcon,
  SatelliteIcon,
  ThermometerIcon,
  TrashIcon,
} from "../components/ui/Icons";
import { StatusPill, type Tone } from "../components/ui/StatusPill";
import { useDataMode } from "../context/DataModeContext";
import { useTheme } from "../context/ThemeContext";
import { useAsync } from "../hooks/useAsync";
import { useI18n } from "../i18n/I18nContext";
import { formatDateTime, formatNumber, titleCase } from "../lib/format";
import { DeviceKeyReveal } from "../components/robot/DeviceKeyReveal";
import { RobotPairPanel } from "../components/robot/RobotPairPanel";

const POLL_MS = 5000;

function minutesSince(iso: string): number {
  const then = new Date(iso);
  return (Date.now() - then.getTime()) / 60000;
}

function Freshness({ measuredAt }: { measuredAt: string | null }) {
  const { t } = useI18n();
  if (!measuredAt) return null;
  const minutes = Math.max(0, minutesSince(measuredAt));
  if (!Number.isFinite(minutes)) return null;
  let tone: Tone = "good";
  let label: string;
  if (minutes < 10) {
    label = t("Live · last reading {n} min ago", { n: Math.max(1, Math.round(minutes)) });
  } else if (minutes < 180) {
    tone = "info";
    label = t("Recent · last reading {n} h ago", { n: Math.round(minutes / 60) });
  } else {
    tone = "warn";
    label =
      minutes < 2880
        ? t("Stale · last reading {n} h ago", { n: Math.round(minutes / 60) })
        : t("Stale · last reading {n} d ago", { n: Math.round(minutes / 1440) });
  }
  return (
    <StatusPill tone={tone} dot={false}>
      {label}
    </StatusPill>
  );
}

function SensorTile({
  icon,
  label,
  value,
  unit,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string | null;
  hint: string;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-md border border-line bg-card p-3.5">
      <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-muted">
        <span className="text-forest-600">{icon}</span>
        {t(label)}
      </p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-[-0.02em] text-ink">{value}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </p>
      <p className="mt-1 text-2xs leading-relaxed text-muted">{t(hint)}</p>
    </div>
  );
}

function PairingSidebar({ field, onDeviceChange }: { field: Field; onDeviceChange: () => void }) {
  const { t } = useI18n();
  const [issued, setIssued] = useState<DeviceToken | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function issueKey() {
    setBusy(true);
    setError(null);
    try {
      const token = await api.createDevice(field.id, label.trim() || undefined);
      setIssued(token);
      setLabel("");
      onDeviceChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("The device key could not be created."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card card-pad" aria-labelledby="robot-pair-heading">
        <h2 id="robot-pair-heading" className="text-sm font-semibold">
          {t("Pair a robot")}
        </h2>
        <p className="mt-1 text-2xs leading-relaxed text-muted">
          {t("Step 1 · create a one-time code for {field}", { field: field.name })}
        </p>
        <div className="mt-3">
          <RobotPairPanel fieldId={field.id} />
        </div>
      </section>

      <section className="card card-pad" aria-labelledby="robot-key-heading">
        <h2 id="robot-key-heading" className="text-sm font-semibold">
          {t("Create a key directly")}
        </h2>
        <p className="mt-1 text-2xs leading-relaxed text-muted">
          {t(
            "Use this when you are wiring the board at this computer and do not need the QR step.",
          )}
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={60}
            placeholder={t("Device name (optional)")}
            className="input py-1.5 text-xs"
            aria-label={t("Device name (optional)")}
          />
          <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => void issueKey()} disabled={busy}>
            {busy ? t("Creating…") : t("Create key")}
          </button>
        </div>
        {error && (
          <p className="mt-2 flex items-start gap-1.5 text-2xs text-clay-600">
            <AlertIcon size={13} />
            {error}
          </p>
        )}
        {issued && (
          <div className="mt-3">
            <DeviceKeyReveal issued={issued} robotHref={`/robot/${field.id}`} />
          </div>
        )}
      </section>

      <section className="card card-pad" aria-labelledby="robot-ingest-heading">
        <h2 id="robot-ingest-heading" className="text-sm font-semibold">
          {t("Robot ingest endpoint")}
        </h2>
        <dl className="mt-2 space-y-2 text-2xs leading-relaxed text-muted">
          <div>
            <dt className="font-medium text-ink">{t("Address")}</dt>
            <dd className="mt-0.5 select-all break-all font-mono text-[10px] text-ink" dir="ltr">
              POST {window.location.origin}/api/ingest/readings
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink">{t("Authentication")}</dt>
            <dd className="mt-0.5 font-mono text-[10px] text-ink" dir="ltr">
              Authorization: Bearer &lt;device key&gt;
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink">{t("Body")}</dt>
            <dd className="mt-0.5 font-mono text-[10px] text-ink" dir="ltr">
              {`{"soil_moisture_pct": 28.5, "air_temp_c": 31.2,`}
              <br />
              {` "humidity_pct": 54.0, "distance_cm": 62.0,`}
              <br />
              {` "sensor_id": "soil-1", "latitude": 26.152,`}
              <br />
              {` "longitude": 32.723, "status": "ok",`}
              <br />
              {` "measured_at": "2026-11-18T09:30:00Z"}`}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-2xs leading-relaxed text-muted">
          {t(
            "Send one reading per measurement. Any subset of the four sensor values is accepted; sensor_id, GPS and status are optional. measured_at defaults to the server time.",
          )}
        </p>
      </section>
    </div>
  );
}

function DeviceList({
  devices,
  reload,
}: {
  devices: RobotDevice[];
  reload: () => void;
}) {
  const { t } = useI18n();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(deviceId: number) {
    setBusyId(deviceId);
    setError(null);
    try {
      await api.revokeDevice(deviceId);
      setConfirmId(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("The device could not be revoked."));
    } finally {
      setBusyId(null);
    }
  }

  if (devices.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted">
        {t("No robot is paired to this field yet.")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-2xs text-clay-600">{error}</p>}
      <ul className="space-y-2">
        {devices.map((device) => (
          <li key={device.id} className="rounded-md border border-line bg-sage-50/50 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-ink">{device.label}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted" dir="ltr">
                  {device.token_prefix}…
                </p>
                <p className="mt-1 text-2xs text-muted">
                  {device.last_seen_at
                    ? t("Last seen {when}", { when: formatDateTime(device.last_seen_at) })
                    : t("Never connected")}
                </p>
              </div>
              <StatusPill tone={device.active ? "good" : "neutral"} dot={false}>
                {device.active ? t("Active") : t("Revoked")}
              </StatusPill>
            </div>
            {device.active && (
              <div className="mt-2">
                {confirmId === device.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-clay-700"
                      onClick={() => void revoke(device.id)}
                      disabled={busyId === device.id}
                    >
                      <TrashIcon size={12} />
                      {busyId === device.id ? t("Revoking…") : t("Confirm revoke")}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => setConfirmId(null)}
                    >
                      {t("Keep it")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setConfirmId(device.id)}
                  >
                    {t("Revoke")}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiveFeed({
  field,
  devices,
  reloadDevices,
}: {
  field: Field;
  devices: RobotDevice[];
  reloadDevices: () => void;
}) {
  const { t } = useI18n();
  const { chart } = useTheme();
  const [feed, setFeed] = useState<FieldSensors | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [listening, setListening] = useState(false);
  const activeDevices = devices.filter((device) => device.active);

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const next = await api.fieldSensors(field.id);
      setFeed(next);
      setFeedError(null);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : t("The sensor feed could not be loaded."));
    } finally {
      setLoadingFeed(false);
    }
  }, [field.id, t]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!listening) return;
    const timer = window.setInterval(() => void loadFeed(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [listening, loadFeed]);

  // Stop listening if every paired device was revoked while connected.
  useEffect(() => {
    if (listening && activeDevices.length === 0) setListening(false);
  }, [activeDevices.length, listening]);

  const latest = feed?.latest ?? null;
  const series = useMemo(
    () =>
      (feed?.readings ?? [])
        .slice()
        .reverse()
        .map((reading) => ({
          time: new Date(reading.measured_at).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          }),
          soil: reading.soil_moisture_pct,
          temp: reading.air_temp_c,
          humidity: reading.humidity_pct,
          distance: reading.distance_cm,
        })),
    [feed],
  );

  const tooltipProps = {
    contentStyle: chart.tooltip.contentStyle,
    labelStyle: chart.tooltip.labelStyle,
  };
  const axis = { fontSize: 10, fill: chart.tick };

  return (
    <section className="card overflow-hidden" aria-labelledby="robot-live-heading">
      <header className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="robot-live-heading" className="flex items-center gap-1.5 text-sm font-semibold">
            <CpuIcon size={15} />
            {t("Live sensor panel")}
          </h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-muted">
            {t("Readings arrive from the robot through the ingest endpoint.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => void loadFeed()}
            disabled={loadingFeed}
          >
            <RefreshIcon size={13} />
            {t("Refresh")}
          </button>
          <button
            type="button"
            className={listening ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
            onClick={() => setListening((value) => !value)}
            disabled={!listening && activeDevices.length === 0}
          >
            {listening ? t("Stop listening") : t("Connect")}
          </button>
        </div>
      </header>

      <div className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={listening ? "good" : "neutral"} dot={false}>
            {listening ? t("Listening every 5 s") : t("Not connected")}
          </StatusPill>
          <Freshness measuredAt={latest?.measured_at ?? null} />
          {activeDevices.length === 0 && (
            <span className="text-2xs text-muted">{t("Pair a robot to start listening.")}</span>
          )}
        </div>

        {feedError && (
          <p className="mt-3 flex items-start gap-1.5 text-2xs text-clay-600">
            <AlertIcon size={13} />
            {feedError}
          </p>
        )}

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <SensorTile
            icon={<DropIcon size={14} />}
            label="Soil moisture"
            value={latest?.soil_moisture_pct != null ? formatNumber(latest.soil_moisture_pct, 1) : "—"}
            unit="%"
            hint="Volumetric-water-style index from the probe"
          />
          <SensorTile
            icon={<ThermometerIcon size={14} />}
            label="Air temperature"
            value={latest?.air_temp_c != null ? formatNumber(latest.air_temp_c, 1) : "—"}
            unit="°C"
            hint="DHT22 in the canopy layer"
          />
          <SensorTile
            icon={<HumidityIcon size={14} />}
            label="Relative humidity"
            value={latest?.humidity_pct != null ? formatNumber(latest.humidity_pct, 1) : "—"}
            unit="%"
            hint="DHT22 in the canopy layer"
          />
          <SensorTile
            icon={<SatelliteIcon size={14} />}
            label="Canopy distance"
            value={latest?.distance_cm != null ? formatNumber(latest.distance_cm, 0) : "—"}
            unit="cm"
            hint="HC-SR04, sensor to the crop surface"
          />
        </div>

        {latest ? (
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 rounded-md border border-line bg-sage-50/60 p-3 text-2xs sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
              <dt className="text-muted">{t("Measured at")}</dt>
              <dd className="text-ink">{formatDateTime(latest.measured_at)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
              <dt className="text-muted">{t("Sensor")}</dt>
              <dd className="font-mono text-ink" dir="ltr">
                {latest.sensor_id ?? "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
              <dt className="text-muted">{t("Status")}</dt>
              <dd className="text-ink">{latest.status ?? "ok"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
              <dt className="text-muted">{t("GPS")}</dt>
              <dd className="font-mono text-ink" dir="ltr">
                {latest.latitude != null && latest.longitude != null
                  ? `${latest.latitude.toFixed(4)}, ${latest.longitude.toFixed(4)}`
                  : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <InfoNote tone="warn" title={t("Robot data unavailable")} className="mt-3">
            {t(
              "No stored robot readings exist for this field yet. Values are not simulated or filled in.",
            )}
          </InfoNote>
        )}

        {!listening && activeDevices.length > 0 && (
          <p className="mt-3 text-2xs leading-relaxed text-muted">
            {t(
              "Press Connect to poll the stored readings. The panel refreshes every 5 seconds while the robot keeps posting.",
            )}
          </p>
        )}

        {series.length >= 2 && (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Soil moisture series"
              description="Each point is one reading stored by the backend."
              height={200}
              source={t("Field robot · probe at the sensor depth")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={axis} tickLine={false} axisLine={{ stroke: chart.grid }} minTickGap={18} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip {...tooltipProps} />
                  <Line type="monotone" dataKey="soil" name={t("Soil moisture %")} stroke={chart.tempMean} strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard
              title="Air conditions"
              description="Temperature and relative humidity from the DHT22."
              height={200}
              source={t("Field robot · canopy air")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={axis} tickLine={false} axisLine={{ stroke: chart.grid }} minTickGap={18} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipProps} />
                  <Line type="monotone" dataKey="temp" name={t("Air temperature °C")} stroke={chart.tempMax} strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="humidity" name={t("Humidity %")} stroke={chart.humidity} strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        {series.length === 0 && !loadingFeed && (
          <p className="mt-4 rounded-md border border-dashed border-line bg-sage-50 p-3 text-2xs leading-relaxed text-muted">
            {t(
              "No readings yet. Once the robot posts, the latest values and the last 60 readings appear here.",
            )}
          </p>
        )}
      </div>

      <footer className="border-t border-line px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold">{t("Paired devices")}</h3>
            <p className="mt-0.5 text-2xs text-muted">
              {t("Revoking a device stops its readings immediately.")}
            </p>
          </div>
          <Link to={`/satellite/${field.id}`} className="btn-ghost btn-sm">
            {t("Satellite view")}
          </Link>
        </div>
        <div className="mt-2">
          <DeviceList devices={devices} reload={reloadDevices} />
        </div>
      </footer>
    </section>
  );
}

const PLANT_STAGES = [
  "germination",
  "seedling",
  "vegetative_growth",
  "flowering",
  "fruiting",
  "maturity",
  "harvest",
];

async function fileToBase64(file: File): Promise<string> {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
  const comma = data.indexOf(",");
  return comma >= 0 ? data.slice(comma + 1) : data;
}

function analysisLabel(analysis: PlantImageAnalysis | null): string {
  if (!analysis) return "Not analysed yet";
  if (analysis.status === "unavailable") return "AI review unavailable";
  return analysis.label_text ?? "Uncertain — additional inspection recommended";
}

function RobotImageCard({
  image,
  onAnalyze,
  busy,
}: {
  image: RobotImage;
  onAnalyze: (id: number) => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  const analysis = image.analysis;
  const differences = Array.isArray(analysis?.comparison?.visual_differences)
    ? (analysis?.comparison?.visual_differences as string[])
    : [];

  return (
    <article className="rounded-md border border-line bg-card p-3">
      <div className="flex gap-3">
        <a
          href={image.file_url}
          target="_blank"
          rel="noreferrer noopener"
          className="block h-24 w-24 shrink-0 overflow-hidden rounded-md border border-line bg-sage-50"
        >
          <img
            src={image.file_url}
            alt={t("Plant photo captured at {time}", { time: formatDateTime(image.captured_at) })}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill
              tone={
                analysis?.status === "ok"
                  ? analysis.label === "healthy_appearance"
                    ? "good"
                    : analysis.label === "uncertain"
                      ? "warn"
                      : "info"
                  : "neutral"
              }
              dot={false}
            >
              {t(analysisLabel(analysis))}
            </StatusPill>
            {analysis?.confidence_pct != null && (
              <span className="font-mono text-2xs text-muted">
                {t("{value}% confidence", { value: formatNumber(analysis.confidence_pct, 0) })}
              </span>
            )}
          </div>
          <p className="mt-1 text-2xs text-muted">
            {formatDateTime(image.captured_at)}
            {image.growth_stage ? ` · ${t(titleCase(image.growth_stage))}` : ""}
          </p>
          {image.note && <p className="mt-1 text-2xs leading-relaxed text-muted">{image.note}</p>}
          {analysis?.summary && (
            <p className="mt-1.5 text-xs leading-relaxed text-ink">{analysis.summary}</p>
          )}
          {differences.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {differences.slice(0, 4).map((item) => (
                <li key={item} className="text-2xs leading-relaxed text-muted">
                  • {item}
                </li>
              ))}
            </ul>
          )}
          {analysis?.status === "unavailable" && (
            <p className="mt-1.5 text-2xs leading-relaxed text-clay-600">
              {analysis.summary ?? t("No AI key was configured, so no label was invented.")}
            </p>
          )}
          {analysis && analysis.limitations.length > 0 && (
            <p className="mt-1 text-2xs leading-relaxed text-muted">{analysis.limitations[0]}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(!analysis || analysis.status === "unavailable") && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => onAnalyze(image.id)}
                disabled={busy}
              >
                {busy ? t("Reviewing…") : t("Run AI review")}
              </button>
            )}
            <span className="text-2xs text-muted">
              {analysis?.comparison?.healthy_reference_available
                ? t("Compared with the crop healthy reference")
                : t("No healthy reference available for this crop")}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function PlantImagesPanel({ field }: { field: Field }) {
  const { t } = useI18n();
  const [data, setData] = useState<FieldImages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [note, setNote] = useState("");
  const [refLabel, setRefLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.fieldImages(field.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Plant images could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [field.id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadPhoto(file: File) {
    setBusy(true);
    setError(null);
    try {
      const image_base64 = await fileToBase64(file);
      await api.uploadRobotImage(
        field.id,
        {
          image_base64,
          content_type: file.type || "image/jpeg",
          growth_stage: stage || undefined,
          note: note.trim() || undefined,
        },
        true,
      );
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("The photo could not be uploaded."));
    } finally {
      setBusy(false);
    }
  }

  async function uploadReference(file: File) {
    if (!refLabel.trim()) {
      setError(t("Give the healthy reference a label first."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.uploadReference({
        crop_id: field.crop_id,
        label: refLabel.trim(),
        image_base64: await fileToBase64(file),
        content_type: file.type || "image/jpeg",
        source_note: "Uploaded from the field robot page",
      });
      setRefLabel("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("The healthy reference could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function reanalyze(imageId: number) {
    setBusy(true);
    setError(null);
    try {
      await api.analyzeRobotImage(imageId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("The AI review could not be run."));
    } finally {
      setBusy(false);
    }
  }

  const references = data?.references ?? [];
  const images = data?.images ?? [];

  return (
    <section className="card card-pad" aria-labelledby="robot-images-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="robot-images-heading" className="flex items-center gap-1.5 text-sm font-semibold">
            <LeafIcon size={15} />
            {t("Robot camera and plant health")}
          </h2>
          <p className="mt-0.5 max-w-2xl text-2xs leading-relaxed text-muted">
            {t(
              "Robot Camera → Upload → Backend → AI vision review → Comparison with the crop healthy reference and the previous photo → stored result. The review is advisory and always shows a confidence value; it is not a confirmed diagnosis.",
            )}
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
          <RefreshIcon size={13} />
          {t("Refresh")}
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 rounded-md border border-line bg-sage-50 p-2.5 text-2xs text-clay-600">
          <AlertIcon size={13} />
          {error}
        </p>
      )}

      {loading && <p className="mt-3 text-xs text-muted">{t("Loading plant images…")}</p>}

      {!loading && (
        <>
          <div className="mt-4 rounded-md border border-line bg-sage-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-ink">{t("Healthy reference for {crop}", { crop: t(field.crop_name) })}</p>
                <p className="mt-0.5 text-2xs text-muted">
                  {references.length > 0
                    ? t("{count} reference image(s) stored on the server", { count: references.length })
                    : t("No healthy reference is stored for this crop yet. Without one, the review compares only with the previous photo.")}
                </p>
              </div>
            </div>
            {references.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {references.map((reference) => (
                  <a
                    key={reference.id}
                    href={reference.file_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-2 rounded-md border border-line bg-white p-1.5 pe-2.5"
                  >
                    <img src={reference.file_url} alt={reference.label} className="h-10 w-10 rounded object-cover" />
                    <span className="text-2xs text-ink">{reference.label}</span>
                  </a>
                ))}
              </div>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-2xs font-semibold text-forest-700 hover:underline">
                {t("Add a healthy reference image")}
              </summary>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <input
                  value={refLabel}
                  onChange={(event) => setRefLabel(event.target.value)}
                  placeholder={t("Reference label")}
                  maxLength={120}
                  className="input max-w-[220px] py-1.5 text-xs"
                />
                <label className="btn-secondary btn-sm cursor-pointer">
                  {busy ? t("Saving…") : t("Choose image")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadReference(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </details>
          </div>

          <div className="mt-4 rounded-md border border-dashed border-line bg-card p-3">
            <p className="text-xs font-semibold text-ink">{t("Upload a plant photo")}</p>
            <p className="mt-0.5 text-2xs leading-relaxed text-muted">
              {t(
                "The file is sent to the backend and stored with its capture time, crop, stage and location. No image is generated or modified.",
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-2xs text-muted">
                {t("Growth stage")}
                <select
                  value={stage}
                  onChange={(event) => setStage(event.target.value)}
                  className="input mt-0.5 block py-1.5 text-xs"
                >
                  <option value="">{t("Not specified")}</option>
                  {PLANT_STAGES.map((item) => (
                    <option key={item} value={item}>
                      {t(titleCase(item))}
                    </option>
                  ))}
                </select>
              </label>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("Optional note")}
                maxLength={255}
                className="input max-w-[240px] py-1.5 text-xs"
              />
              <label className="btn-primary btn-sm cursor-pointer">
                {busy ? t("Uploading…") : t("Upload and review")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPhoto(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {images.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-line bg-sage-50 p-3 text-2xs leading-relaxed text-muted">
              {t("No robot plant photos yet. Historical photos and their reviews will appear here.")}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 className="text-xs font-semibold text-ink">{t("Photo history and reviews")}</h3>
                <span className="text-2xs text-muted">
                  {t("{count} image(s) · newest first", { count: images.length })}
                </span>
              </div>
              {images.map((image) => (
                <RobotImageCard key={image.id} image={image} onAnalyze={reanalyze} busy={busy} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SatelliteComparison({ field }: { field: Field }) {
  const { t } = useI18n();
  const { mode } = useDataMode();
  const [satellite, setSatellite] = useState<SatelliteAnalysis | null>(null);
  const [satError, setSatError] = useState<string | null>(null);
  const [satLoading, setSatLoading] = useState(true);
  const irrigation = useAsync(
    (signal) => api.irrigation(field.id, { mode, signal }),
    [field.id, mode],
  );

  const loadSatellite = useCallback(async () => {
    setSatLoading(true);
    setSatError(null);
    try {
      const data = await api.satelliteField(field.id, {});
      setSatellite(data);
    } catch (err) {
      setSatError(err instanceof Error ? err.message : t("Satellite indices are unavailable."));
    } finally {
      setSatLoading(false);
    }
  }, [field.id, t]);

  useEffect(() => {
    void loadSatellite();
  }, [loadSatellite]);

  const vegetation = satellite?.vegetation;
  const soilSignal = satellite?.soil_moisture;
  const balance = irrigation.data?.balance;

  return (
    <section className="card card-pad" aria-labelledby="robot-context-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="robot-context-heading" className="text-sm font-semibold">
            {t("Satellite and model next to the robot")}
          </h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-muted">
            {t(
              "Different instruments, different footprints. Shown together so disagreement is visible, not averaged away.",
            )}
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={() => void loadSatellite()} disabled={satLoading}>
          <RefreshIcon size={13} />
          {satLoading ? t("Loading…") : t("Reload satellite")}
        </button>
      </div>

      {satError && (
        <p className="mt-3 flex items-start gap-1.5 rounded-md border border-line bg-sage-50 p-2.5 text-2xs leading-relaxed text-muted">
          <AlertIcon size={13} />
          {satError}{" "}
          <Link to={`/satellite/${field.id}`} className="link-underline">
            {t("Open the satellite page")}
          </Link>
        </p>
      )}

      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-line bg-sage-50/60 p-3">
          <dt className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
            <SatelliteIcon size={13} /> {t("Vegetation")}
          </dt>
          <dd className="mt-1.5 text-sm text-ink">
            {vegetation?.available && vegetation.ndvi != null ? (
              <>
                NDVI <span className="font-mono">{formatNumber(vegetation.ndvi, 2)}</span>
                {vegetation.ndmi != null && (
                  <>
                    {" · "}NDMI <span className="font-mono">{formatNumber(vegetation.ndmi, 2)}</span>
                  </>
                )}
              </>
            ) : (
              t("Not available")
            )}
          </dd>
          <dd className="mt-1 text-2xs leading-relaxed text-muted">
            {vegetation?.acquisition_date
              ? t("Latest pass {date}", { date: vegetation.acquisition_date })
              : vegetation?.reason
                ? t(vegetation.reason)
                : t("Satellite-derived · 10 m pixels")}
          </dd>
        </div>

        <div className="rounded-md border border-line bg-sage-50/60 p-3">
          <dt className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
            <DatabaseIcon size={13} /> {t("Root-zone water balance")}
          </dt>
          <dd className="mt-1.5 text-sm text-ink">
            {balance?.depletion_mm != null ? (
              <>
                <span className="font-mono">{formatNumber(balance.depletion_mm, 0)}</span> mm
                {balance.taw_mm != null && (
                  <span className="text-muted">
                    {" "}
                    / {formatNumber(balance.taw_mm, 0)} mm TAW
                  </span>
                )}
              </>
            ) : irrigation.status === "loading" ? (
              t("Loading…")
            ) : (
              t("Not available")
            )}
          </dd>
          <dd className="mt-1 text-2xs leading-relaxed text-muted">
            {irrigation.data
              ? t("Model · weather grid · not a probe reading")
              : t("Model · root-zone water balance")}
          </dd>
        </div>

        <div className="rounded-md border border-line bg-sage-50/60 p-3">
          <dt className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
            <DropIcon size={13} /> {t("Radar backscatter")}
          </dt>
          <dd className="mt-1.5 text-sm text-ink">
            {soilSignal?.available && soilSignal.relative_percent != null ? (
              <>
                <span className="font-mono">{formatNumber(soilSignal.relative_percent, 0)}</span>
                <span className="text-muted"> / 100</span>
              </>
            ) : (
              t("Not available")
            )}
          </dd>
          <dd className="mt-1 text-2xs leading-relaxed text-muted">
            {t("Relative wetness from Sentinel-1 · not volumetric moisture")}
          </dd>
        </div>
      </dl>

      <InfoNote tone="neutral" title={t("Read the three columns carefully")}>
        {t(
          "A soil probe reads one point at one depth. Sentinel-1 sees a radar surface signal over the field. The water balance estimates root-zone depletion from a weather grid. They answer different questions and may disagree; this page does not calibrate one from another or claim an accuracy gain.",
        )}
      </InfoNote>
    </section>
  );
}

function RobotWorkspace({ field }: { field: Field }) {
  const { t } = useI18n();
  const devices = useAsync((signal) => api.listDevices(field.id, signal), [field.id]);

  return (
    <div className="space-y-5">
      <InfoNote tone="neutral" title={t("What this page is for")}>
        {t(
          "Pair an ESP32 robot to this field, let it post soil-moisture, DHT22 and ultrasonic readings, and read them beside the satellite and water-balance numbers. Sensor values are stored exactly as sent; nothing is smoothed or invented.",
        )}
      </InfoNote>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {devices.status === "success" && (
            <LiveFeed field={field} devices={devices.data ?? []} reloadDevices={devices.reload} />
          )}
          <PlantImagesPanel field={field} />
          {devices.status === "loading" && (
            <p className="card card-pad text-xs text-muted">{t("Loading devices…")}</p>
          )}
          {devices.status === "error" && devices.error && (
            <p className="card card-pad text-xs text-clay-600">{devices.error.message}</p>
          )}
          <SatelliteComparison field={field} />
        </div>
        <PairingSidebar field={field} onDeviceChange={devices.reload} />
      </div>
    </div>
  );
}

export function RobotPage() {
  const { fieldId } = useParams();
  const parsed = Number.parseInt(fieldId ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return (
      <div className="container-page py-10">
        <p className="text-sm text-muted">
          Choose a field before opening its robot page.
        </p>
        <Link to="/fields" className="btn-secondary btn-sm mt-3">
          Go to My Fields
        </Link>
      </div>
    );
  }
  return (
    <FieldLayout fieldId={parsed} activeTab="robot">
      {(field) => <RobotWorkspace field={field} />}
    </FieldLayout>
  );
}