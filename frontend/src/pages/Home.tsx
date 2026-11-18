import { Link } from "react-router-dom";
import { Formula } from "../components/ui/Formula";
import {
  ArrowRightIcon,
  CheckIcon,
  CpuIcon,
  DatabaseIcon,
  DropIcon,
  GaugeIcon,
  LayersIcon,
  LeafIcon,
  MapPinIcon,
  SatelliteIcon,
  SparkIcon,
  ThermometerIcon,
  WheatIcon,
} from "../components/ui/Icons";
import { InfoNote } from "../components/ui/InfoNote";
import { SectionHeading } from "../components/ui/SectionHeading";
import { StatusPill } from "../components/ui/StatusPill";
import { useTheme } from "../context/ThemeContext";
import { useI18n } from "../i18n/I18nContext";

/**
 * Illustrative FAO-56 default Kc curve for winter wheat.
 * These are *model defaults* (Kc ini/mid/end), not measured canopy values; the
 * caption on the chart says so explicitly.
 */
function KcCurve() {
  const { chart } = useTheme();
  const { t } = useI18n();

  const points = [
    [12, 92],
    [72, 92],
    [122, 30],
    [212, 30],
    [296, 88],
  ];
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point[0]} ${point[1]}`).join(" ");
  const area = `${path} L296 104 L12 104 Z`;

  return (
    <div className="rounded-md border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-2xs uppercase tracking-[0.12em] text-muted">
          {t("Wheat Kc curve · default")}
        </p>
        <span className="font-mono text-2xs text-muted">Kc mid 1.15</span>
      </div>
      <div dir="ltr">
        <svg
        viewBox="0 0 320 116"
        className="mt-2 w-full"
        role="img"
        aria-label={t(
          "Linearly interpolated wheat crop coefficient across initial, development, mid-season and late stages, peaking at 1.15.",
        )}
      >
        <line x1="8" y1="104" x2="312" y2="104" stroke={chart.grid} />
        <line x1="12" y1="8" x2="12" y2="104" stroke={chart.grid} />
        {[24, 60, 108, 156, 204, 252, 300].map((x) => (
          <line key={x} x1={x} y1="104" x2={x} y2="108" stroke={chart.grid} />
        ))}
        <path d={area} fill={chart.grid} opacity={0.35} />
        <path d={path} fill="none" stroke={chart.ndvi} strokeWidth="2.2" />
        {points.map(([x, y]) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r="3"
            fill={chart.tooltip.contentStyle.backgroundColor}
            stroke={chart.ndvi}
            strokeWidth="1.8"
          />
        ))}
        <text x="16" y="82" fontSize="8" fill={chart.tick} fontFamily="IBM Plex Mono, monospace">
          0.40
        </text>
        <text x="118" y="22" fontSize="8" fill={chart.tick} fontFamily="IBM Plex Mono, monospace">
          1.15
        </text>
        <text x="18" y="112" fontSize="7.5" fill={chart.tick} fontFamily="IBM Plex Mono, monospace">
          {t("initial")}
        </text>
        <text x="84" y="112" fontSize="7.5" fill={chart.tick} fontFamily="IBM Plex Mono, monospace">
          {t("development")}
        </text>
        <text x="158" y="112" fontSize="7.5" fill={chart.tick} fontFamily="IBM Plex Mono, monospace">
          {t("mid-season")}
        </text>
        <text x="243" y="112" fontSize="7.5" fill={chart.tick} fontFamily="IBM Plex Mono, monospace">
          {t("late")}
        </text>
      </svg>
      </div>
      <p className="mt-1 text-2xs leading-relaxed text-muted">
        {t("FAO-56 Table 12 defaults with linear stage interpolation (eq. 66–68). Not field-measured.")}
      </p>
    </div>
  );
}

const PIPELINE = [
  {
    label: "NASA POWER",
    detail: "daily climate · keyless",
    icon: <SatelliteIcon size={16} />,
  },
  {
    label: "Normalise & QA",
    detail: "units · missing values · dates",
    icon: <DatabaseIcon size={16} />,
  },
  {
    label: "FAO-56 science",
    detail: "ET₀ · Kc · water balance",
    icon: <GaugeIcon size={16} />,
  },
  {
    label: "Explanation",
    detail: "LLM reads JSON, never invents",
    icon: <SparkIcon size={16} />,
  },
];

const STEPS = [
  {
    title: "Locate the field",
    body: "Search a place, click the map, enter coordinates or draw the field outline. A point-only field is never given an invented boundary.",
    icon: <MapPinIcon size={18} />,
  },
  {
    title: "Retrieve NASA data",
    body: "The backend requests NASA POWER daily climate variables for the planting-to-today window, with a cache.",
    icon: <SatelliteIcon size={18} />,
  },
  {
    title: "Process and check",
    body: "Units are converted, dates aligned and gaps flagged. Missing variables stay missing — they are never filled with guesses.",
    icon: <LayersIcon size={18} />,
  },
  {
    title: "Run the science",
    body: "Penman–Monteith ET₀, stage-based Kc, ETc and a daily root-zone water balance produce a demand class and confidence.",
    icon: <GaugeIcon size={18} />,
  },
  {
    title: "Explain, don't invent",
    body: "The assistant receives the computed facts as structured JSON and explains them. It cannot alter a number.",
    icon: <SparkIcon size={18} />,
  },
];

const CAPABILITIES = [
  {
    title: "Environmental analytics",
    body: "Seven-day to custom-range charts for temperature, rainfall, humidity, wind, radiation and soil wetness, each with source and units.",
    icon: <ThermometerIcon size={19} />,
    tag: "NASA POWER",
  },
  {
    title: "Irrigation demand",
    body: "A deterministic root-zone balance driven by FAO-56 ET₀ and a stage-varying crop Kc, reported as Low / Moderate / High with reasons.",
    icon: <DropIcon size={19} />,
    tag: "FAO-56",
  },
  {
    title: "Confidence, not percentages",
    body: "A qualitative confidence label derived from input completeness, spatial mismatch and documented model assumptions.",
    icon: <CheckIcon size={19} />,
    tag: "Auditable",
  },
  {
    title: "Crop stress indicators",
    body: "Heat, water and rainfall-anomaly indicators for the supported crops. Environmental stress only — never a disease diagnosis.",
    icon: <LeafIcon size={19} />,
    tag: "No false diagnoses",
  },
  {
    title: "Field map with NASA imagery",
    body: "OpenStreetMap base plus NASA GIBS satellite imagery. If no boundary exists, the field is drawn honestly as a point.",
    icon: <MapPinIcon size={19} />,
    tag: "Leaflet + GIBS",
  },
  {
    title: "Grounded assistant",
    body: "Ask why demand changed. Answers cite the exact structured data sent to the model, which is shown alongside the reply.",
    icon: <SparkIcon size={19} />,
    tag: "Structured context",
  },
];

const DATA_ROWS = [
  {
    variable: "Temperature, humidity, wind, rainfall, radiation, pressure",
    source: "NASA POWER · community AG",
    nature: "Reanalysis / model-derived (MERRA-2)",
    resolution: "0.5° × 0.625° · daily",
  },
  {
    variable: "Root-zone soil wetness (GWETROOT)",
    source: "NASA POWER (MERRA-2 land)",
    nature: "Model-derived wetness fraction, not a probe",
    resolution: "0.5° × 0.625° · daily",
  },
  {
    variable: "30-year rainfall normals",
    source: "NASA POWER climatology",
    nature: "Model-derived baseline",
    resolution: "Monthly normals",
  },
  {
    variable: "Satellite imagery basemap",
    source: "NASA GIBS",
    nature: "Satellite observation (MODIS/VIIRS layers)",
    resolution: "Tile-dependent",
  },
  {
    variable: "NDVI / NDMI",
    source: "Google Earth Engine · Sentinel-2",
    nature: "Satellite observation at 10 m",
    resolution: "Most recent usable pass",
  },
];

const QUESTIONS = [
  "Why is irrigation demand high?",
  "What changed this week?",
  "Explain the temperature trend.",
  "Which environmental factor should worry me most?",
  "Show me how ET₀ was calculated.",
];

export function HomePage() {
  const { t } = useI18n();

  return (
    <div>
      {/* 1 · Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="surface-grid pointer-events-none absolute inset-y-0 end-0 hidden w-1/2 opacity-60 lg:block"
          aria-hidden="true"
        />
        <div className="container-page relative grid gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-forest-500" />
              {t("NASA POWER · FAO-56 · grounded AI")}
            </p>
            <h1 className="mt-4 text-[2.55rem] leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]">
              {t("Crop decisions,")}
              <br />
              <span className="text-forest-700">{t("grounded in Earth data.")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              {t(
                "Pull NASA climate records for one field, run a transparent water balance, and let an assistant explain the result. Every number is computed by code; the AI only explains what it was given.",
              )}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/fields/new" className="btn-primary">
                {t("Create a field")}
                <ArrowRightIcon size={16} />
              </Link>
              <a href="#how-it-works" className="btn-secondary">
                {t("See how it works")}
              </a>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon size={13} /> {t("NASA POWER needs no key")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon size={13} /> {t("Demo replay is clearly labelled")}
              </span>
            </p>
          </div>

          <div className="relative">
            <div
              className="absolute -end-3 -top-3 hidden h-24 w-24 rounded-full border border-sage-300 sm:block"
              aria-hidden="true"
            />
            <div className="card relative overflow-hidden shadow-lift">
              <div className="flex items-center justify-between border-b border-white/10 bg-[#0b1f17] px-4 py-3 text-[#f4faf6]">
                <span className="font-mono text-2xs uppercase tracking-[0.14em] text-[#b9d6c6]">
                  {t("Pipeline · one field")}
                </span>
                <span className="font-mono text-2xs text-[#8dbba1]">v1.0</span>
              </div>
              <div className="divide-y divide-line">
                {PIPELINE.map((step, index) => (
                  <div key={step.label} className="flex items-start gap-3 px-4 py-3.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-forest-200 bg-forest-50 text-forest-700">
                      {step.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{t(step.label)}</p>
                        <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
                          0{index + 1}
                        </span>
                      </div>
                      <p className="text-xs text-muted">{t(step.detail)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line bg-sage-50 px-4 py-3">
                <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted">
                  {t("Inputs")}
                </span>
                {["Tmax", "Tmin", "RH", "u₂", "Rs", "P"].map((variable) => (
                  <span
                    key={variable}
                    className="rounded border border-line bg-card px-1.5 py-0.5 font-mono text-2xs text-muted"
                  >
                    {variable}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-line bg-card/60">
          <div className="container-page grid gap-6 py-6 sm:grid-cols-3">
            {[
              {
                value: "0.5° × 0.625°",
                label: "NASA POWER grid — coarse by design, disclosed everywhere",
              },
              {
                value: t("135–150 days"),
                label: "Wheat season span the Kc curve is defined over",
              },
              {
                value: t("100% deterministic"),
                label: "Irrigation classes are code, never generated text",
              },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1">
                <span className="font-mono text-lg font-medium tracking-tight text-forest-800">
                  {stat.value}
                </span>
                <span className="max-w-xs text-xs leading-relaxed text-muted">{t(stat.label)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2 · Project explanation */}
      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeading
            eyebrow={t("What this is")}
            title={t("A decision-support tool you can audit")}
            description={t(
              "AgriNASA answers a narrow, practical question for the supported crops: given coarse NASA climate data, the planting date and basic soil assumptions, how much water has the root zone lost — and how much should you care this week?",
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card card-pad">
              <p className="eyebrow mb-2 text-forest-600">{t("It does")}</p>
              <ul className="space-y-2 text-sm leading-relaxed text-muted">
                {[
                  "Compute ET₀, ETc and a daily soil-water balance",
                  "Classify irrigation demand with visible reasons",
                  "Report confidence and missing inputs",
                  "Explain results from structured data",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckIcon size={15} className="mt-0.5 shrink-0 text-forest-600" />
                    {t(item)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card card-pad">
              <p className="eyebrow mb-2 text-clay-500">{t("It does not")}</p>
              <ul className="space-y-2 text-sm leading-relaxed text-muted">
                {[
                  "Measure your field with sensors",
                  "Diagnose diseases from satellite pixels",
                  "Promise a precise irrigation litres figure",
                  "Invent values when data is missing",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1 w-2.5 shrink-0 rounded bg-clay-400" aria-hidden="true" />
                    {t(item)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3 · How it works */}
      <section id="how-it-works" className="border-y border-line bg-sage-50">
        <div className="container-page py-16 sm:py-20">
          <SectionHeading
            eyebrow={t("How it works")}
            title={t("Five steps from coordinates to an explained answer")}
            description={t(
              "Each step has a single owner in the codebase, so you can trace any number back to its source.",
            )}
          />
          <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="card relative flex flex-col p-5">
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded border border-forest-200 bg-forest-50 text-forest-700">
                  {step.icon}
                </span>
                <span className="absolute end-4 top-4 font-mono text-2xs text-muted">0{index + 1}</span>
                <h3 className="text-sm font-semibold">{t(step.title)}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{t(step.body)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 · Capabilities */}
      <section className="container-page py-16 sm:py-20">
        <SectionHeading
          eyebrow={t("Capabilities")}
          title={t("Built for one crop, designed for more")}
          description={t(
            "Wheat, potato and tomato ship with validated growth curves. Crops live in a registry so another crop can be added without touching the models.",
          )}
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((capability) => (
            <div key={capability.title} className="card card-pad flex flex-col">
              <div className="flex items-start justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded bg-forest-900 text-paper">
                  {capability.icon}
                </span>
                <StatusPill tone="neutral" dot={false}>
                  {t(capability.tag)}
                </StatusPill>
              </div>
              <h3 className="mt-4 text-base font-semibold">{t(capability.title)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(capability.body)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5 · NASA data */}
      <section id="data" className="border-y border-line bg-card">
        <div className="container-page py-16 sm:py-20">
          <SectionHeading
            eyebrow={t("NASA data")}
            title={t("Every dataset is named, classified and bounded")}
            description={t(
              "Satellite observation, reanalysis and estimated values are not the same thing. The interface labels which is which, with resolution and attribution.",
            )}
            actions={
              <a
                href="https://power.larc.nasa.gov/"
                target="_blank"
                rel="noreferrer noopener"
                className="btn-secondary btn-sm"
              >
                NASA POWER
              </a>
            }
          />
          <div className="mt-8 overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[720px] border-collapse bg-card text-start">
              <thead>
                <tr className="border-b border-line bg-sage-50">
                  <th className="table-cell font-mono text-2xs uppercase tracking-[0.08em] text-muted">
                    {t("Variable")}
                  </th>
                  <th className="table-cell font-mono text-2xs uppercase tracking-[0.08em] text-muted">
                    {t("Dataset")}
                  </th>
                  <th className="table-cell font-mono text-2xs uppercase tracking-[0.08em] text-muted">
                    {t("Nature")}
                  </th>
                  <th className="table-cell font-mono text-2xs uppercase tracking-[0.08em] text-muted">
                    {t("Resolution")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {DATA_ROWS.map((row) => (
                  <tr key={row.variable} className="align-top">
                    <td className="table-cell font-medium">{t(row.variable)}</td>
                    <td className="table-cell text-muted">{t(row.source)}</td>
                    <td className="table-cell text-muted">{t(row.nature)}</td>
                    <td className="table-cell font-mono text-xs text-muted">{t(row.resolution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <InfoNote title={t("A grid cell is not a field")} tone="warn">
              {t(
                "NASA POWER cells are roughly 50 km wide. Soil wetness and rainfall are regional context, not on-farm measurements. The platform says this on every analysis rather than implying precision it does not have.",
              )}
            </InfoNote>
            <InfoNote title={t("Not every value is a satellite pixel")} tone="info">
              {t(
                "Most climate variables come from the MERRA-2 reanalysis, which blends observations with a physical model. GIBS imagery is satellite-observed; NDVI and NDMI are computed from Sentinel-2 through Google Earth Engine.",
              )}
            </InfoNote>
          </div>
        </div>
      </section>

      {/* 6 · Scientific model */}
      <section id="method" className="container-page py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow={t("Scientific model")}
              title={t("FAO-56, not a black box")}
              description={t(
                "The irrigation module follows the dual-step FAO-56 approach: reference evapotranspiration, a crop coefficient that changes with growth stage, and a daily root-zone water balance.",
              )}
            />
            <div className="mt-6 space-y-3">
              <Formula
                name="Penman–Monteith reference ET₀"
                expression={
                  "ET₀ = [0.408 Δ (Rn − G) + γ (900/(T+273)) u₂ (es − ea)]\n      ÷ [Δ + γ (1 + 0.34 u₂)]"
                }
                variables={[
                  { symbol: "Rn", meaning: "net radiation (MJ m⁻² d⁻¹)" },
                  { symbol: "u₂", meaning: "wind speed at 2 m (m s⁻¹)" },
                  { symbol: "es − ea", meaning: "vapour pressure deficit (kPa)" },
                ]}
              />
              <Formula
                name="Crop ET and root-zone balance"
                expression={"ETc = Kc × ET₀\nDₜ = Dₜ₋₁ − (P − RO) − I + ETc + DP\nTAW = 1000 (θFC − θWP) Zr"}
                variables={[
                  { symbol: "D", meaning: "root-zone depletion (mm)" },
                  { symbol: "P, I", meaning: "precipitation, irrigation (mm)" },
                  { symbol: "RO, DP", meaning: "runoff, deep drainage (mm)" },
                  { symbol: "TAW", meaning: "total available water (mm)" },
                ]}
              />
            </div>
          </div>
          <div className="space-y-4">
            <KcCurve />
            <div className="card card-pad">
              <h3 className="text-sm font-semibold">
                {t("Demand classes have documented thresholds")}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {t(
                  "Depletion is compared with readily available water (RAW), recent rainfall and ETc. The result is one of three classes with the contributing factors attached — not a generated recommendation.",
                )}
              </p>
              <Link to="/fields/new" className="btn-secondary btn-sm mt-4">
                {t("Try it on a field")}
                <ArrowRightIcon size={14} />
              </Link>
            </div>
            <InfoNote title={t("What is assumed")} tone="neutral">
              {t(
                "Runoff is a simple coefficient, initial depletion is 50% of TAW at planting, and soil water capacity comes from a texture class you select. Each assumption is exposed in the irrigation view and can be improved with local data.",
              )}
            </InfoNote>
          </div>
        </div>
      </section>

      {/* 7 · AI */}
      <section id="ai" className="border-y border-line bg-[#0b1f17] text-[#f4faf6]">
        <div className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="eyebrow mb-3 text-[#8dbba1]">{t("AI assistant")}</p>
            <h2 className="text-3xl tracking-[-0.025em] text-[#f4faf6] sm:text-4xl">
              {t("The model explains.")}
              <br />
              {t("It never measures.")}
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#cfe3d7]/80">
              {t(
                "Questions are answered from a compact JSON context: latest climate values, computed ET₀/ETc, water balance, demand reasons, confidence and missing-data flags. The system prompt forbids outside data, invented numbers and prescriptive volumes.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {QUESTIONS.map((question) => (
                <span
                  key={question}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-[#e6f1ea]/90"
                >
                  “{t(question)}”
                </span>
              ))}
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-[#8dbba1]">
              <CpuIcon size={15} />
              {t("Works without an API key using a labelled rule-based fallback.")}
            </p>
          </div>
          <div className="rounded-card border border-white/15 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="font-mono text-2xs uppercase tracking-[0.14em] text-[#8dbba1]">
                {t("System prompt · excerpt")}
              </span>
              <span className="font-mono text-2xs text-[#6d9a80]">grounding=true</span>
            </div>
            <pre
              dir="ltr"
              className="mt-4 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#dcebe2]/85"
            >
{`You explain a crop field analysis (wheat, potato or tomato).

Rules:
1. Use ONLY values inside <field_context>.
2. Never invent, extrapolate or estimate a missing value.
3. If a value is null, say the data is unavailable.
4. Do not recommend an irrigation volume that is
   not present in the computed context.
5. Distinguish observed, estimated and calculated data.
6. Surface limitations and confidence, not just the class.`}
            </pre>
            <div
              dir="ltr"
              className="mt-4 rounded border border-white/10 bg-black/20 p-3 font-mono text-2xs leading-relaxed text-[#b9d6c6]"
            >
              <span className="text-[#6d9a80]">context_used →</span>{" "}
              {`{ "demand": "moderate", "et0_mm_day": 4.28, "kc": 1.12, "depletion_fraction": 0.63, "missing": [] }`}
            </div>
          </div>
        </div>
      </section>

      {/* 8 · CTA */}
      <section className="container-page py-16 sm:py-20">
        <div className="card relative overflow-hidden border-forest-200 bg-sage-50 px-6 py-12 sm:px-12">
          <div className="surface-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <p className="eyebrow mb-3">{t("Start small")}</p>
            <h2 className="text-3xl tracking-[-0.025em] sm:text-4xl">
              {t("One field is enough to begin.")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {t(
                "Set a location, a planting date and a soil texture. The platform handles the NASA request, QA, science and explanation. Add a boundary later when you have real survey data — never before.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/fields/new" className="btn-primary">
                <WheatIcon size={16} />
                {t("Create your first field")}
              </Link>
              <Link to="/fields" className="btn-secondary">
                {t("Browse fields")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
