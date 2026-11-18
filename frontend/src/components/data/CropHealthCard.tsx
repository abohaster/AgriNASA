import { Link } from "react-router-dom";
import type { CropHealthAnalysis } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { formatDate, formatNumber } from "../../lib/format";
import { HEALTH_META, INDICATOR_TONE } from "../../lib/labels";
import { ArrowRightIcon, LeafIcon } from "../ui/Icons";
import { StatusPill } from "../ui/StatusPill";

/**
 * Crop-health summary.
 *
 * The module reports environmental stress indicators, not disease. The card
 * repeats that boundary so a "stressed" label is never read as a diagnosis.
 */
export function CropHealthCard({
  analysis,
  fieldId,
  compact = false,
}: {
  analysis: CropHealthAnalysis;
  fieldId: number;
  compact?: boolean;
}) {
  const { t, isRtl } = useI18n();
  const meta = HEALTH_META[analysis.status];
  const seasonComplete = analysis.season_complete;
  const visibleIndicators = compact ? analysis.indicators.slice(0, 3) : analysis.indicators;
  const healthHeading = isRtl ? t(meta.label) : meta.label.toUpperCase();
  const agreement = analysis.indicator_agreement;

  return (
    <section className="card overflow-hidden" aria-label={t("Crop health analysis")}>
      <div className="flex flex-col gap-3 border-b border-line bg-sage-50 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-card text-forest-700 ring-1 ring-line">
            <LeafIcon size={18} />
          </span>
          <div>
            <p className="eyebrow">{t("Crop health")}</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.02em]">
              {seasonComplete ? t("SEASON COMPLETE") : healthHeading}
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
              {seasonComplete
                ? t("The crop season has ended. Crop health is not assessed after harvest.")
                : t(meta.description)}
            </p>
            <p className="mt-1 text-2xs text-muted">
              {t("Analysis as of {date}", { date: formatDate(analysis.computed_for) })}
            </p>
          </div>
        </div>
        <StatusPill tone={seasonComplete ? "neutral" : meta.tone}>
          {seasonComplete ? t("Season complete") : t(meta.label)}
        </StatusPill>
      </div>

      <div className="space-y-4 p-5">
        <p className="text-sm leading-relaxed text-ink/90">{t(analysis.summary)}</p>

        {agreement && agreement.percent !== null && !seasonComplete && (
          <div className="rounded-md border border-line bg-card px-3.5 py-3">
            <p className="field-label">{t("Indicator agreement")}</p>
            <p className="mono-data mt-1 text-lg font-semibold text-ink">
              {formatNumber(agreement.percent, 0)}%
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-muted">
              {t("Not at stress level: {clean} of {known} available indicators.", {
                clean: agreement.known - agreement.stressed,
                known: agreement.known,
              })}
            </p>
            {!compact && (
              <p className="mt-1 text-2xs leading-relaxed text-muted">
                {t(agreement.definition)}
              </p>
            )}
          </div>
        )}

        {!seasonComplete && (
          <div>
            <p className="field-label">{t("Indicators")}</p>
            <ul className="divide-y divide-line rounded-md border border-line">
              {visibleIndicators.map((indicator) => (
                <li
                  key={indicator.id}
                  className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink">{t(indicator.label)}</p>
                    <p className="mt-0.5 text-2xs leading-relaxed text-muted">
                      {t(indicator.interpretation)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {indicator.value !== null && (
                      <span className="mono-data text-xs text-muted">
                        {typeof indicator.value === "number"
                          ? formatNumber(indicator.value, 1)
                          : t(String(indicator.value))}
                        {indicator.unit ? ` ${indicator.unit}` : ""}
                      </span>
                    )}
                    <StatusPill tone={INDICATOR_TONE[indicator.status]} dot={false}>
                      {indicator.status === "unknown" ? t("No data") : t(indicator.status)}
                    </StatusPill>
                  </div>
                </li>
              ))}
            </ul>
            {compact && analysis.indicators.length > visibleIndicators.length && (
              <p className="mt-2 text-2xs text-muted">
                {t("+{n} more indicators on the health page.", {
                  n: analysis.indicators.length - visibleIndicators.length,
                })}
              </p>
            )}
          </div>
        )}

        <div className="rounded-md border border-line bg-sage-50 px-3.5 py-3 text-xs">
          <p className="font-medium text-ink">{t("Vegetation index (NDVI)")}</p>
          {analysis.vegetation.available && analysis.vegetation.ndvi !== null ? (
            <p className="mt-0.5 text-muted">
              <span className="mono-data font-semibold text-ink">
                {formatNumber(analysis.vegetation.ndvi, 2)}
              </span>{" "}
              · {t(analysis.vegetation.trend)}
              {analysis.vegetation.latest_date
                ? ` · ${formatDate(analysis.vegetation.latest_date)}`
                : ""}
            </p>
          ) : (
            <p className="mt-0.5 leading-relaxed text-muted">{t(analysis.vegetation.note)}</p>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-sm text-2xs leading-relaxed text-muted">
            {t(
              "Environmental stress indicators only — this is not a disease, pest or nutrient diagnosis.",
            )}
          </p>
          <Link to={`/health/${fieldId}`} className="btn-secondary btn-sm self-start sm:self-auto">
            {t("Full health analysis")}
            <ArrowRightIcon size={14} className="rtl:-scale-x-100" />
          </Link>
        </div>
      </div>
    </section>
  );
}
