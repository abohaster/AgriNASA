import { useI18n } from "../../i18n/I18nContext";
import { SENSOR_METRICS, type SensorMetricKey } from "./mapData";
import { basemapDefinition, type BasemapId } from "./mapConfig";
import type { MapOverlays } from "./MapLayerControl";

/**
 * Small legend that appears only while a layer is visible. Colours always have
 * a text label, and the basemap source/resolution is repeated here.
 */
export function MapLegend({
  basemap,
  overlays,
  sensorTypes,
  ndviActive,
  ndviDate,
}: {
  basemap: BasemapId;
  overlays: MapOverlays;
  sensorTypes: SensorMetricKey[];
  ndviActive: boolean;
  ndviDate: string | null;
}) {
  const { t } = useI18n();
  const base = basemapDefinition(basemap);

  return (
    <div className="pointer-events-auto w-[13.5rem] rounded-lg border border-line bg-paper/95 px-3 py-2 text-[10px] leading-snug text-muted shadow-card backdrop-blur">
      <p className="eyebrow mb-1">{t("Legend")}</p>

      <p className="text-ink">
        {t(base.label)} · {base.source}
      </p>
      <p>{t(base.resolution)}</p>

      {overlays.boundaries && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border-2 border-[#2f7d5b] bg-[#5b977a]/25" aria-hidden="true" />
          <span>{t("Field boundary")}</span>
        </div>
      )}

      {overlays.robot && (
        <>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-[#2f7d5b]" aria-hidden="true" />
            <span>{t("Robot path · last 6 hours")}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, #9aa89f 0 4px, transparent 4px 7px)",
              }}
              aria-hidden="true"
            />
            <span>{t("Robot path · historical")}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-paper bg-[#1b4e3a]" aria-hidden="true" />
            <span>{t("Robot latest position")}</span>
          </div>
        </>
      )}

      {overlays.sensors && sensorTypes.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {sensorTypes.map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full border border-paper"
                style={{ background: SENSOR_METRICS[key].color }}
                aria-hidden="true"
              />
              <span>{t(SENSOR_METRICS[key].label)}</span>
            </li>
          ))}
        </ul>
      )}

      {ndviActive && (
        <div className="mt-1.5 border-t border-line pt-1.5">
          <div
            className="h-2 w-full rounded-sm"
            style={{ background: "linear-gradient(to right, #a6611a, #d8b365, #f5f5f5, #5ab4ac, #01665e)" }}
            aria-hidden="true"
          />
          <p className="mt-0.5 text-ink">{t("NDVI · Sentinel-2 · 10 m")}</p>
          <p>{t("Google Earth Engine")}{ndviDate ? ` · ${ndviDate}` : ""}</p>
        </div>
      )}
    </div>
  );
}
