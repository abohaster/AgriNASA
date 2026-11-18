import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type {
  DemoField,
  FarmerIntent,
  FarmerSummary,
  FarmerTimeline,
  FarmerWeather,
  FarmerForecast,
  FarmerOutlook,
  PlantingAssessment,
  PlantHealth,
  SoilAdvice,
  TimelineAction,
  TimelineRisk,
  TimelineStage,
  WeatherAdvice,
} from "../api/types";
import { FarmLayersMap } from "../components/data/FarmLayersMap";
import { FieldMap } from "../components/data/FieldMap";
import { InfoNote } from "../components/ui/InfoNote";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  DropIcon,
  HumidityIcon,
  InfoIcon,
  LeafIcon,
  MapPinIcon,
  RainIcon,
  SatelliteIcon,
  SoilIcon,
  ThermometerIcon,
  WheatIcon,
  WindIcon,
} from "../components/ui/Icons";
import { useDataMode } from "../context/DataModeContext";
import { useI18n } from "../i18n/I18nContext";
import { formatDate, formatDateShort, formatNumber } from "../lib/format";

const CROPS: { id: string; label: string }[] = [
  { id: "wheat", label: "Wheat" },
  { id: "maize", label: "Maize" },
  { id: "tomato", label: "Tomato" },
  { id: "potato", label: "Potato" },
  { id: "clover", label: "Egyptian clover (berseem)" },
  { id: "sugarcane", label: "Sugarcane" },
  { id: "cotton", label: "Cotton" },
  { id: "rice", label: "Rice" },
];

/** Approximate governorate capitals — the map pin is the precise location. */
const GOVERNORATES: { id: string; en: string; ar: string; lat: number; lon: number }[] = [
  { id: "cairo", en: "Cairo", ar: "القاهرة", lat: 30.0444, lon: 31.2357 },
  { id: "giza", en: "Giza", ar: "الجيزة", lat: 30.0131, lon: 31.2089 },
  { id: "alexandria", en: "Alexandria", ar: "الإسكندرية", lat: 31.2001, lon: 29.9187 },
  { id: "dakahlia", en: "Dakahlia", ar: "الدقهلية", lat: 31.0409, lon: 31.3785 },
  { id: "sharqia", en: "Sharqia", ar: "الشرقية", lat: 30.5877, lon: 31.502 },
  { id: "qalyubia", en: "Qalyubia", ar: "القليوبية", lat: 30.4667, lon: 31.1833 },
  { id: "kafr_el_sheikh", en: "Kafr El Sheikh", ar: "كفر الشيخ", lat: 31.1107, lon: 30.9388 },
  { id: "gharbia", en: "Gharbia", ar: "الغربية", lat: 30.7865, lon: 31.0004 },
  { id: "monufia", en: "Monufia", ar: "المنوفية", lat: 30.5526, lon: 30.9316 },
  { id: "beheira", en: "Beheira", ar: "البحيرة", lat: 31.0341, lon: 30.4682 },
  { id: "ismailia", en: "Ismailia", ar: "الإسماعيلية", lat: 30.5965, lon: 32.2715 },
  { id: "port_said", en: "Port Said", ar: "بورسعيد", lat: 31.2653, lon: 32.3019 },
  { id: "suez", en: "Suez", ar: "السويس", lat: 29.9668, lon: 32.5498 },
  { id: "north_sinai", en: "North Sinai", ar: "شمال سيناء", lat: 31.1316, lon: 33.7984 },
  { id: "south_sinai", en: "South Sinai", ar: "جنوب سيناء", lat: 28.241, lon: 33.6222 },
  { id: "damietta", en: "Damietta", ar: "دمياط", lat: 31.4165, lon: 31.8133 },
  { id: "fayoum", en: "Fayoum", ar: "الفيوم", lat: 29.3084, lon: 30.8428 },
  { id: "beni_suef", en: "Beni Suef", ar: "بني سويف", lat: 29.0661, lon: 31.0994 },
  { id: "minya", en: "Minya", ar: "المنيا", lat: 28.1099, lon: 30.7503 },
  { id: "asyut", en: "Asyut", ar: "أسيوط", lat: 27.1809, lon: 31.1837 },
  { id: "sohag", en: "Sohag", ar: "سوهاج", lat: 26.5591, lon: 31.6957 },
  { id: "qena", en: "Qena", ar: "قنا", lat: 26.1551, lon: 32.716 },
  { id: "luxor", en: "Luxor", ar: "الأقصر", lat: 25.6872, lon: 32.6396 },
  { id: "aswan", en: "Aswan", ar: "أسوان", lat: 24.0889, lon: 32.8998 },
  { id: "red_sea", en: "Red Sea", ar: "البحر الأحمر", lat: 27.2579, lon: 33.8116 },
  { id: "new_valley", en: "New Valley", ar: "الوادي الجديد", lat: 25.451, lon: 30.5464 },
  { id: "matrouh", en: "Matrouh", ar: "مطروح", lat: 31.3543, lon: 27.2373 },
];

type Tone = "good" | "warn" | "bad" | "info" | "neutral";

const TONE_STYLES: Record<
  Tone,
  { card: string; text: string; bar: string; chip: string; dot: string }
> = {
  good: {
    card: "border-forest-300 bg-forest-50",
    text: "text-forest-800",
    bar: "bg-forest-600",
    chip: "bg-forest-100 text-forest-800",
    dot: "bg-forest-600",
  },
  warn: {
    card: "border-clay-200 bg-clay-50",
    text: "text-clay-600",
    bar: "bg-clay-500",
    chip: "bg-clay-100 text-clay-600",
    dot: "bg-clay-500",
  },
  bad: {
    card: "border-[#e7c4bd] bg-[#fbf0ee] dark:border-[#6b3a32] dark:bg-[#2a1714]",
    text: "text-[#8a352a] dark:text-[#f0b0a3]",
    bar: "bg-[#b0523f]",
    chip: "bg-[#f4d9d2] text-[#8a352a] dark:bg-[#3a1f1a] dark:text-[#f0b0a3]",
    dot: "bg-[#b0523f]",
  },
  info: {
    card: "border-survey-200 bg-survey-50",
    text: "text-survey-700",
    bar: "bg-survey-500",
    chip: "bg-survey-100 text-survey-700",
    dot: "bg-survey-500",
  },
  neutral: {
    card: "border-line bg-sage-50",
    text: "text-muted",
    bar: "bg-sage-300",
    chip: "bg-sage-100 text-muted",
    dot: "bg-sage-300",
  },
};

type Point = {
  lat: number;
  lon: number;
  source: "gps" | "map" | "governorate" | "demo";
  governorateId?: string;
  demoFieldId?: string;
};

function monthName(month: number, arabic: boolean): string {
  return new Date(2026, month - 1, 1).toLocaleDateString(arabic ? "ar-EG" : "en-GB", {
    month: "long",
  });
}

function TrafficDots({ tone }: { tone: Tone }) {
  const active = tone === "good" ? 2 : tone === "warn" ? 1 : tone === "bad" ? 0 : -1;
  const dots = ["bg-[#b0523f]", "bg-clay-500", "bg-forest-600"];
  return (
    <span className="inline-flex flex-col gap-1 rounded-full bg-ink/85 p-1.5" aria-hidden="true">
      {dots.map((color, index) => (
        <span
          key={color}
          className={`h-3 w-3 rounded-full ${active === index ? color : "bg-white/20"}`}
        />
      ))}
    </span>
  );
}

function BigGauge({ percent, tone }: { percent: number; tone: Tone }) {
  const styles = TONE_STYLES[tone];
  return (
    <div>
      <p className={`text-5xl font-bold tabular-nums sm:text-6xl ${styles.text}`} dir="ltr">
        {percent}%
      </p>
      <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-white/80 dark:bg-black/25">
        <div
          className={`h-full rounded-full transition-all duration-500 ${styles.bar}`}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

const WEATHER_ADVICE_LABEL: Record<WeatherAdvice, string> = {
  irrigate_early_morning: "Irrigate early in the morning to reduce evaporation.",
  protect_from_frost: "Protect seedlings from frost overnight.",
  hold_irrigation_rain: "Hold irrigation if the expected rain is enough.",
  avoid_spraying_wind: "Delay spraying or foliar feeding while the wind is strong.",
  good_growing_weather: "The weather is suitable for farm work.",
};

const SOIL_ADVICE_LABEL: Record<SoilAdvice, string> = {
  irrigate_today: "The soil is dry — irrigation is advised today.",
  no_irrigation_today: "The soil is moist — no irrigation is needed today.",
  check_soil_moisture: "No recent soil reading — check the soil by hand.",
  irrigate_before_planting: "A light irrigation before sowing is advised.",
  wait_for_soil_to_dry: "Wait for the soil to drain a little before sowing.",
  ready_to_plant: "Soil moisture is suitable for sowing.",
};

const OUTLOOK_LABEL: Record<FarmerOutlook["headline"], string> = {
  heat: "A hot spell is expected",
  frost: "Frost risk is expected",
  rain: "Rain is expected",
  wind: "Strong wind is expected",
  stable: "Stable, suitable weather",
  unknown: "The forecast is unavailable",
};

const OUTLOOK_TONE: Record<FarmerOutlook["headline"], Tone> = {
  heat: "bad",
  frost: "bad",
  rain: "info",
  wind: "warn",
  stable: "good",
  unknown: "neutral",
};

const HEALTH_LABEL: Record<PlantHealth["rating"], string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair — needs follow-up",
  weak: "Weak — needs follow-up",
  poor: "Very weak",
  unknown: "Not available",
};

const HEALTH_SENTENCE: Record<PlantHealth["rating"], string> = {
  excellent: "The crop looks in excellent condition in the latest image.",
  good: "The crop looks in good condition.",
  fair: "Condition is moderate — keep an eye on the crop during the coming days.",
  weak: "Condition is weak — check irrigation and the crop in the field.",
  poor: "Condition is very weak — review the crop with an agronomist.",
  unknown: "",
};

const HEALTH_TONE: Record<PlantHealth["rating"], Tone> = {
  excellent: "good",
  good: "good",
  fair: "warn",
  weak: "bad",
  poor: "bad",
  unknown: "neutral",
};

const VERDICT_LABEL: Record<PlantingAssessment["verdict"], string> = {
  suitable: "Suitable for planting now",
  marginal: "Suitable with caution",
  not_suitable: "Not suitable right now",
  unknown: "Cannot be assessed right now",
};

const VERDICT_TONE: Record<PlantingAssessment["verdict"], Tone> = {
  suitable: "good",
  marginal: "warn",
  not_suitable: "bad",
  unknown: "neutral",
};

const SOIL_CATEGORY_LABEL: Record<string, string> = {
  near_normal: "Moisture is in the suitable range",
  dry: "Dry",
  wet: "Very wet",
  unknown: "Not available",
};

const STAGE_LABEL: Record<TimelineStage, string> = {
  pre_planting: "Before planting / land preparation",
  early_growth: "Planted a few days ago",
  established: "Established crop",
};

const STAGE_SENTENCE: Record<TimelineStage, string> = {
  pre_planting: "This is what matters in the week before sowing.",
  early_growth: "This is what matters during germination and the first weeks.",
  established: "The crop is past the seedling stage; keep monitoring it.",
};

const RISK_LABEL: Record<TimelineRisk, string> = {
  dry_seedbed: "The seedbed looks dry — seeds may not get enough moisture to germinate.",
  wet_seedbed: "The surface is very wet; waterlogging can harm seeds and young roots.",
  rain_crusting: "Rain is expected and can form a crust that blocks seedling emergence.",
  heat_stress: "High temperatures are expected and can stress the crop.",
  frost: "Cold nights are expected and can damage young plants.",
  wind_damage: "Strong wind is expected and can damage seedlings or dry the surface.",
  canopy_stress: "The latest satellite image shows weak canopy condition.",
  past_emergence_window: "The expected emergence window has passed — check the stand in the field.",
};

const ACTION_LABEL: Record<TimelineAction, string> = {
  prepare_seedbed: "Prepare a fine, level seedbed with tillage before sowing.",
  pre_irrigate: "The soil is dry — irrigate lightly before sowing to settle the seedbed.",
  wait_for_drain: "Wait for the soil to drain before sowing.",
  sow_now: "Conditions are suitable — sow inside the recommended window.",
  sow_at_depth: "Sow at the recommended depth for this crop.",
  apply_basal_fertiliser: "Apply the basal fertiliser at sowing according to a soil test or extension advice.",
  irrigate_early_morning: "If irrigation is needed, apply it early in the morning.",
  hold_irrigation_rain: "Hold irrigation if the expected rain is enough.",
  monitor_seedbed: "Check seedbed moisture by hand every day until emergence.",
  light_irrigation: "Give a light irrigation to keep the seedbed moist without flooding.",
  avoid_irrigation: "Do not irrigate until the surface drains; excess water can rot the seed.",
  check_emergence: "Check the field for emergence during the expected window.",
  protect_young_roots: "Avoid deep hoeing or machinery over the rows to protect young roots.",
  scout_weeds: "Check for early weeds competing with the seedlings.",
  scout_pests: "Inspect for early pests such as cutworm or aphids; ask an agronomist if unsure.",
  monitor_crop: "Keep monitoring the crop and soil every few days.",
  protect_from_frost: "Protect the crop from frost overnight.",
  plant_tubers: "Plant certified seed tubers in ridges; plant whole tubers rather than cut ones.",
  harden_transplants: "Harden the seedlings for a few days before moving them to the field.",
  transplant_seedlings: "Transplant the seedlings at the recommended spacing when conditions are suitable.",
  check_transplants: "Check the transplants for wilting or gaps and replace missing plants.",
  earth_up_ridges: "Earth up the ridges around the stems to protect the developing tubers.",
  stake_plants: "Stake or trellis the plants so the growing stems stay off the ground.",
};

const DAY_PRESETS: { days: number | null; label: string }[] = [
  { days: 3, label: "3 days ago" },
  { days: 7, label: "About a week ago" },
  { days: 14, label: "About two weeks ago" },
  { days: null, label: "More than three weeks ago" },
];

function TimelineBlock({ timeline }: { timeline: FarmerTimeline }) {
  const { t } = useI18n();
  const depthText = (() => {
    if (timeline.seed_depth_cm_min === null || timeline.seed_depth_cm_max === null) {
      return t(ACTION_LABEL.sow_at_depth);
    }
    return t("Plant at a depth of {min}–{max} cm for this crop.", {
      min: formatNumber(timeline.seed_depth_cm_min, 0),
      max: formatNumber(timeline.seed_depth_cm_max, 0),
    });
  })();

  return (
    <section className="card card-pad">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <SatelliteIcon size={18} />
        {t("Timeline guidance")}
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-forest-100 px-2.5 py-1 text-xs font-semibold text-forest-800 dark:bg-forest-900/40 dark:text-forest-100">
          {t(STAGE_LABEL[timeline.stage])}
        </span>
        {timeline.planting_date && timeline.days_since_planting !== null && (
          <span className="text-xs text-muted">
            {t("Planted on {date} · day {n}", {
              date: formatDate(timeline.planting_date),
              n: timeline.days_since_planting,
            })}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{t(STAGE_SENTENCE[timeline.stage])}</p>

      {timeline.emergence_from && timeline.emergence_to && (
        <div className="mt-3 rounded-md border border-line bg-sage-50 px-3.5 py-3">
          <p className="text-sm font-semibold text-ink">{t("Expected emergence window")}</p>
          <p className="mt-0.5 text-sm text-muted" dir="ltr">
            {formatDate(timeline.emergence_from)} – {formatDate(timeline.emergence_to)}
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-line bg-paper px-3.5 py-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <AlertIcon size={16} />
            {t("What you should know")}
          </h4>
          {timeline.risks.length === 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t("No specific risk is flagged for the coming days.")}
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink/85">
              {timeline.risks.map((code) => (
                <li key={code} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay-500" />
                  {t(RISK_LABEL[code])}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-md border border-forest-200 bg-forest-50/60 px-3.5 py-3 dark:border-forest-800 dark:bg-forest-900/20">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-forest-800 dark:text-forest-100">
            <CheckIcon size={16} />
            {t("What to do")}
          </h4>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink/85">
            {timeline.actions.map((code) => (
              <li key={code} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" />
                {code === "sow_at_depth" ? depthText : t(ACTION_LABEL[code])}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function WeatherTiles({ weather }: { weather: FarmerWeather }) {
  const { t } = useI18n();
  if (!weather.available) {
    return <InfoNote title={t("Weather today")}>{t("Weather data is not available right now.")}</InfoNote>;
  }
  const tiles = [
    {
      icon: <ThermometerIcon size={18} />,
      label: t("Temperature"),
      value:
        weather.temperature_mean_c !== null
          ? `${formatNumber(weather.temperature_mean_c)}°`
          : "—",
      sub:
        weather.temperature_min_c !== null && weather.temperature_max_c !== null
          ? `${formatNumber(weather.temperature_min_c, 0)}° – ${formatNumber(weather.temperature_max_c, 0)}°`
          : null,
    },
    {
      icon: <HumidityIcon size={18} />,
      label: t("Humidity"),
      value: weather.humidity_pct !== null ? `${formatNumber(weather.humidity_pct, 0)}%` : "—",
      sub: null,
    },
    {
      icon: <WindIcon size={18} />,
      label: t("Wind"),
      value: weather.wind_ms !== null ? `${formatNumber(weather.wind_ms)} m/s` : "—",
      sub: null,
    },
    {
      icon: <RainIcon size={18} />,
      label: t("Rainfall"),
      value: weather.rain_mm !== null ? `${formatNumber(weather.rain_mm)} mm` : "—",
      sub: null,
    },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-md border border-line bg-paper px-3 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              {tile.icon}
              {tile.label}
            </p>
            <p className="mt-1 text-xl font-semibold text-ink">{tile.value}</p>
            {tile.sub && <p className="mt-0.5 text-2xs text-muted">{tile.sub}</p>}
          </div>
        ))}
      </div>
      {weather.date && (
        <p className="mt-2 text-2xs text-muted">
          {t("Observed by NASA POWER on {date}", { date: formatDate(weather.date) })}
        </p>
      )}
    </div>
  );
}

function ForecastBlock({
  forecast,
  outlook,
}: {
  forecast: FarmerForecast;
  outlook: FarmerOutlook;
}) {
  const { t, lang } = useI18n();
  if (!forecast.available || !outlook.available) {
    return (
      <InfoNote title={t("Forecast and advice")}>
        {t("No weather forecast is available right now. Today's conditions are shown above.")}
      </InfoNote>
    );
  }
  const tone = OUTLOOK_TONE[outlook.headline];
  const styles = TONE_STYLES[tone];
  return (
    <div className="space-y-3">
      <div className={`rounded-md border px-3.5 py-3 ${styles.card}`}>
        <p className={`flex items-center gap-2 text-sm font-semibold ${styles.text}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} aria-hidden="true" />
          {t(OUTLOOK_LABEL[outlook.headline])}
        </p>
        <ul className="mt-2 space-y-1 text-sm leading-relaxed">
          {outlook.advice.map((code) => (
            <li key={code} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
              {t(WEATHER_ADVICE_LABEL[code])}
            </li>
          ))}
        </ul>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <div className="flex min-w-[22rem] gap-2">
          {forecast.days.map((day) => (
            <div
              key={day.date}
              className="flex-1 rounded-md border border-line bg-paper px-2.5 py-2 text-center"
            >
              <p className="text-2xs text-muted">{formatDateShort(day.date)}</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {day.temperature_max_c !== null ? `${formatNumber(day.temperature_max_c, 0)}°` : "—"}
              </p>
              {day.rain_mm !== null && day.rain_mm >= 0.1 ? (
                <p className="mt-0.5 text-2xs text-survey-600">{formatNumber(day.rain_mm)} mm</p>
              ) : (
                <p className="mt-0.5 text-2xs text-muted">{lang === "ar" ? "بدون أمطار" : "dry"}</p>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="text-2xs text-muted">{t("Forecast from Open-Meteo, not from NASA POWER.")}</p>
    </div>
  );
}

function PlantingResult({ summary }: { summary: FarmerSummary }) {
  const { t, lang } = useI18n();
  const planting = summary.planting;
  if (!planting) return null;
  const tone = VERDICT_TONE[planting.verdict];
  const styles = TONE_STYLES[tone];
  const arabic = lang === "ar";
  const cropName = t(CROPS.find((crop) => crop.id === summary.crop.id)?.label ?? summary.crop.name);
  const idealMonths = summary.crop.ideal_planting_months
    .map((month) => monthName(month, arabic))
    .join(arabic ? "، " : ", ");
  const monthText = monthName(planting.month, arabic);
  const temp = planting.current_temperature_c;

  const reasonText = (() => {
    switch (planting.primary_reason) {
      case "in_ideal_season":
        return t("{month} is the best month to plant {crop} in Egypt.", { month: monthText, crop: cropName });
      case "acceptable_season":
        return t("{month} is an acceptable planting month for {crop}; the best is {months}.", {
          month: monthText,
          crop: cropName,
          months: idealMonths,
        });
      case "outside_planting_season":
        return t("{month} is outside the usual planting window for {crop} in Egypt ({months}).", {
          month: monthText,
          crop: cropName,
          months: idealMonths,
        });
      case "temperature_too_hot":
        return t("Today's mean temperature, {temp}°, is above the suitable range ({min}–{max}°).", {
          temp: formatNumber(temp),
          min: formatNumber(summary.crop.optimal_temp_min_c, 0),
          max: formatNumber(summary.crop.optimal_temp_max_c, 0),
        });
      case "temperature_too_cold":
        return t("Today's mean temperature, {temp}°, is below the suitable range ({min}–{max}°).", {
          temp: formatNumber(temp),
          min: formatNumber(summary.crop.optimal_temp_min_c, 0),
          max: formatNumber(summary.crop.optimal_temp_max_c, 0),
        });
      case "temperature_ideal":
        return t("Today's mean temperature, {temp}°, is inside the suitable range ({min}–{max}°).", {
          temp: formatNumber(temp),
          min: formatNumber(summary.crop.optimal_temp_min_c, 0),
          max: formatNumber(summary.crop.optimal_temp_max_c, 0),
        });
      case "soil_ready":
        return t("The radar reading shows soil moisture in the suitable range for sowing.");
      case "soil_dry":
        return t("The surface looks dry; a light irrigation before sowing is advised.");
      case "soil_saturated":
        return t("The surface looks saturated; wait for it to drain before sowing.");
      case "satellite_unavailable":
        return t(
          "No recent radar reading of the soil is available, so this result rests on month and temperature.",
        );
      default:
        return t("No recent weather is available, so a readiness percentage cannot be computed.");
    }
  })();

  return (
    <div className="space-y-4">
      <div className={`rounded-card border p-5 ${styles.card}`}>
        <div className="flex items-start gap-4">
          <TrafficDots tone={tone} />
          <div className="min-w-0 flex-1">
            <p className={`text-lg font-bold sm:text-xl ${styles.text}`}>
              {t(VERDICT_LABEL[planting.verdict])}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink/85">{reasonText}</p>
          </div>
        </div>
        {planting.readiness_percent !== null ? (
          <div className="mt-5">
            <BigGauge percent={planting.readiness_percent} tone={tone} />
            <p className="mt-2 text-sm font-medium text-muted">{t("Planting suitability")}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">{t("A percentage cannot be computed without recent weather.")}</p>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <div className="card px-3.5 py-3">
          <p className="text-xs font-medium text-muted">{t("Month")}</p>
          <p className="mt-1 text-base font-semibold text-ink">{monthName(planting.month, arabic)}</p>
          <p className="mt-0.5 text-2xs text-muted">
            {t("Best planting months")}: {idealMonths}
          </p>
        </div>
        <div className="card px-3.5 py-3">
          <p className="text-xs font-medium text-muted">{t("Suitable temperature")}</p>
          <p className="mt-1 text-base font-semibold text-ink" dir="ltr">
            {formatNumber(summary.crop.optimal_temp_min_c, 0)}° – {formatNumber(summary.crop.optimal_temp_max_c, 0)}°
          </p>
          <p className="mt-0.5 text-2xs text-muted">
            {temp !== null ? t("Today: {temp}°", { temp: formatNumber(temp) }) : t("Not available")}
          </p>
        </div>
        <div className="card px-3.5 py-3">
          <p className="text-xs font-medium text-muted">{t("Soil moisture")}</p>
          <p className="mt-1 flex items-center gap-1.5 text-base font-semibold text-ink">
            <SoilIcon size={16} />
            {t(SOIL_CATEGORY_LABEL[summary.soil.category] ?? summary.soil.category)}
          </p>
          <p className="mt-0.5 text-2xs text-muted">{t(SOIL_ADVICE_LABEL[summary.soil.advice])}</p>
        </div>
      </div>

      <section className="card card-pad">
        <h3 className="text-base font-semibold">{t("Weather today")}</h3>
        <div className="mt-3">
          <WeatherTiles weather={summary.weather} />
        </div>
      </section>

      <section className="card card-pad">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <SatelliteIcon size={18} />
          {t("Forecast and advice")}
        </h3>
        <div className="mt-3">
          <ForecastBlock forecast={summary.forecast} outlook={summary.outlook} />
        </div>
      </section>
    </div>
  );
}

function PlantedResult({ summary }: { summary: FarmerSummary }) {
  const { t } = useI18n();
  const health = summary.health;
  if (!health) return null;
  const tone = HEALTH_TONE[health.rating];
  const styles = TONE_STYLES[tone];

  const healthReason = (() => {
    switch (health.reason_code) {
      case "satellite_not_configured":
        return t("Satellite imagery is not enabled on this server.");
      case "satellite_unavailable":
        return t("A recent satellite image could not be retrieved. Try again a little later.");
      case "no_recent_image":
        return t("There is no recent cloud-free image for this location.");
      default:
        return "";
    }
  })();

  return (
    <div className="space-y-4">
      <div className={`rounded-card border p-5 ${styles.card}`}>
        <div className="flex items-start gap-4">
          <TrafficDots tone={tone} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium text-muted">
              <LeafIcon size={16} />
              {t("Crop health")}
            </p>
            <p className={`mt-1 text-lg font-bold sm:text-xl ${styles.text}`}>
              {t(HEALTH_LABEL[health.rating])}
            </p>
            {health.available && <p className="mt-1 text-sm leading-relaxed text-ink/85">{t(HEALTH_SENTENCE[health.rating])}</p>}
          </div>
        </div>
        {health.available && health.percent !== null ? (
          <div className="mt-5">
            <BigGauge percent={health.percent} tone={tone} />
            <p className="mt-2 text-sm font-medium text-muted">{t("Crop health score")}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink/85">{healthReason}</p>
        )}
        {health.available && health.acquisition_date && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <SatelliteIcon size={14} />
            {t("Last satellite image")}: {formatDate(health.acquisition_date)}
          </p>
        )}
      </div>

      <div className="card card-pad">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <DropIcon size={18} />
          {t("Soil moisture")}
        </h3>
        <p className="mt-2 text-lg font-semibold">
          {t(SOIL_CATEGORY_LABEL[summary.soil.category] ?? summary.soil.category)}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{t(SOIL_ADVICE_LABEL[summary.soil.advice])}</p>
        {summary.soil.acquisition_date && (
          <p className="mt-2 text-2xs text-muted">
            {t("Radar reading on {date}", { date: formatDate(summary.soil.acquisition_date) })}
          </p>
        )}
      </div>

      <section className="card card-pad">
        <h3 className="text-base font-semibold">{t("Weather today")}</h3>
        <div className="mt-3">
          <WeatherTiles weather={summary.weather} />
        </div>
      </section>

      <section className="card card-pad">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ThermometerIcon size={18} />
          {t("Forecast and advice")}
        </h3>
        <div className="mt-3">
          <ForecastBlock forecast={summary.forecast} outlook={summary.outlook} />
        </div>
      </section>
    </div>
  );
}

export function FarmerGuidePage() {
  const { t, lang } = useI18n();
  const { isDemo, toggleDemo } = useDataMode();

  const [point, setPoint] = useState<Point | null>(null);
  const [governorateId, setGovernorateId] = useState("");
  const [cropId, setCropId] = useState("wheat");
  const [intent, setIntent] = useState<FarmerIntent | null>(null);
  const [daysSince, setDaysSince] = useState<number | null>(7);
  const [geometry, setGeometry] = useState<Record<string, unknown> | null>(null);
  const [resultGeometry, setResultGeometry] = useState<Record<string, unknown> | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FarmerSummary | null>(null);
  const [demoFields, setDemoFields] = useState<DemoField[]>([]);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const locationLabel = useMemo(() => {
    if (!point) return "";
    if (point.source === "gps") return t("My current location");
    if (point.source === "demo") {
      const demo = demoFields.find((item) => item.id === point.demoFieldId);
      return demo ? (lang === "ar" ? demo.name_ar : demo.name) : "";
    }
    if (point.source === "map") return t("Selected point on the map");
    const governorate = GOVERNORATES.find((item) => item.id === point.governorateId);
    return governorate ? (lang === "ar" ? governorate.ar : governorate.en) : "";
    // t changes with language; include it so the label follows the toggle.
  }, [point, t, lang, demoFields]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .farmerDemoFields(controller.signal)
      .then((fields) => setDemoFields(fields))
      .catch(() => setDemoFields([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!result) return;
    document.getElementById("farmer-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  function clearDemoSelection() {
    setActiveDemo(null);
    setGeometry(null);
    setPoint((current) =>
      current && current.source === "demo" ? { ...current, source: "map" } : current,
    );
  }

  async function runSummary(args: {
    latitude: number;
    longitude: number;
    crop_id: string;
    intent: FarmerIntent;
    days_since_planting: number | null;
    geometry: Record<string, unknown> | null;
  }) {
    setError(null);
    setSubmitting(true);
    try {
      const summary = await api.farmerSummary(
        {
          latitude: args.latitude,
          longitude: args.longitude,
          crop_id: args.crop_id,
          intent: args.intent,
          days_since_planting:
            args.intent === "already_planted" ? args.days_since_planting : null,
          geometry: args.geometry,
        },
        { mode: isDemo ? "demo" : "live" },
      );
      setResultGeometry(args.geometry);
      setResult(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("The check could not be completed."));
    } finally {
      setSubmitting(false);
    }
  }

  function applyDemo(field: DemoField) {
    setPoint({
      lat: field.latitude,
      lon: field.longitude,
      source: "demo",
      demoFieldId: field.id,
    });
    setGovernorateId("");
    setGeometry(field.geometry);
    setCropId(field.crop_id);
    setIntent(field.intent);
    setDaysSince(field.days_since_planting ?? 7);
    setActiveDemo(field.id);
    void runSummary({
      latitude: field.latitude,
      longitude: field.longitude,
      crop_id: field.crop_id,
      intent: field.intent,
      days_since_planting: field.days_since_planting ?? 7,
      geometry: field.geometry,
    });
  }

  function useMyLocation() {
    setError(null);
    clearDemoSelection();
    if (!navigator.geolocation) {
      setError(t("This browser does not support location."));
      return;
    }
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPoint({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          source: "gps",
        });
        setGovernorateId("");
        setGpsState("idle");
      },
      () => {
        setGpsState("idle");
        setError(t("Location permission was denied. Choose a governorate or tap the map."));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function handleSubmit() {
    setError(null);
    if (!point) {
      setError(t("Select your farm location first."));
      return;
    }
    if (!intent) {
      setError(t("Choose whether you want to plant now or the crop is already planted."));
      return;
    }
    await runSummary({
      latitude: point.lat,
      longitude: point.lon,
      crop_id: cropId,
      intent,
      days_since_planting: daysSince,
      geometry,
    });
  }

  const mapLat = point?.lat ?? 26.8;
  const mapLon = point?.lon ?? 30.8;
  const cropName = t(CROPS.find((crop) => crop.id === cropId)?.label ?? "Wheat");

  return (
    <div className="container-narrow py-8 sm:py-10">
      <header>
        <p className="eyebrow">{t("Simple farmer guide")}</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">{t("Check your farm in one minute")}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          {t(
            "Choose your farm, your crop and your situation. We show clear percentages and advice from satellite and weather data — without technical terms.",
          )}
        </p>
      </header>

      {isDemo && (
        <InfoNote title={t("Demo mode is on")} tone="warn" className="mt-5">
          <p>{t("This page needs live satellite and weather data.")}</p>
          <button type="button" onClick={toggleDemo} className="btn-secondary btn-sm mt-2">
            {t("Switch to live data")}
          </button>
        </InfoNote>
      )}

      {demoFields.length > 0 && (
        <section className="card card-pad mt-5 border-forest-200 bg-forest-50/50 dark:border-forest-800 dark:bg-forest-900/20">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <SatelliteIcon size={20} />
            {t("Try a real example field")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {t("Tap one of these real locations to run the full satellite and weather check instantly.")}
          </p>
          <div className="mt-3 grid gap-2.5">
            {demoFields.map((field) => {
              const selected = activeDemo === field.id;
              return (
                <button
                  key={field.id}
                  type="button"
                  disabled={submitting}
                  aria-pressed={selected}
                  onClick={() => applyDemo(field)}
                  className={`flex w-full items-start gap-3 rounded-card border-2 p-3 text-start transition-colors ${
                    selected
                      ? "border-forest-600 bg-paper"
                      : "border-line bg-paper/80 hover:border-forest-300"
                  } disabled:cursor-wait disabled:opacity-70`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      selected ? "bg-forest-700 text-paper" : "bg-sage-100 text-forest-700"
                    }`}
                  >
                    <LeafIcon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {lang === "ar" ? field.name_ar : field.name}
                    </span>
                    <span className="mt-0.5 block text-2xs leading-relaxed text-muted">
                      {lang === "ar" ? field.description_ar : field.description}
                    </span>
                  </span>
                  <span className="ms-auto shrink-0 rounded-full bg-sage-100 px-2 py-0.5 text-2xs font-medium text-muted">
                    {field.intent === "plant_now" ? t("Preparing to plant") : t("Already planted")}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-6 space-y-4">
        {/* 1 — location */}
        <section className="card card-pad">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-800 text-sm font-bold text-paper">
              1
            </span>
            <MapPinIcon size={20} />
            {t("Where is your farm?")}
          </h2>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={gpsState === "loading"}
            className="btn-primary mt-4 w-full py-3.5 text-base"
          >
            <MapPinIcon size={18} />
            {gpsState === "loading" ? t("Finding your location…") : t("Use my current location")}
          </button>

          <div className="mt-4">
            <label htmlFor="governorate" className="field-label text-sm">
              {t("Or choose your governorate")}
            </label>
            <select
              id="governorate"
              className="input text-base"
              value={governorateId}
              onChange={(event) => {
                const value = event.target.value;
                setGovernorateId(value);
                setError(null);
                clearDemoSelection();
                const governorate = GOVERNORATES.find((item) => item.id === value);
                if (governorate) {
                  setPoint({
                    lat: governorate.lat,
                    lon: governorate.lon,
                    source: "governorate",
                    governorateId: governorate.id,
                  });
                } else {
                  setPoint(null);
                }
              }}
            >
              <option value="">{t("Choose a governorate…")}</option>
              {GOVERNORATES.map((governorate) => (
                <option key={governorate.id} value={governorate.id}>
                  {lang === "ar" ? governorate.ar : governorate.en}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-2xs leading-relaxed text-muted">
              {t("The governorate pin is approximate. Move it on the map for your exact farm.")}
            </p>
          </div>

          <div className="mt-4">
            <FieldMap
              latitude={mapLat}
              longitude={mapLon}
              label={locationLabel || t("Farm location")}
              showMarker={Boolean(point)}
              height={240}
              zoom={point ? 11 : 6}
              onPick={(lat, lon) => {
                clearDemoSelection();
                setPoint({ lat, lon, source: "map" });
                setGovernorateId("");
                setError(null);
              }}
            />
            <p className="mt-1.5 text-2xs leading-relaxed text-muted">
              {t("Tap the map to place the farm pin.")}
            </p>
          </div>

          {point && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <CheckIcon size={14} />
              <span className="font-medium text-ink">{locationLabel}</span>
              <span className="font-mono text-2xs" dir="ltr">
                {point.lat.toFixed(4)}, {point.lon.toFixed(4)}
              </span>
            </p>
          )}
          <p className="mt-2 text-2xs leading-relaxed text-muted">
            {t("Your location is used only for this analysis and is not saved by this page.")}
          </p>
        </section>

        {/* 2 — crop */}
        <section className="card card-pad">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-800 text-sm font-bold text-paper">
              2
            </span>
            <WheatIcon size={20} />
            {t("Which crop?")}
          </h2>
          <label htmlFor="crop" className="field-label mt-4 text-sm">
            {t("Crop")}
          </label>
          <select
            id="crop"
            className="input text-base"
            value={cropId}
            onChange={(event) => {
              setCropId(event.target.value);
              setResult(null);
            }}
          >
            {CROPS.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {t(crop.label)}
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-muted">{cropName}</p>
        </section>

        {/* 3 — situation */}
        <section className="card card-pad">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-800 text-sm font-bold text-paper">
              3
            </span>
            <LeafIcon size={20} />
            {t("What is your situation?")}
          </h2>
          <div className="mt-4 grid gap-3">
            {(
              [
                {
                  value: "plant_now" as const,
                  title: "I want to plant now",
                  note: "We check the month, the weather and the soil before sowing.",
                  icon: <WheatIcon size={24} />,
                },
                {
                  value: "already_planted" as const,
                  title: "The crop is already planted",
                  note: "We check crop health, soil moisture and the weather.",
                  icon: <LeafIcon size={24} />,
                },
              ] as const
            ).map((option) => {
              const selected = intent === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setIntent(option.value);
                    if (option.value === "already_planted" && daysSince === null) {
                      setDaysSince(7);
                    }
                    setResult(null);
                    setError(null);
                  }}
                  className={`flex w-full items-start gap-3 rounded-card border-2 p-4 text-start transition-colors ${
                    selected
                      ? "border-forest-600 bg-forest-50"
                      : "border-line bg-card hover:border-forest-300"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                      selected ? "bg-forest-700 text-paper" : "bg-sage-100 text-forest-700"
                    }`}
                  >
                    {option.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-ink">{t(option.title)}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-muted">{t(option.note)}</span>
                  </span>
                  {selected && <CheckIcon size={18} className="ms-auto mt-1 shrink-0 text-forest-700" />}
                </button>
              );
            })}
          </div>

          {intent === "already_planted" && (
            <div className="mt-4 rounded-md border border-line bg-sage-50 px-3 py-3">
              <p className="text-sm font-medium text-ink">{t("When did you plant?")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAY_PRESETS.map((preset) => {
                  const selected = daysSince === preset.days;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setDaysSince(preset.days);
                        setResult(null);
                        setError(null);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? "border-forest-600 bg-forest-700 text-paper"
                          : "border-line bg-paper text-ink hover:border-forest-300"
                      }`}
                    >
                      {t(preset.label)}
                    </button>
                  );
                })}
              </div>
              {daysSince === null && (
                <p className="mt-2 text-2xs leading-relaxed text-muted">
                  {t("With this choice the crop is treated as past the seedling stage.")}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-md border border-[#e7c4bd] bg-[#fbf0ee] px-3 py-2 text-sm text-[#8a352a] dark:border-[#6b3a32] dark:bg-[#2a1714] dark:text-[#f0b0a3]" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="btn-primary mt-4 w-full py-3.5 text-base"
          >
            {submitting ? t("Checking your farm…") : t("Show result")}
            {!submitting && <ArrowRightIcon size={18} className="rtl:-scale-x-90" />}
          </button>
        </section>
      </div>

      {result && (
        <section id="farmer-result" className="mt-8 scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-card px-4 py-3">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
                {t("Result")}
              </p>
              <p className="text-base font-semibold text-ink">
                {t(CROPS.find((crop) => crop.id === result.crop.id)?.label ?? result.crop.name)}
                {locationLabel ? ` · ${locationLabel}` : ""}
              </p>
            </div>
            <p className="text-xs text-muted">
              {t("Assessed on {date}", { date: formatDate(result.assessed_on) })}
            </p>
          </div>

          {!result.available ? (
            <InfoNote title={t("Result unavailable")} tone="warn">
              <p>{t("This page needs live satellite and weather data, and demo mode cannot describe today's field.")}</p>
              {result.is_demo && (
                <button type="button" onClick={toggleDemo} className="btn-secondary btn-sm mt-2">
                  {t("Switch to live data")}
                </button>
              )}
            </InfoNote>
          ) : result.intent === "plant_now" ? (
            <PlantingResult summary={result} />
          ) : (
            <PlantedResult summary={result} />
          )}

          {result.available && result.timeline && (
            <div className="mt-4">
              <TimelineBlock timeline={result.timeline} />
            </div>
          )}

          {result.available && (
            <section className="card card-pad mt-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <SatelliteIcon size={18} />
                {t("Satellite map")}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {t("Switch between vegetation health, soil moisture and the natural-colour image.")}
              </p>
              <div className="mt-3">
                <FarmLayersMap
                  latitude={result.latitude}
                  longitude={result.longitude}
                  tiles={result.tiles}
                  boundary={resultGeometry}
                  label={locationLabel || t("Farm location")}
                  height={300}
                />
              </div>
            </section>
          )}

          {result.available && result.corrections.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-clay-200 bg-clay-50 px-3.5 py-3 text-2xs leading-relaxed text-clay-600">
              <AlertIcon size={14} className="mt-0.5 shrink-0" />
              <p>
                {t("Some readings were automatically corrected before display ({n}).", {
                  n: String(result.corrections.length),
                })}
              </p>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-md border border-line bg-sage-50 px-3.5 py-3 text-2xs leading-relaxed text-muted">
            <InfoIcon size={14} className="mt-0.5 shrink-0" />
            <p>
              {t(
                "These numbers are descriptive scores from satellite and weather data. They do not diagnose disease, do not predict yield and do not replace field inspection.",
              )}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/fields/new" className="btn-secondary btn-sm">
              {t("Open the detailed dashboard")}
            </Link>
            <Link to="/guide" className="btn-secondary btn-sm">
              {t("Guide")}
            </Link>
          </div>
        </section>
      )}

      <div className="mt-8 flex items-center gap-2 text-2xs text-muted">
        <AlertIcon size={14} />
        {t("Satellite data: Copernicus Sentinel-1/2 via Google Earth Engine. Weather: NASA POWER and Open-Meteo.")}
      </div>
    </div>
  );
}
