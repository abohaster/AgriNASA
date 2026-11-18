import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { InfoIcon } from "./Icons";

/**
 * Generic metric tile used for environmental cards and summary strips.
 * `value === null` renders an explicit "Data unavailable" state instead of a
 * dash-only card, which keeps the UI honest about missing inputs.
 */
export function MetricCard({
  label,
  value,
  unit,
  icon,
  hint,
  badge,
  footer,
  unavailableLabel = "Data unavailable",
  className = "",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: ReactNode;
  hint?: string;
  badge?: ReactNode;
  footer?: ReactNode;
  unavailableLabel?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const unavailable = value === null || value === undefined;

  return (
    <div className={`card flex flex-col p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted">{t(label)}</p>
        {icon && <span className="text-forest-500">{icon}</span>}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        {unavailable ? (
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <InfoIcon size={14} />
            {t(unavailableLabel)}
          </span>
        ) : (
          <>
            <span className="mono-data text-2xl font-semibold text-ink">{value}</span>
            {unit && <span className="text-sm font-medium text-muted">{unit}</span>}
          </>
        )}
      </div>

      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted">{t(hint)}</p>}
      {badge && <div className="mt-2.5">{badge}</div>}
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </div>
  );
}
