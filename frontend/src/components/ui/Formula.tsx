import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nContext";

/**
 * Monospace equation block used in the landing page and calculation drawers.
 * Intentionally plain text (not a math renderer) so students can read the
 * formula and find the same symbols in backend/app/science/*.py.
 */
export function Formula({
  name,
  expression,
  variables,
  note,
}: {
  name: string;
  expression: string;
  variables?: { symbol: string; meaning: string }[];
  note?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="panel-night rounded-md border border-white/10 p-4">
      <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[#8dbba1]">{t(name)}</p>
      <p
        className="mt-2 overflow-x-auto whitespace-pre font-mono text-sm leading-relaxed text-[#eef5f0]"
        dir="ltr"
      >
        {expression}
      </p>
      {variables && variables.length > 0 && (
        <dl className="mt-3 grid gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-xs sm:grid-cols-2">
          {variables.map((variable) => (
            <div key={variable.symbol} className="flex gap-2">
              <dt className="shrink-0 font-mono text-[#8dbba1]" dir="ltr">
                {variable.symbol}
              </dt>
              <dd className="text-white/75">{t(variable.meaning)}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && (
        <div className="mt-3 text-xs leading-relaxed text-white/60">
          {typeof note === "string" ? t(note) : note}
        </div>
      )}
    </div>
  );
}
