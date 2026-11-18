import { useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { addDaysIso, daysBetween, formatDate, todayIso } from "../../lib/format";
import {
  PERIOD_KEYS,
  PERIOD_LABELS,
  resolvePeriod,
  type DatePeriod,
  type PeriodKey,
} from "../../lib/period";

const QUICK_KEYS = PERIOD_KEYS.filter((key) => key !== "custom");
const MAX_DAYS = 366;

/**
 * Date / time-period control for a field dashboard.
 *
 * The resolved dates are sent to the API by the parent; nothing is filtered in
 * the browser. Quick options resolve against the field's planting date for
 * "This season" and against yesterday for rolling windows, because reanalysis
 * products publish with a lag.
 */
export function PeriodSelector({
  period,
  onChange,
  plantingDate = null,
  disabled = false,
}: {
  period: DatePeriod;
  onChange: (period: DatePeriod) => void;
  plantingDate?: string | null;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const today = todayIso();
  const [customStart, setCustomStart] = useState(period.start);
  const [customEnd, setCustomEnd] = useState(period.end);
  const [capped, setCapped] = useState(false);

  const emitCustom = (start: string, end: string) => {
    let nextStart = start;
    let nextEnd = end;
    if (nextStart > nextEnd) {
      nextStart = nextEnd;
    }
    const isCapped = daysBetween(nextStart, nextEnd) + 1 > MAX_DAYS;
    if (isCapped) nextStart = addDaysIso(nextEnd, -(MAX_DAYS - 1));
    setCapped(isCapped);
    setCustomStart(nextStart);
    setCustomEnd(nextEnd);
    onChange({ key: "custom", start: nextStart, end: nextEnd });
  };

  const choose = (key: PeriodKey) => {
    if (key === "custom") {
      emitCustom(customStart, customEnd);
      return;
    }
    setCapped(false);
    onChange(resolvePeriod(key, { plantingDate }));
  };

  return (
    <div className="card p-4" aria-label={t("Date / time period")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="field-label">{t("Date / time period")}</p>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t("Quick periods")}
          >
            {QUICK_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => choose(key)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  period.key === key
                    ? "border-forest-800 bg-forest-800 text-paper"
                    : "border-line bg-card text-muted hover:border-forest-300 hover:text-ink"
                }`}
                aria-pressed={period.key === key}
                disabled={disabled}
              >
                {t(PERIOD_LABELS[key])}
              </button>
            ))}
            <button
              type="button"
              onClick={() => choose("custom")}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                period.key === "custom"
                  ? "border-forest-800 bg-forest-800 text-paper"
                  : "border-line bg-card text-muted hover:border-forest-300 hover:text-ink"
              }`}
              aria-pressed={period.key === "custom"}
              disabled={disabled}
            >
              {t(PERIOD_LABELS.custom)}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {period.key === "custom" && (
            <>
              <div>
                <label htmlFor="period-start" className="field-label">
                  {t("From")}
                </label>
                <input
                  id="period-start"
                  type="date"
                  className="input py-1.5 text-xs"
                  value={customStart}
                  min="1981-01-01"
                  max={customEnd}
                  disabled={disabled}
                  onChange={(event) => emitCustom(event.target.value, customEnd)}
                />
              </div>
              <div>
                <label htmlFor="period-end" className="field-label">
                  {t("To")}
                </label>
                <input
                  id="period-end"
                  type="date"
                  className="input py-1.5 text-xs"
                  value={customEnd}
                  min={customStart}
                  max={today}
                  disabled={disabled}
                  onChange={(event) => emitCustom(customStart, event.target.value)}
                />
              </div>
            </>
          )}
          <p className="font-mono text-2xs text-muted" dir="ltr">
            {formatDate(period.start)} → {formatDate(period.end)}
          </p>
        </div>
      </div>

      {capped && (
        <p className="mt-2 text-2xs leading-relaxed text-clay-700">
          {t(
            "NASA POWER requests are capped at 366 days; the start date was moved forward to fit.",
          )}
        </p>
      )}
      <p className="mt-2 text-2xs leading-relaxed text-muted">
        {t(
          "Rolling periods end yesterday because NASA POWER publishes with a delay. The selected dates are sent to the API; the charts show only the data actually returned.",
        )}
      </p>
    </div>
  );
}
