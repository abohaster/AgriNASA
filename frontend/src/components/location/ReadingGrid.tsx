import type { DataSourceRef, LocationReading } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { formatNumber } from "../../lib/format";
import { MetricCard } from "../ui/MetricCard";
import { StatusPill } from "../ui/StatusPill";

function formatValue(reading: LocationReading): string | null {
  if (reading.value === null || reading.value === undefined || reading.status === "unavailable") {
    return null;
  }
  if (typeof reading.value === "number") {
    const decimals = Math.abs(reading.value) >= 100 ? 0 : Math.abs(reading.value) >= 10 ? 1 : 2;
    return formatNumber(reading.value, decimals);
  }
  return reading.value;
}

function confidenceTone(confidence: LocationReading["confidence"]) {
  if (confidence === "high") return "good" as const;
  if (confidence === "low") return "warn" as const;
  return "neutral" as const;
}

/**
 * Value tiles for the location pages. Each tile repeats its unit, period,
 * source and confidence, so a number is never shown without provenance.
 */
export function ReadingGrid({
  readings,
  sources,
  columns = 4,
}: {
  readings: LocationReading[];
  sources: DataSourceRef[];
  columns?: 3 | 4;
}) {
  const { t } = useI18n();
  const sourceName = (id: string) => sources.find((source) => source.id === id)?.name ?? id;

  return (
    <div
      className={`grid gap-3 sm:grid-cols-2 ${columns === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
    >
      {readings.map((reading) => {
        const hints = [
          reading.period ? t("Period: {value}", { value: reading.period }) : null,
          reading.observed_at ? t("Observed: {value}", { value: reading.observed_at }) : null,
          reading.note ? t(reading.note) : null,
        ].filter(Boolean);
        return (
          <MetricCard
            key={reading.key}
            label={reading.label}
            value={formatValue(reading)}
            unit={reading.unit ?? undefined}
            hint={hints.join(" · ")}
            badge={
              reading.status === "available" ? (
                <StatusPill tone={confidenceTone(reading.confidence)} dot={false}>
                  {t("Confidence: {value}", { value: t(reading.confidence) })}
                </StatusPill>
              ) : (
                <StatusPill tone="warn">{t("Not available")}</StatusPill>
              )
            }
            footer={
              <span className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">
                {t("Source")}: {sourceName(reading.source_id)}
              </span>
            }
          />
        );
      })}
    </div>
  );
}
