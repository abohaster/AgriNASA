import { useEffect, useMemo, useState } from "react";
import type { GeoJsonObject } from "geojson";
import {
  Circle,
  CircleMarker,
  GeoJSON,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { SatelliteTiles } from "../../api/types";
import { useTheme } from "../../context/ThemeContext";
import { useI18n } from "../../i18n/I18nContext";

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type LayerKey = "ndvi" | "soil_moisture" | "true_color";

const LAYER_ORDER: LayerKey[] = ["ndvi", "soil_moisture", "true_color"];

const LAYER_LABEL: Record<LayerKey, string> = {
  ndvi: "Vegetation health (NDVI)",
  soil_moisture: "Soil moisture (Sentinel-1)",
  true_color: "True colour image (RGB)",
};

function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom(), { animate: false });
  }, [latitude, longitude, map]);
  return null;
}

/**
 * Farmer-facing map with one active Earth Engine layer at a time.
 *
 * The three layers are display tiles: NDVI is stretched through a vivid
 * red-to-green ramp, the Sentinel-1 wetness layer through a brown-to-blue
 * ramp, and the RGB layer is a true-colour Sentinel-2 composite. Switching
 * layers never changes the numbers reported on the page.
 */
export function FarmLayersMap({
  latitude,
  longitude,
  label,
  boundary,
  tiles,
  bufferKm = 0.5,
  height = 320,
  className = "",
}: {
  latitude: number;
  longitude: number;
  label?: string | null;
  boundary?: Record<string, unknown> | null;
  tiles: SatelliteTiles;
  bufferKm?: number;
  height?: number;
  className?: string;
}) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [preferred, setPreferred] = useState<LayerKey>("ndvi");
  // Kept per layer so switching to RGB does not darken a saturated palette, and
  // a custom transparency set on NDVI survives a round trip.
  const [opacity, setOpacity] = useState<Record<LayerKey, number>>({
    ndvi: 0.85,
    soil_moisture: 0.85,
    true_color: 1,
  });

  const available = LAYER_ORDER.filter((key) => Boolean(tiles[key]));
  const active: LayerKey | null = tiles[preferred]
    ? preferred
    : (available[0] ?? null);
  const activeTile = active ? tiles[active] : null;

  const boundaryColor = isDark ? "#7fd3a9" : "#1b4e3a";
  const boundaryFill = isDark ? "#3f8f6b" : "#5b977a";
  const radiusM = useMemo(() => Math.max(150, bufferKm * 1000), [bufferKm]);

  return (
    <div className={`overflow-hidden rounded-md border border-line ${className}`}>
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
                fillOpacity: 0.08,
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
                  fillOpacity: 0.06,
                }}
              />
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

        <div className="absolute end-2 top-2 z-[500] flex max-w-[13rem] flex-col items-end gap-1">
          {LAYER_ORDER.map((key) => {
            const tile = tiles[key];
            const selected = active === key;
            return (
              <button
                key={key}
                type="button"
                disabled={!tile}
                aria-pressed={selected}
                onClick={() => setPreferred(key)}
                className={`rounded border px-2 py-1 text-2xs font-medium shadow-sm backdrop-blur transition-colors ${
                  selected
                    ? "border-forest-600 bg-forest-700 text-paper"
                    : tile
                      ? "border-line bg-paper/95 text-ink hover:border-forest-300"
                      : "cursor-not-allowed border-line bg-paper/70 text-muted opacity-60"
                }`}
              >
                {t(LAYER_LABEL[key])}
              </button>
            );
          })}
        </div>

        {activeTile && active && (
          <div className="absolute bottom-6 start-2 z-[500] w-[13rem] rounded bg-paper/95 p-2 text-[10px] leading-snug text-muted shadow-sm backdrop-blur">
            <p className="font-medium text-ink">{t(LAYER_LABEL[active])}</p>
            {activeTile.kind === "rgb" ? (
              <p className="mt-1">{t("Natural-colour Sentinel-2 composite.")}</p>
            ) : (
              <>
                <span
                  className="mt-1 block h-2.5 rounded-sm"
                  style={{ background: `linear-gradient(to right, ${activeTile.palette.join(",")})` }}
                  aria-hidden="true"
                />
                <div className="mt-0.5 flex justify-between font-mono">
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
            {t("No satellite layer is available for this field right now.")}
          </div>
        )}
      </div>

      <p className="border-t border-line bg-sage-50 px-3 py-2 text-[10px] leading-relaxed text-muted">
        {t(
          "The coloured layer is a temporary display tile. The percentages and advice on this page come from server-side calculations, not from the tile colours.",
        )}
      </p>
    </div>
  );
}
