import { useI18n } from "../../i18n/I18nContext";
import { addDaysIso, todayIso } from "../../lib/format";

/**
 * End date for season-to-date analyses (irrigation balance, stress screening).
 * The backend computes from planting through the chosen date; an empty value
 * means "most recent available day", which respects the provider publishing lag.
 */
export function AnalysisDateField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const { t } = useI18n();
  const latest = addDaysIso(todayIso(), -1);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-line bg-card px-3 py-2">
      <label className="flex items-center gap-2 text-xs">
        <span className="font-medium text-muted">{t("Analysis date")}</span>
        <input
          type="date"
          value={value ?? ""}
          max={latest}
          onChange={(event) => onChange(event.target.value || null)}
          className="input h-8 w-[9.5rem] px-2 text-xs"
        />
      </label>
      {value && (
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => onChange(null)}
        >
          {t("Most recent available day")}
        </button>
      )}
      <span className="text-2xs text-muted">{t("Season-to-date analysis")}</span>
    </div>
  );
}
