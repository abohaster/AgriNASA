import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { CropAssessment, CropOption } from "../api/types";
import { AlertCard } from "../components/data/AlertCard";
import { LocationHeader, SourceBadges } from "../components/location/LocationHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/AsyncState";
import { InfoNote } from "../components/ui/InfoNote";
import { StatusPill } from "../components/ui/StatusPill";
import { CheckIcon, SparkIcon, WheatIcon } from "../components/ui/Icons";
import { useAsync } from "../hooks/useAsync";
import { useI18n } from "../i18n/I18nContext";
import { formatNumber, titleCase } from "../lib/format";
import {
  ringRequest,
  useSelectedLocation,
  type SelectedLocation,
} from "../lib/location";

const MAX_CROPS = 3;

const FACTOR_TONE = { good: "good", marginal: "warn", poor: "bad", unknown: "neutral" } as const;
const RISK_TONE = { high: "danger", moderate: "warn", low: "info" } as const;

function verdictTone(verdict?: CropAssessment["verdict"]) {
  if (verdict === "suitable") return "good" as const;
  if (verdict === "marginal") return "warn" as const;
  if (verdict === "not_suitable") return "bad" as const;
  return "neutral" as const;
}

function verdictLabel(verdict?: CropAssessment["verdict"]) {
  if (verdict === "suitable") return "Suitable";
  if (verdict === "marginal") return "Marginal";
  if (verdict === "not_suitable") return "Not suitable";
  return "Not assessed";
}

function CropDetail({
  assessment,
  crops,
}: {
  assessment: CropAssessment;
  crops: CropOption[];
}) {
  const { t } = useI18n();
  const option = crops.find((crop) => crop.id === assessment.crop_id);
  const name = assessment.crop_name ?? option?.name ?? assessment.crop_id;
  const sources = assessment.sources_detail ?? [];
  const sourceName = (id: string) => sources.find((source) => source.id === id)?.name ?? id;
  const score = assessment.score ?? 0;
  const max = assessment.score_max ?? 100;
  const percent = max > 0 ? Math.max(0, Math.min(100, (score / max) * 100)) : 0;
  const tone = verdictTone(assessment.verdict);

  if (!assessment.available) {
    return (
      <AlertCard tone="warn" title={t("{crop} could not be assessed", { crop: t(name) })}>
        {t(assessment.reason ?? "Required soil or climate inputs are unavailable for this location.")}
      </AlertCard>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t(name)}</h2>
            <p className="mt-0.5 text-2xs text-muted">
              {t("Screening score from retrieved soil and climate data — not a yield forecast.")}
            </p>
          </div>
          <StatusPill tone={tone}>{t(verdictLabel(assessment.verdict))}</StatusPill>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline justify-between text-xs text-muted">
            <span>{t("Suitability score")}</span>
            <span className="font-mono text-ink">
              {formatNumber(score, 0)} / {formatNumber(max, 0)}
            </span>
          </div>
          <div
            className="mt-1 h-2 overflow-hidden rounded-full bg-sage-100"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={score}
            aria-label={t("Suitability score")}
          >
            <div
              className={
                tone === "good"
                  ? "h-full rounded-full bg-forest-500"
                  : tone === "warn"
                    ? "h-full rounded-full bg-clay-400"
                    : "h-full rounded-full bg-[#a63d33]"
              }
              style={{ width: `${percent}%` }}
            />
          </div>
          {assessment.confidence && (
            <p className="mt-1 text-2xs text-muted">
              {t("Confidence: {value}", { value: t(assessment.confidence) })}
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card card-pad">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <WheatIcon size={15} />
            {t("Planting window")}
          </h3>
          {assessment.planting && (
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Ideal months")}</dt>
                <dd className="text-end text-ink">
                  {assessment.planting.ideal_months.map((month) => t(month)).join(", ")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Acceptable months")}</dt>
                <dd className="text-end text-ink">
                  {assessment.planting.acceptable_months.map((month) => t(month)).join(", ")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Season length")}</dt>
                <dd className="text-ink">{assessment.planting.season_days} {t("days")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Establishment")}</dt>
                <dd className="text-end text-ink">{t(assessment.planting.establishment)}</dd>
              </div>
            </dl>
          )}
          <p className="mt-2 border-t border-line pt-2 text-2xs leading-relaxed text-muted">
            {t(assessment.planting?.note ?? "Regional calendar defaults; local variety and extension advice can differ.")}
          </p>
          {assessment.reference_temperature_c !== null && assessment.reference_temperature_c !== undefined && (
            <p className="mt-1.5 text-2xs text-muted">
              {t("Reference temperature used: {value} °C", {
                value: formatNumber(assessment.reference_temperature_c, 1),
              })}
            </p>
          )}
        </section>

        <section className="card card-pad">
          <h3 className="text-sm font-semibold">{t("Soil and water context")}</h3>
          {assessment.soil && (
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Texture")}</dt>
                <dd className="text-ink">
                  {assessment.soil.texture ? t(titleCase(assessment.soil.texture)) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("pH")}</dt>
                <dd className="text-ink">
                  {assessment.soil.ph !== null ? formatNumber(assessment.soil.ph, 1) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Organic carbon")}</dt>
                <dd className="text-ink">
                  {assessment.soil.organic_carbon_g_kg !== null
                    ? `${formatNumber(assessment.soil.organic_carbon_g_kg, 1)} g/kg`
                    : "—"}
                </dd>
              </div>
            </dl>
          )}
          {assessment.water_reference && (
            <dl className="mt-2 space-y-1.5 border-t border-line pt-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Season ET₀")}</dt>
                <dd className="text-ink">{formatNumber(assessment.water_reference.et0_total_mm, 0)} mm</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Estimated crop ET")}</dt>
                <dd className="text-ink">{formatNumber(assessment.water_reference.etc_estimate_mm, 0)} mm</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Season rain")}</dt>
                <dd className="text-ink">{formatNumber(assessment.water_reference.rain_total_mm, 0)} mm</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Effective rain (80%)")}</dt>
                <dd className="text-ink">{formatNumber(assessment.water_reference.effective_rain_mm, 0)} mm</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Net irrigation estimate")}</dt>
                <dd className="text-ink">
                  {formatNumber(assessment.water_reference.net_irrigation_estimate_mm, 0)} mm
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("Crop water range")}</dt>
                <dd className="text-ink">
                  {assessment.water_reference.reference_range_mm.map((value) => formatNumber(value, 0)).join("–")} mm
                </dd>
              </div>
            </dl>
          )}
          <p className="mt-2 text-2xs leading-relaxed text-muted">
            {t(
              assessment.water_reference?.method ??
                "Water figures are a climatological reference using the crop coefficient, not a schedule.",
            )}
          </p>
        </section>
      </div>

      {assessment.factors && assessment.factors.length > 0 && (
        <section className="card overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h3 className="text-sm font-semibold">{t("Screening factors")}</h3>
            <p className="mt-0.5 text-xs text-muted">
              {t("Each factor uses retrieved data; a low score is shown with its explanation, not hidden.")}
            </p>
          </header>
          <ul className="divide-y divide-line">
            {assessment.factors.map((factor) => (
              <li key={factor.key} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink">{t(factor.label)}</span>
                  <span className="flex items-center gap-2 text-2xs text-muted">
                    <span className="font-mono">
                      {formatNumber(factor.score, 0)} / {formatNumber(factor.max, 0)}
                    </span>
                    <StatusPill tone={FACTOR_TONE[factor.status]} dot={false}>
                      {t(factor.status === "unknown" ? "Unknown" : factor.status)}
                    </StatusPill>
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t(factor.explanation)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {assessment.risks && assessment.risks.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("Environmental risks")}</h3>
          {assessment.risks.map((risk) => (
            <AlertCard key={risk.key} tone={RISK_TONE[risk.level]} title={t(risk.level === "high" ? "High risk" : risk.level === "moderate" ? "Moderate risk" : "Low risk")}>
              <p>{t(risk.text)}</p>
              {risk.sources.length > 0 && (
                <p className="mt-1 font-mono text-2xs uppercase tracking-[0.06em]">
                  {t("Source")}: {risk.sources.map(sourceName).join(", ")}
                </p>
              )}
            </AlertCard>
          ))}
        </section>
      )}

      {assessment.recommendations && assessment.recommendations.length > 0 && (
        <section className="card card-pad">
          <h3 className="text-sm font-semibold">{t("Practical recommendations")}</h3>
          <ul className="mt-2 space-y-2.5">
            {assessment.recommendations.map((recommendation) => (
              <li key={recommendation.text} className="text-xs leading-relaxed">
                <p className="flex gap-2 text-ink">
                  <CheckIcon size={14} />
                  <span>{t(recommendation.text)}</span>
                </p>
                <p className="mt-0.5 ps-5 text-2xs text-muted">
                  {t(recommendation.basis)}
                  {recommendation.sources.length > 0
                    ? ` · ${t("Source")}: ${recommendation.sources.map(sourceName).join(", ")}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sources.length > 0 && <SourceBadges sources={sources} />}

      {assessment.limitations && assessment.limitations.length > 0 && (
        <section className="card card-pad">
          <h3 className="text-sm font-semibold">{t("Limitations")}</h3>
          <ul className="mt-2 space-y-1.5 text-2xs leading-relaxed text-muted">
            {assessment.limitations.map((limitation) => (
              <li key={limitation} className="flex gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/50" aria-hidden="true" />
                <span>{t(limitation)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CropBody({ location }: { location: SelectedLocation }) {
  const { t } = useI18n();
  const catalogueState = useAsync((signal) => api.locationCrops(signal), []);
  const catalogue = catalogueState.data;

  const [selectedCrops, setSelectedCrops] = useState<string[]>(
    location.cropId ? [location.cropId] : [],
  );
  const [activeCrop, setActiveCrop] = useState<string | null>(location.cropId ?? null);

  useEffect(() => {
    if (selectedCrops.length === 0 && catalogue && catalogue.crops.length > 0) {
      setSelectedCrops([catalogue.crops[0].id]);
      setActiveCrop((current) => current ?? catalogue.crops[0].id);
    }
  }, [catalogue, selectedCrops.length]);

  const assessmentState = useAsync<CropAssessment[] | null>(
    async (signal) => {
      if (selectedCrops.length === 0) return null;
      const ids = selectedCrops.slice(0, MAX_CROPS);
      return Promise.all(
        ids.map((cropId) =>
          location.boundary
            ? api.locationCropArea({ ...ringRequest(location), crop_id: cropId }, signal)
            : api.locationCrop(location.latitude, location.longitude, cropId, { signal }),
        ),
      );
    },
    [location.latitude, location.longitude, location.boundary, selectedCrops.join(",")],
  );

  const assessments = assessmentState.data ?? [];
  const current = useMemo(
    () => assessments.find((entry) => entry.crop_id === activeCrop) ?? assessments[0],
    [assessments, activeCrop],
  );

  function toggleCrop(cropId: string) {
    setSelectedCrops((currentSelection) => {
      if (currentSelection.includes(cropId)) {
        const next = currentSelection.filter((id) => id !== cropId);
        if (activeCrop === cropId) setActiveCrop(next[0] ?? null);
        return next;
      }
      if (currentSelection.length >= MAX_CROPS) return currentSelection;
      setActiveCrop(cropId);
      return [...currentSelection, cropId];
    });
  }

  const crops = catalogue?.crops ?? [];

  return (
    <div className="container-page space-y-6 py-10">
      <LocationHeader
        location={location}
        title={t("Crop intelligence")}
        description={t(
          "Screen crop choices against retrieved soil, climate and water data for this location. The score is a screening aid; it is not a yield guarantee.",
        )}
      />

      <section className="card card-pad space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{t("Choose crops to compare")}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {t("Select up to {n}. Calendars are regional Egyptian extension defaults.", { n: MAX_CROPS })}
            </p>
          </div>
          <span className="text-2xs text-muted">
            {selectedCrops.length} / {MAX_CROPS}
          </span>
        </div>

        {catalogueState.status === "loading" && (
          <LoadingState label={t("Loading the crop catalogue…")} rows={2} variant="list" />
        )}
        {catalogueState.status === "error" && (
          <ErrorState
            title={t("Crop catalogue unavailable")}
            message={catalogueState.error?.message ?? t("The crop list could not be loaded.")}
            onRetry={catalogueState.reload}
          />
        )}

        {crops.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {crops.map((crop) => {
              const selected = selectedCrops.includes(crop.id);
              const disabled = !selected && selectedCrops.length >= MAX_CROPS;
              return (
                <button
                  key={crop.id}
                  type="button"
                  onClick={() => toggleCrop(crop.id)}
                  disabled={disabled}
                  aria-pressed={selected}
                  className={
                    selected
                      ? "inline-flex items-center gap-1.5 rounded-full border border-forest-300 bg-forest-50 px-3 py-1 text-xs font-medium text-forest-800"
                      : "inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-muted hover:border-forest-200 disabled:cursor-not-allowed disabled:opacity-45"
                  }
                >
                  {selected && <CheckIcon size={12} />}
                  {t(crop.name)}
                </button>
              );
            })}
          </div>
        )}
        {catalogue?.note && <p className="text-2xs text-muted">{t(catalogue.note)}</p>}
      </section>

      {assessmentState.status === "loading" && (
        <LoadingState
          label={t("Assessing selected crops against soil and climate data… this can take a minute on first use.")}
          rows={4}
        />
      )}
      {assessmentState.status === "error" && (
        <ErrorState
          title={t("Crop assessment unavailable")}
          message={assessmentState.error?.message ?? t("The assessment service could not answer.")}
          details={t("Reducing the number of compared crops can help if a source timed out.")}
          onRetry={assessmentState.reload}
        />
      )}

      {assessments.length > 0 && (
        <>
          {assessments.length > 1 && (
            <section className="card overflow-hidden">
              <header className="border-b border-line px-5 py-4">
                <h2 className="text-sm font-semibold">{t("Side-by-side")}</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {t("Scores are on different factor sets per crop; compare verdicts and limits, not only the number.")}
                </p>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line text-2xs uppercase tracking-[0.06em] text-muted">
                      <th className="px-4 py-2 text-start font-medium">{t("Crop")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("Verdict")}</th>
                      <th className="px-3 py-2 text-end font-medium">{t("Score")}</th>
                      <th className="px-3 py-2 text-end font-medium">{t("Confidence")}</th>
                      <th className="px-4 py-2 text-start font-medium">{t("Ideal planting")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map((entry) => {
                      const option = crops.find((crop) => crop.id === entry.crop_id);
                      return (
                        <tr
                          key={entry.crop_id}
                          className={`border-b border-line last:border-0 ${current?.crop_id === entry.crop_id ? "bg-forest-50/40" : ""}`}
                        >
                          <td className="px-4 py-2 text-ink">{t(entry.crop_name ?? option?.name ?? entry.crop_id)}</td>
                          <td className="px-3 py-2">
                            <StatusPill tone={verdictTone(entry.verdict)} dot={false}>
                              {t(verdictLabel(entry.verdict))}
                            </StatusPill>
                          </td>
                          <td className="px-3 py-2 text-end font-mono text-ink">
                            {entry.score !== undefined ? `${formatNumber(entry.score, 0)}/${formatNumber(entry.score_max ?? 100, 0)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-end text-ink">
                            {entry.confidence ? t(entry.confidence) : "—"}
                          </td>
                          <td className="px-4 py-2 text-ink">
                            {entry.planting ? entry.planting.ideal_months.map((month) => t(month)).join(", ") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {assessments.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {assessments.map((entry) => {
                const option = crops.find((crop) => crop.id === entry.crop_id);
                const selected = current?.crop_id === entry.crop_id;
                return (
                  <button
                    key={entry.crop_id}
                    type="button"
                    onClick={() => setActiveCrop(entry.crop_id)}
                    className={selected ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                  >
                    {t(entry.crop_name ?? option?.name ?? entry.crop_id)}
                  </button>
                );
              })}
            </div>
          )}

          {current ? (
            <CropDetail assessment={current} crops={crops} />
          ) : (
            <EmptyState title={t("No crop selected")} description={t("Choose at least one crop above.")} />
          )}
        </>
      )}

      <InfoNote tone="warn">
        {t(
          "Crop suitability is a transparent screening score built from soil, temperature, rainfall and calendar data. It cannot promise a harvest, price or profit. Disease identification needs field photographs.",
        )}
      </InfoNote>

      {location.field && (
        <div>
          <Link to={`/rayyan?field=${location.field.id}`} className="btn-secondary btn-sm">
            <SparkIcon size={14} />
            {t("Ask Fale7 about this field")}
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Crop intelligence for any selected location.
 *
 * Multiple crops can be compared, but every assessment is requested and
 * rendered independently so one unavailable source cannot hide the others.
 */
export function CropIntelligencePage() {
  const location = useSelectedLocation();
  const { t } = useI18n();

  if (location?.loading) {
    return (
      <div className="container-page py-10">
        <LoadingState label={t("Loading the saved field…")} rows={4} />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title={t("No location selected")}
          description={t("Choose a point or draw a field on the Explore Map first.")}
          action={
            <Link to="/explore" className="btn-primary btn-sm">
              {t("Open Explore Map")}
            </Link>
          }
        />
      </div>
    );
  }

  return <CropBody key={`${location.latitude}-${location.longitude}-${Boolean(location.boundary)}`} location={location} />;
}
