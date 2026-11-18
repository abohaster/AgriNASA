import { useEffect, useMemo, useState } from "react";
import type { GeoJsonObject } from "geojson";
import {
  Circle,
  CircleMarker,
  GeoJSON,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { useTheme } from "../../context/ThemeContext";
import { useI18n } from "../../i18n/I18nContext";
import type { SatelliteTiles } from "../../api/types";

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type LayerKey = "soil_moisture" | "ndvi" | "ndmi" | "true_color";

const LAYER_ORDER: LayerKey[] = ["ndvi", "ndmi", "soil_moisture", "true_color"];

function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom(), { animate: false });
  }, [latitude, longitude, map]);
  return null;
}

/**
 * Field location with the Earth Engine layers produced by the backend.
 *
 * The tile URLs are temporal display layers; the numbers shown elsewhere on the
 * page come from server-side reductions. Toggling a layer never changes the
 * reported values.
 */
export function SatelliteMap({
  latitude,
  longitude,
  label,
  boundary,
  areaHa,
  bufferKm,
  tiles,
  height = 380,
  className = "",
}: {
  latitude: number;
  longitude: number;
  label?: string | null;
  boundary?: Record<string, unknown> | null;
  areaHa: number | null;
  bufferKm?: number | null;
  tiles: SatelliteTiles;
  height?: number;
  className?: string;
}) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [preferred, setPreferred] = useState<LayerKey>("ndvi");
  const [opacity, setOpacity] = useState<Record<LayerKey, number>>({
    ndvi: 0.85,
    ndmi: 0.85,
    soil_moisture: 0.85,
    true_color: 1,
  });

  const boundaryColor = isDark ? "#7fd3a9" : "#1b4e3a";
  const boundaryFill = isDark ? "#3f8f6b" : "#5b977a";

  const radiusM = useMemo(() => {
    if (bufferKm) return bufferKm * 1000;
    if (areaHa) return Math.sqrt((areaHa * 10_000) / Math.PI);
    return 500;
  }, [bufferKm, areaHa]);

  const layerMeta: Record<LayerKey, { label: string; tile: SatelliteTiles[LayerKey] }> = {
    ndvi: { label: t("NDVI"), tile: tiles.ndvi },
    ndmi: { label: t("NDMI"), tile: tiles.ndmi },
    soil_moisture: { label: t("Surface wetness"), tile: tiles.soil_moisture },
    true_color: { label: t("True colour image (RGB)"), tile: tiles.true_color },
  };

  const available = LAYER_ORDER.filter((key) => Boolean(tiles[key]));
  const active: LayerKey | null = tiles[preferred]
    ? preferred
    : (available[0] ?? null);
  const activeTile = active ? tiles[active] : null;

  return (
    <div className={`overflow-hidden rounded-md border border-line ${className}`} dir="ltr">
      <div className="relative">
        <MapContainer
          center={[latitude, longitude]}
          zoom={15}
          scrollWheelZoom={false}
          style={{ height, width: "100%" }}
          aria-label={
            label
              ? t("Satellite map showing {name}", { name: label })
              : t("Satellite analysis map")
          }
        >
          <TileLayer
            url={OSM_URL}
            attribution={OSM_ATTRIBUTION}
            maxZoom={19}
            className={isDark ? "map-tiles-dark" : undefined}
          />
          <Recenter latitude={latitude} longitude={longitude} />

          {activeTile && active && (
            <TileLayer
              key={`${active}-${activeTile.url}`}
              url={activeTile.url}
              attribution={activeTile.attribution}
              maxZoom={19}
              opacity={opacity[active]}
            />
          )}

          {boundary ? (
            <GeoJSON
              key={JSON.stringify(boundary)}
              data={boundary as unknown as GeoJsonObject}
              style={{
                color: boundaryColor,
                weight: 2,
                fillColor: boundaryFill,
                fillOpacity: 0.12,
              }}
            />
          ) : (
            <>
              <Circle
                center={[latitude, longitude]}
                radius={radiusM}
                pathOptions={{
                  color: boundaryColor,
                  weight: 2,
                  dashArray: "5 4",
                  fillColor: boundaryFill,
                  fillOpacity: 0.1,
                }}
              >
                <Tooltip direction="top">
                  {t("Analysis extent: field centre plus a {km} km buffer", {
                    km: (radiusM / 1000).toFixed(1),
                  })}
                </Tooltip>
              </Circle>
              <CircleMarker
                center={[latitude, longitude]}
                radius={5}
                pathOptions={{
                  color: boundaryColor,
                  weight: 2,
                  fillColor: boundaryFill,
                  fillOpacity: 0.9,
                }}
              />
            </>
          )}
        </MapContainer>

        <div className="absolute end-2 top-2 z-[500] flex max-w-[12rem] flex-col items-end gap-1">
          {LAYER_ORDER.map((key) => {
            const tile = layerMeta[key].tile;
            const selected = active === key;
            return (
              <button
                key={key}
                type="button"
                disabled={!tile}
                onClick={() => setPreferred(key)}
                aria-pressed={selected}
                className={`rounded border px-2 py-1 text-2xs font-medium shadow-sm backdrop-blur transition-colors ${
                  selected
                    ? "border-forest-600 bg-forest-700 text-paper"
                    : tile
                      ? "border-line bg-paper/95 text-ink hover:border-forest-300"
                      : "cursor-not-allowed border-line bg-paper/70 text-muted opacity-60"
                }`}
              >
                {layerMeta[key].label}
              </button>
            );
          })}
        </div>

        {activeTile && active && (
          <div className="absolute bottom-6 start-2 z-[500] w-[13rem] rounded bg-paper/95 p-2 text-[10px] leading-snug text-muted shadow-sm backdrop-blur">
            <p className="font-medium text-ink">{layerMeta[active].label}</p>
            {activeTile.kind === "rgb" ? (
              <p className="mt-1">{t("Natural-colour Sentinel-2 composite.")}</p>
            ) : (
              <>
                <span
                  className="mt-1 block h-2 rounded-sm"
                  style={{ background: `linear-gradient(to right, ${activeTile.palette.join(",")})` }}
                  aria-hidden="true"
                />
                <div className="flex justify-between font-mono">
                  <span>{activeTile.min}</span>
                  <span>{activeTile.max}</span>
                </div>
              </>
            )}
          </div>
        )}

        {activeTile && active && (
          <div className="absolute bottom-2 end-2 z-[500] w-[10.5rem] rounded bg-paper/95 px-2 py-1.5 text-[10px] text-muted shadow-sm backdrop-blur">
            <label className="flex items-center justify-between gap-2">
              <span>{t("Layer opacity")}</span>
              <span className="font-mono" dir="ltr">
                {Math.round(opacity[active] * 100)}%
              </span>
            </label>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={Math.round(opacity[active] * 100)}
              onChange={(event) => {
                const value = Number(event.target.value) / 100;
                setOpacity((current) => ({ ...current, [active]: value }));
              }}
              className="mt-1 w-full accent-forest-700"
              aria-label={t("Layer opacity")}
            />
          </div>
        )}

        {!activeTile && (
          <div className="absolute inset-x-3 bottom-6 z-[500] rounded bg-paper/95 px-2 py-1.5 text-[10px] text-muted shadow-sm backdrop-blur">
            <p>{t("No Earth Engine layer is currently visible.")}</p>
          </div>
        )}
      </div>

      <p className="border-t border-line bg-sage-50 px-3 py-2 text-[10px] leading-relaxed text-muted">
        {t(
          "Earth Engine layers are temporary display tiles. Values reported on this page come from server-side reductions, not from the rendered colours.",
        )}
      </p>
    </div>
  );
}
