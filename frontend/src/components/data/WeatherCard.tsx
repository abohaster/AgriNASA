import type { ReactNode } from "react";
import type { DataSourceRef, TrendInfo } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { formatDate, formatNumber } from "../../lib/format";
import { MetricCard } from "../ui/MetricCard";
import { TrendArrow } from "./TrendArrow";

/**
 * Environmental metric tile.
 *
 * Always shows the value's own date and dataset name: a temperature from a
 * three-day-old POWER grid is not the same as a live on-farm sensor reading.
 * Missing values fall through to MetricCard's explicit "Data unavailable" state.
 */
export function WeatherCard({
  label,
  value,
  unit,
  icon,
  date,
  trend,
  source,
  hint,
  decimals = 1,
  isDemo = false,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  icon?: ReactNode;
  date?: string | null;
  trend?: TrendInfo;
  source?: DataSourceRef;
  hint?: string;
  decimals?: number;
  isDemo?: boolean;
}) {
  const { t } = useI18n();

  return (
    <MetricCard
      label={label}
      value={value === null || value === undefined ? null : formatNumber(value, decimals)}
      unit={t(unit)}
      icon={icon}
      hint={hint}
      footer={
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
          <span className="font-mono text-2xs text-muted">
            {source?.name ?? "NASA POWER"}
            {date ? ` · ${formatDate(date)}` : ""}
            {isDemo ? ` · ${t("DEMO")}` : ""}
          </span>
          {trend && <TrendArrow trend={trend} />}
        </div>
      }
    />
  );
}
