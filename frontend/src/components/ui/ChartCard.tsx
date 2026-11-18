import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nContext";

/**
 * Chart container: title, optional description and actions, a fixed-height body
 * (so Recharts can measure its parent), and a provenance footer with the data
 * source, range and units required by the scientific-transparency rule.
 */
export function ChartCard({
  title,
  description,
  actions,
  source,
  footnote,
  children,
  height = 280,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  source?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
  height?: number;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <section className={`card ${className}`} aria-label={t(title)}>
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t(title)}</h3>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{t(description)}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </header>
      {/* Recharts lays out in SVG left-to-right; keep charts LTR in Arabic. */}
      <div className="px-3 pb-2 pt-4" style={{ height }} dir="ltr">
        {children}
      </div>
      {(source || footnote) && (
        <footer className="flex flex-col gap-2 border-t border-line px-5 py-3 text-2xs text-muted sm:flex-row sm:items-center sm:justify-between">
          {source && <div>{source}</div>}
          {footnote && <div className="text-muted/90">{footnote}</div>}
        </footer>
      )}
    </section>
  );
}
