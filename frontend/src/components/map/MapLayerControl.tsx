import { useState } from "react";
import type { SatelliteLayerTile } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { formatDate } from "../../lib/format";
import { LayersIcon } from "../ui/Icons";
import { BASEMAP_ORDER, type BasemapId, basemapDefinition } from "./mapConfig";

export interface MapOverlays {
  boundaries: boolean;
  sensors: boolean;
  robot: boolean;
}

export interface NdviLayerState {
  status: "idle" | "loading" | "ready" | "error";
  tile: SatelliteLayerTile | null;
  acquisitionDate: string | null;
  message: string | null;
}

/**
 * Floating layer selector.
 *
 * Satellite imagery is the default basemap. NDVI is listed as a separate
 * overlay because it exists only after Earth Engine returns real Sentinel-2
 * tiles for a selected field. Temperature and precipitation are honestly marked
 * as not connected rather than pointing at an empty tile layer.
 */
export function MapLayerControl({
  basemap,
  onBasemapChange,
  overlays,
  onToggleOverlay,
  ndvi,
  ndviEnabled,
  onToggleNdvi,
  onLoadNdvi,
  canLoadNdvi,
  selectedFieldName,
}: {
  basemap: BasemapId;
  onBasemapChange: (id: BasemapId) => void;
  overlays: MapOverlays;
  onToggleOverlay: (key: keyof MapOverlays, value: boolean) => void;
  ndvi: NdviLayerState;
  ndviEnabled: boolean;
  onToggleNdvi: (value: boolean) => void;
  onLoadNdvi: () => void;
  canLoadNdvi: boolean;
  selectedFieldName: string | null;
}) {
  const { t, tm } = useI18n();
  const [open, setOpen] = useState(() => window.matchMedia("(min-width: 640px)").matches);

  return (
    <div className="pointer-events-auto flex min-h-0 w-[15.5rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-line bg-paper/95 shadow-card backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="map-layer-panel"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <LayersIcon size={14} />
          {t("Layers")}
        </span>
        <span className="text-2xs text-muted">{open ? t("Hide") : t("Show")}</span>
      </button>

      {open && (
        <div id="map-layer-panel" className="min-h-0 flex-1 space-y-3 overflow-y-auto border-t border-line px-3 pb-3 pt-2">
          <div>
            <p className="eyebrow mb-1">{t("Basemap")}</p>
            <div className="space-y-1">
              {BASEMAP_ORDER.map((id) => {
                const definition = basemapDefinition(id);
                const active = basemap === id;
                return (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 transition-colors ${
                      active
                        ? "border-forest-300 bg-forest-50"
                        : "border-transparent hover:bg-sage-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="map-basemap"
                      className="mt-0.5 accent-forest-700"
                      checked={active}
                      onChange={() => onBasemapChange(id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-2xs font-semibold text-ink">
                        {t(definition.label)}
                      </span>
                      <span className="block text-[10px] leading-snug text-muted">
                        {definition.source} · {t(definition.resolution)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border-t border-line pt-2">
            <p className="eyebrow mb-1">{t("Overlays")}</p>
            <div className="space-y-1.5 text-xs">
              {(
                [
                  ["boundaries", "Field boundaries"],
                  ["sensors", "Sensor markers"],
                  ["robot", "Robot position and path"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-ink">
                  <input
                    type="checkbox"
                    className="accent-forest-700"
                    checked={overlays[key]}
                    onChange={(event) => onToggleOverlay(key, event.target.checked)}
                  />
                  {t(label)}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-line pt-2">
            <p className="eyebrow mb-1">{t("Vegetation")}</p>
            {ndvi.status === "ready" && ndvi.tile && (
              <div className="space-y-1.5">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
                  <input
                    type="checkbox"
                    className="accent-forest-700"
                    checked={ndviEnabled}
                    onChange={(event) => onToggleNdvi(event.target.checked)}
                  />
                  {t("NDVI (Sentinel-2)")}
                </label>
                <p className="text-[10px] leading-snug text-muted">
                  {t("Sentinel-2 · 10 m · Google Earth Engine")}
                  {ndvi.acquisitionDate ? ` · ${formatDate(ndvi.acquisitionDate)}` : ""}
                </p>
                <button type="button" onClick={onLoadNdvi} className="btn-secondary btn-sm w-full">
                  {t("Reload NDVI")}
                </button>
              </div>
            )}

            {ndvi.status === "idle" && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={onLoadNdvi}
                  disabled={!canLoadNdvi}
                  className="btn-primary btn-sm w-full"
                >
                  {selectedFieldName
                    ? t("Load NDVI for {field}", { field: selectedFieldName })
                    : t("Load NDVI")}
                </button>
                <p className="text-[10px] leading-snug text-muted">
                  {selectedFieldName
                    ? t("Fetches real Sentinel-2 tiles from Earth Engine for the selected field.")
                    : t("Select a field first. NDVI is only shown for a real field geometry.")}
                </p>
              </div>
            )}

            {ndvi.status === "loading" && (
              <p className="text-2xs leading-snug text-muted" role="status">
                {t("Loading NDVI tiles from Earth Engine…")}
              </p>
            )}

            {ndvi.status === "error" && (
              <div className="space-y-1.5">
                <p className="text-2xs leading-snug text-clay-600">{tm(ndvi.message ?? "")}</p>
                <button type="button" onClick={onLoadNdvi} className="btn-secondary btn-sm w-full">
                  {t("Retry")}
                </button>
              </div>
            )}
          </div>

          <p className="border-t border-line pt-2 text-[10px] leading-snug text-muted">
            {t(
              "Temperature and precipitation are not connected as map layers. Their values are reported in Analytics.",
            )}
          </p>
        </div>
      )}
    </div>
  );
}
