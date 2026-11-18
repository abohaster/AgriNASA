import type { DataSourceRef } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { NATURE_LABELS, NATURE_TONE } from "../../lib/labels";
import { ExternalLinkIcon } from "./Icons";
import { StatusPill } from "./StatusPill";

/**
 * Provenance label attached to every visualisation.
 *
 * Displays the dataset name and its *nature* (reanalysis vs satellite etc.).
 * A title tooltip repeats the resolution and attribution so a hover explains
 * why, for example, MERRA-2 soil wetness is context rather than a field probe.
 */
export function DataSourceBadge({
  source,
  isDemo = false,
  compact = false,
}: {
  source: DataSourceRef;
  isDemo?: boolean;
  compact?: boolean;
}) {
  const { t, tm } = useI18n();
  const tooltip = [
    source.attribution,
    source.resolution ? t("Resolution: {value}", { value: tm(source.resolution) }) : null,
    t(NATURE_LABELS[source.nature]),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" title={tooltip}>
      {isDemo && (
        <StatusPill tone="warn" dot={false}>
          {t("DEMO DATA")}
        </StatusPill>
      )}
      <span className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-[0.08em] text-muted">
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 hover:text-forest-700"
          >
            {source.name}
            <ExternalLinkIcon size={11} />
          </a>
        ) : (
          source.name
        )}
        {!compact && <span className="text-line">/</span>}
        {!compact && <span className="normal-case tracking-normal">{t(NATURE_LABELS[source.nature])}</span>}
      </span>
      {source.resolution && !compact && (
        <span className="hidden font-mono text-2xs text-muted/80 sm:inline">{tm(source.resolution)}</span>
      )}
      <StatusPill tone={NATURE_TONE[source.nature]} dot={false} className="hidden sm:inline-flex">
        {source.nature === "reanalysis" ? t("Model-derived") : t(NATURE_LABELS[source.nature])}
      </StatusPill>
    </span>
  );
}
