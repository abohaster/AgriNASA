import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { DataSourceRef } from "../api/types";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/AsyncState";
import { DataSourceBadge } from "../components/ui/DataSourceBadge";
import {
  ArrowRightIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  LeafIcon,
  SatelliteIcon,
  SoilIcon,
  SunIcon,
} from "../components/ui/Icons";
import { InfoNote } from "../components/ui/InfoNote";
import { SectionHeading } from "../components/ui/SectionHeading";
import { StatusPill, type Tone } from "../components/ui/StatusPill";
import {
  RELIABILITY_BY_SOURCE,
  RELIABILITY_DEFINITIONS,
  RELIABILITY_LABELS,
  SOURCE_CONTENT,
  type DataSourceContent,
  type Reliability,
} from "../data/dataSources";
import { useAsync } from "../hooks/useAsync";
import { useI18n } from "../i18n/I18nContext";

const RELIABILITY_TONE: Record<Reliability, Tone> = {
  measured: "good",
  satellite: "info",
  modeled: "warn",
  forecast: "neutral",
};

const RELIABILITY_ORDER: Reliability[] = ["measured", "satellite", "modeled", "forecast"];

function sourceIcon(id: string) {
  if (id.startsWith("gee-") || id === "nasa-gibs") return <SatelliteIcon size={18} />;
  if (id === "soilgrids") return <SoilIcon size={18} />;
  if (id.startsWith("open-meteo") || id.startsWith("nasa-power")) return <SunIcon size={18} />;
  if (id.startsWith("crop") || id.startsWith("derived")) return <LeafIcon size={18} />;
  return <DatabaseIcon size={18} />;
}

function Benefit({
  audience,
  text,
}: {
  audience: string;
  text: string;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-md border border-line bg-sage-50/60 p-3">
      <p className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">{t(audience)}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink">{t(text)}</p>
    </div>
  );
}

function DatasetCard({
  source,
  content,
  index,
}: {
  source: DataSourceRef;
  content: DataSourceContent;
  index: number;
}) {
  const { t, tm } = useI18n();
  const reliability = RELIABILITY_BY_SOURCE[content.id];
  const enabled = content.enabled !== false;

  return (
    <article
      id={`source-${content.id}`}
      className={`card scroll-mt-24 p-5 ${enabled ? "" : "opacity-75"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sage-100 text-forest-700">
            {sourceIcon(content.id)}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-2xs uppercase tracking-[0.1em] text-muted">
              {t("Dataset")} {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-0.5 text-base font-semibold">{source.name}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{t(content.whatItIs)}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {!enabled && (
            <StatusPill tone="neutral" dot={false}>
              {t("Not enabled")}
            </StatusPill>
          )}
          {enabled && (
            <StatusPill tone={RELIABILITY_TONE[reliability]} dot={false}>
              {t(RELIABILITY_LABELS[reliability])}
            </StatusPill>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 border-y border-line py-3 sm:grid-cols-3">
        <div>
          <dt className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">{t("Coverage")}</dt>
          <dd className="mt-1 text-xs leading-relaxed text-ink">{t(content.coverage)}</dd>
        </div>
        <div>
          <dt className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">{t("Resolution")}</dt>
          <dd className="mt-1 text-xs leading-relaxed text-ink">
            {source.resolution ? tm(source.resolution) : t("Not applicable")}
          </dd>
        </div>
        <div>
          <dt className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">{t("Attribution")}</dt>
          <dd className="mt-1 text-xs leading-relaxed text-ink">{source.attribution}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
          {t("What you see in the app")}
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {content.variables.map((variable) => (
            <li
              key={variable}
              className="rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink"
            >
              {t(variable)}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
          {t("Who benefits")}
        </p>
        <div className="mt-2 grid gap-2.5 md:grid-cols-3">
          <Benefit audience="Small farmer" text={content.simpleFarmer} />
          <Benefit audience="Farm owner / large farmer" text={content.farmManager} />
          <Benefit audience="Agricultural engineer" text={content.agronomist} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <DataSourceBadge source={source} compact />
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:underline"
          >
            {t("Open the dataset page")}
            <ExternalLinkIcon size={12} />
          </a>
        ) : (
          <span className="text-xs text-muted">{t("Reference tables run by the AgriNASA backend")}</span>
        )}
      </div>
    </article>
  );
}

export function DataSourcesPage() {
  const { t } = useI18n();
  const catalogue = useAsync(() => api.dataSources(), []);

  const byId = new Map<string, DataSourceRef>(
    (catalogue.data?.sources ?? []).map((source) => [source.id, source]),
  );
  const cards = SOURCE_CONTENT.filter((content) => byId.has(content.id));
  const enabledCount = cards.filter((content) => content.enabled !== false).length;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={t("Data provenance")}        title={t("Data Sources")}
        description={t(
          "Every dataset AgriNASA actually reads, what it means in plain words, and who it helps. A dataset appears here only when the backend can fetch it.",
        )}
        actions={
          <Link to="/guide" className="btn-secondary btn-sm">
            {t("Read the setup notes")}
            <ArrowRightIcon size={14} />
          </Link>
        }
      />

      {catalogue.status === "loading" && <LoadingState label="Loading the dataset catalogue…" variant="list" rows={4} />}

      {catalogue.status === "error" && (
        <ErrorState
          title="The dataset catalogue could not be loaded"
          message={catalogue.error?.message ?? "The server did not return its source catalogue."}
          onRetry={catalogue.reload}
        />
      )}

      {catalogue.status === "success" && cards.length === 0 && (
        <EmptyState
          title="No datasets are connected"
          description="The server reported an empty source catalogue, so no dataset claims are shown."
        />
      )}

      {catalogue.status === "success" && cards.length > 0 && (
        <>
          <InfoNote title={t("Only connected datasets are listed")}>
            {t(
              "This page is generated from the server's source catalogue. If a provider is not configured or is not used by the code, it is not presented as a working data source.",
            )}{" "}
            {t("Data mode")}: <span className="font-mono">{catalogue.data?.mode}</span>
          </InfoNote>

          <section aria-labelledby="reliability-heading" className="space-y-3">
            <h2 id="reliability-heading" className="text-lg tracking-[-0.02em]">
              {t("How to read a reliability badge")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {RELIABILITY_ORDER.map((reliability) => (
                <div key={reliability} className="card p-4">
                  <StatusPill tone={RELIABILITY_TONE[reliability]} dot={false}>
                    {t(RELIABILITY_LABELS[reliability])}
                  </StatusPill>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {t(RELIABILITY_DEFINITIONS[reliability])}
                  </p>
                </div>
              ))}
            </div>
            <InfoNote tone="warn" title={t("No measured source is connected yet")}>
              {t(
                "AgriNASA does not currently connect to on-farm sensors or a weather-station feed, so no dataset on this page is classified as measured. Field-level values come from reanalysis, satellites, models or forecasts, and each one says so.",
              )}
            </InfoNote>
          </section>

          <section aria-labelledby="catalogue-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="catalogue-heading" className="text-lg tracking-[-0.02em]">
                {t("Dataset catalogue")}
              </h2>
              <p className="text-xs text-muted">
                {enabledCount} {t("datasets served by the backend")}
              </p>
            </div>
            {cards.map((content, index) => {
              const source = byId.get(content.id);
              if (!source) return null;
              return <DatasetCard key={content.id} source={source} content={content} index={index} />;
            })}
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <InfoNote title={t("When data is missing")}>
              {t(
                "If a provider fails, a range predates its coverage, or an API key is not configured, the app shows the gap and states that data is unavailable. It never fills the gap with simulated values.",
              )}
            </InfoNote>
            <InfoNote title={t("Credentials stay on the server")} tone="neutral">
              {t(
                "Datasets that need credentials (Google Earth Engine and the optional WaPOR token) are configured through backend environment variables. Keys are never shipped to the browser.",
              )}
            </InfoNote>
          </section>
        </>
      )}
    </div>
  );
}
