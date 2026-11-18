import type { TrendInfo } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { formatNumber } from "../../lib/format";
import { TrendDownIcon, TrendUpIcon } from "../ui/Icons";

/**
 * Seven-day change indicator used on environmental cards.
 *
 * `change` is computed by the backend by comparing the last seven days with the
 * previous seven. When there are too few points the backend says "unknown" and
 * this component shows a neutral dash instead of guessing a trend.
 */
export function TrendArrow({
  trend,
  className = "",
}: {
  trend: TrendInfo | undefined;
  className?: string;
}) {
  const { t } = useI18n();

  if (!trend || trend.direction === "unknown" || trend.change === null) {
    return (
      <span className={`inline-flex items-center gap-1 text-2xs text-muted ${className}`}>
        {t("Trend unavailable")}
      </span>
    );
  }

  const isUp = trend.direction === "up";
  const isDown = trend.direction === "down";
  const Icon = isDown ? TrendDownIcon : TrendUpIcon;
  const sign = trend.change > 0 ? "+" : "";

  return (
    <span
      className={`inline-flex items-center gap-1 text-2xs font-medium ${
        isUp ? "text-clay-600" : isDown ? "text-survey-700" : "text-muted"
      } ${className}`}
      title={t("Change over the last {n} days", { n: trend.window_days })}
    >
      <Icon size={12} />
      {sign}
      {formatNumber(trend.change, trend.unit === "%" ? 0 : 1)} {trend.unit}
      <span className="font-normal text-muted">{t("/ {n} d", { n: trend.window_days })}</span>
    </span>
  );
}
