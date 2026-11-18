import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { DemoTrial } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { CROPS } from "../../lib/labels";
import { SparkIcon } from "../ui/Icons";

const TRIAL_LABEL = ["Trial 1", "Trial 2", "Trial 3", "Trial 4"];

function cropLabel(cropId: string): string {
  return CROPS.find((crop) => crop.value === cropId)?.label ?? cropId;
}

/**
 * One-tap demo fields for the field-scoped tools.
 *
 * The four trials cover every registered crop: the irrigated Delta wheat
 * reference, the Nubaria potato reclamation farm, the newly prepared wheat
 * seedbed and the Luxor transplanted tomato field. Clicking a trial either
 * hands the metadata to the caller (field creation prefill) or materialises
 * the saved demo field and navigates to the same tool for that field, which
 * re-runs the live analysis. No value is predefined here.
 */
export function DemoTrials({
  tab,
  currentFieldName,
  onSelect,
  className = "",
}: {
  /** Tool path segment to open for the demo field, e.g. "satellite". */
  tab?: string;
  /** Name of the field currently open, used only to highlight its trial. */
  currentFieldName?: string;
  /** When provided, the trial metadata is passed back instead of navigating. */
  onSelect?: (trial: DemoTrial) => void;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [trials, setTrials] = useState<DemoTrial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .demoTrials(controller.signal)
      .then((rows) => {
        setTrials(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : t("Demo trials could not be loaded."),
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // `t` only changes when the language changes; refetching then is harmless.
  }, [t]);

  async function choose(trial: DemoTrial) {
    setError(null);
    if (onSelect) {
      onSelect(trial);
      return;
    }
    if (!tab) return;
    setBusy(trial.key);
    try {
      const field = await api.ensureDemoTrial(trial.key);
      navigate(`/${tab}/${field.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("The demo field could not be prepared."),
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <p className={`text-2xs text-muted ${className}`}>{t("Loading demo trials…")}</p>
    );
  }

  if (trials.length === 0) {
    return error ? (
      <p className={`text-2xs text-clay-600 ${className}`}>{error}</p>
    ) : null;
  }

  return (
    <section
      className={`rounded-md border border-line bg-sage-50/70 p-4 ${className}`}
      aria-label={t("Demo trials")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <SparkIcon size={13} />
            {t("Demo trials")}
          </p>
          <h2 className="mt-1 text-sm font-semibold">
            {onSelect ? t("Start from a real example field") : t("Try this tool on four real fields")}
          </h2>
        </div>
        <p className="max-w-md text-2xs leading-relaxed text-muted">
          {onSelect
            ? t(
                "These are real Egyptian locations. A tap fills the form and the boundary; nothing is submitted until you create the field.",
              )
            : t(
                "Each tap opens a clearly labelled demo field and runs the live analysis of this page. Satellite and weather values are never predefined.",
              )}
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {trials.map((trial, index) => {
          const active = Boolean(
            currentFieldName && currentFieldName.startsWith(`Demo trial · ${trial.name}`),
          );
          const isBusy = busy === trial.key;
          return (
            <button
              key={trial.key}
              type="button"
              onClick={() => choose(trial)}
              disabled={busy !== null}
              aria-pressed={active}
              className={`rounded-md border p-3 text-start transition-colors ${
                active
                  ? "border-forest-600 bg-paper shadow-sm"
                  : "border-line bg-paper/85 hover:border-forest-300"
              } ${busy !== null && !isBusy ? "opacity-60" : ""}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="eyebrow">{t(TRIAL_LABEL[index] ?? "Trial")}</span>
                <span className="flex items-center gap-1.5">
                  {active && (
                    <span className="text-2xs font-medium text-forest-700">
                      {t("Open")}
                    </span>
                  )}
                  <span className="rounded-full bg-forest-100 px-2 py-0.5 text-2xs font-semibold text-forest-800 dark:bg-forest-900/40 dark:text-forest-100">
                    {t(cropLabel(trial.crop_id))}
                  </span>
                </span>
              </span>
              <span className="mt-1 block text-sm font-semibold">
                {lang === "ar" && trial.name_ar ? trial.name_ar : trial.name}
              </span>
              <span className="mt-1 block text-2xs leading-relaxed text-muted">
                {lang === "ar" && trial.description_ar
                  ? trial.description_ar
                  : trial.description}
              </span>
              <span className="mt-2 block font-mono text-2xs text-muted" dir="ltr">
                {trial.latitude.toFixed(4)}, {trial.longitude.toFixed(4)}
              </span>
              {isBusy && (
                <span className="mt-1 block text-2xs text-forest-700">
                  {t("Preparing the demo field…")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-2xs leading-relaxed text-clay-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
