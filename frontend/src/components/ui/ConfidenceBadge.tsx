import type { ConfidenceAssessment } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { CONFIDENCE_META } from "../../lib/labels";
import { StatusPill } from "./StatusPill";

/**
 * Qualitative confidence label. The backend never produces an arbitrary
 * percentage; it returns a level plus the documented reasons. This component
 * shows the level and optionally the reasons as a short list.
 */
export function ConfidenceBadge({
  assessment,
  showReasons = false,
}: {
  assessment: ConfidenceAssessment;
  showReasons?: boolean;
}) {
  const { t } = useI18n();
  const meta = CONFIDENCE_META[assessment.level];

  return (
    <div className="space-y-2">
      <StatusPill tone={meta.tone}>{t(meta.label)}</StatusPill>
      {showReasons && assessment.reasons.length > 0 && (
        <ul className="space-y-1 text-xs leading-relaxed text-muted">
          {assessment.reasons.map((reason) => (
            <li key={reason} className="flex gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden="true" />
              <span>{t(reason)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
