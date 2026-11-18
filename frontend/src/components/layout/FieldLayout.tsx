import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import type { Field } from "../../api/types";
import { useDataMode } from "../../context/DataModeContext";
import { useField } from "../../hooks/useField";
import { useI18n } from "../../i18n/I18nContext";
import { daysBetween, formatDate, titleCase, todayIso } from "../../lib/format";
import { DemoTrials } from "../data/DemoTrials";
import { ErrorState } from "../ui/AsyncState";
import { DropIcon, GaugeIcon, LeafIcon, MapPinIcon, SatelliteIcon, SparkIcon, WheatIcon } from "../ui/Icons";
import { LoadingState } from "../ui/AsyncState";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: <GaugeIcon size={15} /> },
  { key: "analytics", label: "Analytics", icon: <WheatIcon size={15} /> },
  { key: "irrigation", label: "Irrigation", icon: <DropIcon size={15} /> },
  { key: "health", label: "Crop health", icon: <LeafIcon size={15} /> },
  { key: "satellite", label: "Satellite", icon: <SatelliteIcon size={15} /> },
  { key: "assistant", label: "Assistant", icon: <SparkIcon size={15} /> },
] as const;

export type FieldTab = (typeof TABS)[number]["key"];

/**
 * Shared frame for every field-scoped page: loads the field once, renders the
 * field header + section tabs, then hands the loaded field to the page body.
 * A render-prop keeps pages from re-fetching the same profile.
 */
export function FieldLayout({
  fieldId,
  activeTab,
  children,
}: {
  fieldId: number;
  activeTab: FieldTab;
  children: (field: Field) => ReactNode;
}) {
  const { field, loading, error, reload } = useField(fieldId);
  const { isDemo } = useDataMode();
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="container-page py-10">
        <LoadingState label={t("Loading field profile…")} rows={2} />
      </div>
    );
  }

  if (error || !field) {
    return (
      <div className="container-page py-10">
        <ErrorState
          title={t("Field could not be loaded")}
          message={error?.message ?? t("The field does not exist or was deleted.")}
          onRetry={reload}
        />
        <div className="mt-4">
          <Link to="/fields" className="btn-secondary btn-sm">
            {t("Back to fields")}
          </Link>
        </div>
      </div>
    );
  }

  const dap = daysBetween(field.planting_date, todayIso());

  return (
    <div className="container-page py-7 sm:py-9">
      <header className="border-b border-line pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow mb-2">{t("Field workspace")}</p>
            <h1 className="text-2xl tracking-[-0.025em] sm:text-3xl">{field.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <MapPinIcon size={13} />
                {field.location_label ?? t("Custom coordinates")}
                <span className="font-mono text-muted/80" dir="ltr">
                  ({field.latitude.toFixed(4)}, {field.longitude.toFixed(4)})
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <WheatIcon size={13} />
                {t(field.crop_name)} · {t("planted {date}", { date: formatDate(field.planting_date) })}
              </span>
              <span className="font-mono text-2xs uppercase tracking-[0.08em]">
                {isDemo
                  ? t("Demo snapshot season · not today")
                  : dap >= 0
                    ? t("Day {n} after planting", { n: dap })
                    : t("Planting in {n} days", { n: Math.abs(dap) })}
              </span>
            </div>
          </div>

          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <div>
              <dt className="text-muted">{t("Area")}</dt>
              <dd className="font-medium">{field.area_ha ? `${field.area_ha} ha` : t("Not set")}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("Soil")}</dt>
              <dd className="font-medium">
                {field.soil_texture ? t(titleCase(field.soil_texture)) : t("Assumed loam")}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("Irrigation")}</dt>
              <dd className="font-medium">
                {field.irrigation_system ? t(titleCase(field.irrigation_system)) : t("Not set")}
              </dd>
            </div>
          </dl>
        </div>

        <nav className="mt-5 -mb-5 flex gap-1 overflow-x-auto scroll-thin" aria-label={t("Field sections")}>
          {TABS.map((tab) => (
            <NavLink
              key={tab.key}
              to={`/${tab.key}/${field.id}`}
              className={({ isActive }) =>
                [
                  "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors",
                  isActive || tab.key === activeTab
                    ? "border-forest-700 font-semibold text-forest-800"
                    : "border-transparent text-muted hover:border-sage-300 hover:text-ink",
                ].join(" ")
              }
            >
              {tab.icon}
              {t(tab.label)}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="space-y-7 pt-7">
        <DemoTrials tab={activeTab} currentFieldName={field.name} />
        {children(field)}
      </div>
    </div>
  );
}
