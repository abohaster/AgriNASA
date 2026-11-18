import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { AIChat } from "../components/data/AIChat";
import { FieldLayout } from "../components/layout/FieldLayout";
import { EmptyState } from "../components/ui/AsyncState";
import { DataSourceBadge } from "../components/ui/DataSourceBadge";
import { InfoNote } from "../components/ui/InfoNote";
import { SectionHeading } from "../components/ui/SectionHeading";
import { StatusPill } from "../components/ui/StatusPill";
import {
  AlertIcon,
  CheckIcon,
  CpuIcon,
  DatabaseIcon,
  SatelliteIcon,
  SparkIcon,
} from "../components/ui/Icons";
import { useDataMode } from "../context/DataModeContext";
import { useAsync } from "../hooks/useAsync";
import { useFieldIdFromRoute } from "../hooks/useField";
import { useI18n } from "../i18n/I18nContext";

const CAN_DO = [
  "Explain the current irrigation demand class and the factors behind it.",
  "Walk through ET₀, the crop Kc stage and the ETc calculation.",
  "Summarise recent rainfall, temperature and soil-wetness changes.",
  "Explain which crop-health indicators are flagged and why.",
  "State which inputs are missing or which limitations apply.",
];

const CANNOT_DO = [
  "Invent, interpolate or “fill in” a missing measurement.",
  "Prescribe an irrigation volume, date or schedule.",
  "Diagnose a disease, pest or nutrient deficiency.",
  "Claim an ML prediction, accuracy or confidence percentage.",
  "Use data from outside the context shown with the answer.",
];

function CapabilityList({
  title,
  items,
  positive,
}: {
  title: string;
  items: string[];
  positive: boolean;
}) {
  const { t } = useI18n();

  return (
    <div>
      <p className="text-xs font-semibold text-ink">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-2xs leading-relaxed text-muted">
            <span className={`mt-0.5 shrink-0 ${positive ? "text-forest-600" : "text-[#963c2f]"}`}>
              {positive ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
            </span>
            <span>{t(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssistantBody({ fieldId }: { fieldId: number }) {
  const { t } = useI18n();
  const { mode, isDemo } = useDataMode();
  const health = useAsync(() => api.health(), []);

  return (
    <>
      <SectionHeading
        eyebrow={t("Field assistant")}
        title={t("Ask about the computed data")}
        description={t(
          "The assistant receives a structured snapshot of this field's current analyses. It explains those numbers — it never produces new measurements, diagnoses or application rates.",
        )}
        actions={
          <StatusPill tone={health.data?.ai_configured ? "info" : "neutral"} dot={false}>
            {health.data?.ai_configured
              ? t("Language model configured")
              : t("Rule-based explanations")}
          </StatusPill>
        }
      />

      {isDemo && (
        <InfoNote tone="warn" title={t("Demo mode is on")}>
          {t(
            "Answers will describe the cached Qena snapshot, not your field. The banner above every page repeats this. Switch to live data to ask about the selected field.",
          )}
        </InfoNote>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AIChat fieldId={fieldId} mode={mode} />

        <div className="space-y-5">
          <section className="card card-pad" aria-label={t("How answers are grounded")}>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-50 text-forest-700">
                <SparkIcon size={16} />
              </span>
              <h2 className="text-sm font-semibold">{t("How answers are grounded")}</h2>
            </div>
            <ol className="mt-3 space-y-3">
              <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-2">
                <span className="mono-data text-2xs text-forest-600">01</span>
                <p className="text-2xs leading-relaxed text-muted">
                  {t(
                    "On every question the backend re-fetches the weather window and re-runs the irrigation and crop-health models for the requested mode.",
                  )}
                </p>
              </li>
              <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-2">
                <span className="mono-data text-2xs text-forest-600">02</span>
                <p className="text-2xs leading-relaxed text-muted">
                  {t(
                    "Those results are packaged into one structured context object, including missing variables and limitations.",
                  )}
                </p>
              </li>
              <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-2">
                <span className="mono-data text-2xs text-forest-600">03</span>
                <p className="text-2xs leading-relaxed text-muted">
                  {t("The reply is generated from that object alone. Expand")}{" "}
                  <span className="font-medium text-ink">
                    {t("“View data sent to the assistant”")}
                  </span>{" "}
                  {t("under any answer to inspect the exact context.")}
                </p>
              </li>
            </ol>
          </section>

          <section className="card card-pad" aria-label={t("Capabilities")}>
            <h2 className="text-sm font-semibold">{t("Scope of the assistant")}</h2>
            <div className="mt-3 space-y-4">
              <CapabilityList title={t("It can")} items={CAN_DO} positive />
              <div className="border-t border-line pt-4">
                <CapabilityList title={t("It cannot")} items={CANNOT_DO} positive={false} />
              </div>
            </div>
          </section>

          <section className="card card-pad" aria-label={t("Data handling")}>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <DatabaseIcon size={15} />
              {t("Data handling")}
            </h2>
            <ul className="mt-2 space-y-2 text-2xs leading-relaxed text-muted">
              <li className="flex gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden="true" />
                <span>
                  {t(
                    "The browser sends only your question and the selected field/mode. All model calls and API keys live on the backend; no secret is shipped to the frontend.",
                  )}
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden="true" />
                <span>
                  {t(
                    "When no language-model credential is configured, answers are produced by a deterministic rule-based explainer over the same context — never by a mock or fabricated response.",
                  )}
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden="true" />
                <span>
                  {t(
                    "Questions and answers are stored locally with the field so the conversation can be reopened. Requests are rate-limited per client.",
                  )}
                </span>
              </li>
            </ul>
          </section>

          <section className="card card-pad" aria-label={t("Computed inputs")}>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CpuIcon size={15} />
              {t("Inputs available to the assistant")}
            </h2>
            <ul className="mt-2 space-y-2 text-2xs leading-relaxed text-muted">
              <li className="flex items-start gap-2">
                <SatelliteIcon size={13} />
                <span>
                  {t(
                    "NASA POWER daily weather and ET₀ for the analysis window, with provenance.",
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <DatabaseIcon size={13} />
                <span>{t("FAO-56 water balance, demand class, refill estimate and stage Kc.")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckIcon size={13} />
                <span>{t("Crop-health indicators and NDVI availability for the field.")}</span>
              </li>
            </ul>
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-2xs text-muted">
                {t("See")}{" "}
                <Link to={`/dashboard/${fieldId}`} className="link-underline">
                  {t("the dashboard")}
                </Link>{" "}
                {t("for the source badges and")}{" "}
                <Link to={`/irrigation/${fieldId}`} className="link-underline">
                  {t("irrigation analysis")}
                </Link>{" "}
                {t("for the full calculation chain.")}
              </p>
            </div>
          </section>

          <section className="card card-pad" aria-label={t("Data source")}>
            <h2 className="text-sm font-semibold">{t("Data source")}</h2>
            <div className="mt-2">
              <DataSourceBadge
                source={{
                  id: "power_daily",
                  name: "NASA POWER",
                  nature: "reanalysis",
                  resolution: "~50 km grid",
                  attribution: "NASA Prediction Of Worldwide Energy Resources",
                  url: "https://power.larc.nasa.gov/",
                }}
                isDemo={isDemo}
              />
            </div>
            <p className="mt-2 text-2xs leading-relaxed text-muted">
              {t(
                "Weather values are grid-cell estimates, not on-farm sensor readings. The assistant is instructed to preserve that distinction.",
              )}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

/** Full-page, grounded field assistant with a capability and data-handling panel. */
export function AssistantPage() {
  const params = useParams();
  const fieldId = useFieldIdFromRoute(params.fieldId);
  const { t } = useI18n();

  if (!fieldId) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title={t("No field selected")}
          description={t("Choose a field before opening the assistant.")}
          action={
            <Link to="/fields" className="btn-primary btn-sm">
              {t("Go to fields")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <FieldLayout fieldId={fieldId} activeTab="assistant">
      {() => <AssistantBody fieldId={fieldId} />}
    </FieldLayout>
  );
}
