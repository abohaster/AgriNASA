import { Link } from "react-router-dom";
import type { IrrigationAnalysis } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { formatDate, formatNumber } from "../../lib/format";
import { DEMAND_META } from "../../lib/labels";
import { ConfidenceBadge } from "../ui/ConfidenceBadge";
import { DataSourceBadge } from "../ui/DataSourceBadge";
import { ArrowRightIcon, DropIcon, InfoIcon } from "../ui/Icons";
import { InfoNote } from "../ui/InfoNote";
import { StatusPill } from "../ui/StatusPill";

/**
 * Irrigation summary card.
 *
 * The demand class, reasons and refill estimate all come from the deterministic
 * FAO-56 model. When the model reports `insufficient_data`, this card refuses to
 * show a class and explains what is missing instead.
 */
export function IrrigationCard({
  analysis,
  fieldId,
  showSource = true,
}: {
  analysis: IrrigationAnalysis;
  fieldId: number;
  showSource?: boolean;
}) {
  const { t, isRtl } = useI18n();
  const meta = DEMAND_META[analysis.demand];
  const seasonComplete = analysis.season_complete;
  const insufficient = analysis.status !== "ok";
  const demandHeading = isRtl ? t(meta.label) : meta.label.toUpperCase();
  const heading = seasonComplete
    ? t("SEASON COMPLETE")
    : insufficient
      ? t("INSUFFICIENT DATA")
      : demandHeading;

  return (
    <section className="card overflow-hidden" aria-label={t("Irrigation analysis")}>
      <div className="flex flex-col gap-3 border-b border-line bg-sage-50 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-card text-forest-700 ring-1 ring-line">
            <DropIcon size={18} />
          </span>
          <div>
            <p className="eyebrow">{t("Irrigation demand")}</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{heading}</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
              {seasonComplete
                ? t(
                    "The crop season has ended. No irrigation demand is assessed after harvest.",
                  )
                : insufficient
                  ? t("No demand class is shown because the required inputs are incomplete.")
                  : t(meta.description)}
            </p>
            <p className="mt-1 text-2xs text-muted">
              {t("Analysis as of {date}", { date: formatDate(analysis.computed_for) })}
            </p>
          </div>
        </div>
        {seasonComplete ? (
          <StatusPill tone="neutral">{t("Season complete")}</StatusPill>
        ) : (
          !insufficient && <StatusPill tone={meta.tone}>{t(meta.label)}</StatusPill>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="field-label">{seasonComplete ? t("Season status") : t("Why this class?")}</p>
          <ul className="space-y-1.5">
            {analysis.demand_reasons.map((reason) => (
              <li key={reason} className="flex gap-2 text-sm leading-relaxed text-ink/90">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-forest-500" aria-hidden="true" />
                <span>{t(reason)}</span>
              </li>
            ))}
          </ul>
        </div>

        {!insufficient && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">{t("ET₀ (latest)")}</dt>
              <dd className="mono-data mt-0.5 text-sm font-semibold">
                {formatNumber(analysis.et0_mm_day, 2)}{" "}
                <span className="font-normal text-muted">{t("mm/day")}</span>
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Kc</dt>
              <dd className="mono-data mt-0.5 text-sm font-semibold">
                {analysis.kc !== null ? formatNumber(analysis.kc, 2) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">ETc</dt>
              <dd className="mono-data mt-0.5 text-sm font-semibold">
                {formatNumber(analysis.etc_mm_day, 2)}{" "}
                <span className="font-normal text-muted">{t("mm/day")}</span>
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">
                {t("Root-zone depletion")}
              </dt>
              <dd className="mono-data mt-0.5 text-sm font-semibold">
                {analysis.balance.depletion_fraction !== null
                  ? `${formatNumber(analysis.balance.depletion_fraction * 100, 0)}%`
                  : "—"}
                <span className="ms-1 font-normal text-muted">{t("of TAW")}</span>
              </dd>
            </div>
          </dl>
        )}

        {!insufficient && analysis.net_requirement_mm !== null && (
          <div className="rounded-md border border-forest-200 bg-forest-50 p-3.5">
            <p className="text-2xs uppercase tracking-[0.08em] text-forest-700">
              {t("Root-zone refill estimate")}
            </p>
            <p className="mono-data mt-1 text-lg font-semibold text-forest-900">
              {formatNumber(analysis.net_requirement_mm, 1)} mm {t("net")}
              {analysis.gross_requirement_mm !== null && analysis.application_efficiency !== null && (
                <span className="ms-2 text-sm font-normal text-forest-700">
                  {formatNumber(analysis.gross_requirement_mm, 1)} mm {t("gross")} ·{" "}
                  {t("{n}% efficiency", {
                    n: formatNumber(analysis.application_efficiency * 100, 0),
                  })}
                </span>
              )}
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-forest-700">
              {t(
                "The model assumes no irrigation events (I = 0). This is a refill estimate, not a schedule or applied volume.",
              )}
            </p>
          </div>
        )}

        {insufficient && analysis.missing_inputs.length > 0 && (
          <InfoNote title={t("What is missing")} tone="warn">
            <ul className="space-y-1">
              {analysis.missing_inputs.map((item) => (
                <li key={item}>• {t(item)}</li>
              ))}
            </ul>
          </InfoNote>
        )}

        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end sm:justify-between">
          {!seasonComplete && (
            <div>
              <p className="field-label mb-2">{t("Confidence")}</p>
              <ConfidenceBadge assessment={analysis.confidence} showReasons={insufficient} />
              {!insufficient && analysis.confidence.reasons[0] && (
                <p className="mt-1.5 max-w-md text-2xs leading-relaxed text-muted">
                  {t(analysis.confidence.reasons[0])}
                </p>
              )}
            </div>
          )}
          <Link to={`/irrigation/${fieldId}`} className="btn-secondary btn-sm self-start sm:self-auto">
            {t("View calculation")}
            <ArrowRightIcon size={14} className="rtl:-scale-x-100" />
          </Link>
        </div>

        {showSource && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-2xs text-muted">{t("Source")}</span>
            <DataSourceBadge source={analysis.source} isDemo={analysis.is_demo} />
            <span className="inline-flex items-center gap-1 text-2xs text-muted">
              <InfoIcon size={11} />
              {t("Deterministic FAO-56 calculation")}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
