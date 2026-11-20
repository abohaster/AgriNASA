import type { GeoJsonObject } from "geojson";
import { Link } from "react-router-dom";
import { CircleMarker, GeoJSON, Popup, Tooltip } from "react-leaflet";
import { useTheme } from "../../context/ThemeContext";
import { useI18n } from "../../i18n/I18nContext";
import { formatDate, formatNumber } from "../../lib/format";
import type { FieldLayerEntry } from "./mapData";
import { MAP_COLORS } from "./mapConfig";

/**
 * One saved field on the map.
 *
 * A stored GeoJSON boundary is drawn as a transparent polygon with a visible
 * border. A coordinate-only field is a point — the map never invents a shape
 * from its stated area. Clicking either selects the field.
 */
export function FieldBoundary({
  entry,
  selected,
  onSelect,
}: {
  entry: FieldLayerEntry;
  selected: boolean;
  onSelect: (fieldId: number) => void;
}) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const { field, nodes } = entry;

  const border = selected ? MAP_COLORS.boundary : isDark ? "#6fae8e" : "#3f6b58";
  const fill = isDark ? "#3f8f6b" : MAP_COLORS.boundaryFill;

  const popup = (
    <Popup minWidth={200}>
      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-ink">{field.name}</p>
          <p className="text-2xs text-muted">
            {t(field.crop_name)}
            {field.area_ha !== null ? ` · ${formatNumber(field.area_ha, 2)} ha` : ""}
          </p>
        </div>
        <dl className="space-y-1 text-2xs">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("Planted")}</dt>
            <dd className="text-ink">{formatDate(field.planting_date)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("Sensors")}</dt>
            <dd className="text-ink">{nodes.length}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("Geometry")}</dt>
            <dd className="text-ink">
              {field.boundary_geojson ? t("saved boundary") : t("coordinate point")}
            </dd>
          </div>
        </dl>
        <Link to={`/dashboard/${field.id}`} className="btn-secondary btn-sm">
          {t("Open field")}
        </Link>
      </div>
    </Popup>
  );

  if (field.boundary_geojson) {
    return (
      <GeoJSON
        key={`${field.id}-${JSON.stringify(field.boundary_geojson)}`}
        data={field.boundary_geojson as unknown as GeoJsonObject}
        style={{
          color: border,
          weight: selected ? 3 : 2,
          fillColor: fill,
          fillOpacity: selected ? 0.2 : 0.1,
          bubblingMouseEvents: false,
        }}
        eventHandlers={{ click: () => onSelect(field.id) }}
      >
        <Tooltip direction="top" sticky>
          <span className="font-semibold">{field.name}</span>
          {field.area_ha !== null ? ` · ${formatNumber(field.area_ha, 2)} ha` : ""}
        </Tooltip>
        {popup}
      </GeoJSON>
    );
  }

  return (
    <CircleMarker
      center={[field.latitude, field.longitude]}
      radius={selected ? 9 : 7}
      pathOptions={{
        color: border,
        weight: selected ? 3 : 2,
        fillColor: fill,
        fillOpacity: 0.95,
        bubblingMouseEvents: false,
      }}
      eventHandlers={{ click: () => onSelect(field.id) }}
    >
      <Tooltip direction="top" offset={[0, -8]}>
        {t("{name} — coordinate only, no boundary supplied", { name: field.name })}
      </Tooltip>
      {popup}
    </CircleMarker>
  );
}
