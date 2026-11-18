import { useDataMode } from "../../context/DataModeContext";
import { useI18n } from "../../i18n/I18nContext";
import { InfoIcon } from "../ui/Icons";

/**
 * Persistent demo notice. It is rendered above every page whenever demo mode is
 * on, so a sample/cached value can never be mistaken for the user's live field.
 */
export function DemoBanner() {
  const { isDemo, setMode } = useDataMode();
  const { t } = useI18n();
  if (!isDemo) return null;

  return (
    <div role="status" className="border-b border-clay-200 bg-clay-50">
      <div className="container-page flex flex-col gap-2 py-2.5 text-xs text-clay-600 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 leading-relaxed">
          <span className="mt-0.5 shrink-0">
            <InfoIcon size={14} />
          </span>
          <span>
            <strong className="font-semibold">{t("DEMO DATA")}</strong>{" "}
            {t(
              "— every value on this page replays a fixed, cached NASA POWER snapshot (Qena, Egypt · 2025 season) instead of your field's live data. Units and calculations are real; the location and dates are not yours.",
            )}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setMode("live")}
          className="shrink-0 self-start rounded border border-clay-200 bg-card px-2 py-1 font-medium hover:border-clay-400 sm:self-auto"
        >
          {t("Switch to live data")}
        </button>
      </div>
    </div>
  );
}
