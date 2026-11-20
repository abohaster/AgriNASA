import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";
import { formatDate, formatDateTime, formatNumber } from "../../lib/format";
import { StatusPill } from "../ui/StatusPill";
import { SENSOR_METRICS, type FieldLayerEntry } from "./mapData";

/**
 * Field list and selected-field details.
 *
 * The panel reads the same entries that are drawn on the map, so the count of
 * sensors and the robot status cannot drift from the markers. An empty state is
 * shown instead of placeholder values when nothing has been uploaded.
 */
export function FieldInformationPanel({
  entries,
  selectedId,
  onSelectField,
  showDetail = true,
}: {
  entries: FieldLayerEntry[];
  selectedId: number | null;
  onSelectField: (fieldId: number) => void;
  showDetail?: boolean;
}) {
  const { t } = useI18n();
  const selected = entries.find((entry) => entry.field.id === selectedId) ?? null;

  return (
    <section className="card card-pad space-y-4" aria-label={t("Field information")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Fields")}</h2>
        <Link to="/fields/new" className="text-2xs font-medium text-forest-700 underline-offset-2 hover:underline">
          {t("Add field")}
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted">
          {t("No saved fields yet. Create a field to draw its boundary and collect robot readings.")}
        </p>
      ) : (
        <ul className="-mx-1 max-h-56 space-y-0.5 overflow-y-auto pe-1">
          {entries.map((entry) => {
            const active = entry.field.id === selectedId;
            return (
              <li key={entry.field.id}>
                <button
                  type="button"
                  onClick={() => onSelectField(entry.field.id)}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-start transition-colors ${
                    active ? "bg-forest-50" : "hover:bg-sage-50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-ink">
                      {entry.field.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted">
                      {t(entry.field.crop_name)}
                      {entry.field.area_ha !== null
                        ? ` · ${formatNumber(entry.field.area_ha, 2)} ha`
                        : ""}
                      {entry.nodes.length > 0 ? ` · ${entry.nodes.length} ${t("sensors")}` : ""}
                    </span>
                  </span>
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      entry.online ? "bg-forest-500" : entry.lastMeasurementAt ? "bg-clay-400" : "bg-sage-300"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showDetail && selected && (
        <div className="space-y-3 border-t border-line pt-3">
          <div>
            <p className="eyebrow">{t("Selected field")}</p>
            <h3 className="mt-0.5 text-sm font-semibold text-ink">{selected.field.name}</h3>
            <p className="text-2xs text-muted">
              {t(selected.field.crop_name)}
              {selected.field.location_label ? ` · ${selected.field.location_label}` : ""}
            </p>
          </div>

          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("Area")}</dt>
              <dd className="text-ink">
                {selected.field.area_ha !== null
                  ? `${formatNumber(selected.field.area_ha, 2)} ha`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("Planted")}</dt>
              <dd className="text-ink">{formatDate(selected.field.planting_date)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("Coordinates")}</dt>
              <dd className="font-mono text-2xs text-ink" dir="ltr">
                {selected.field.latitude.toFixed(5)}, {selected.field.longitude.toFixed(5)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("Boundary")}</dt>
              <dd className="text-ink">
                {selected.field.boundary_geojson ? t("saved boundary") : t("coordinate point")}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Link to={`/dashboard/${selected.field.id}`} className="btn-secondary btn-sm">
              {t("Open field")}
            </Link>
            <Link to={`/robot/${selected.field.id}`} className="btn-secondary btn-sm">
              {t("Robot page")}
            </Link>
          </div>

          <div className="space-y-2 rounded-md border border-line bg-sage-50/60 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ink">{t("Robot status")}</p>
              {selected.online ? (
                <StatusPill tone="good">{t("Live")}</StatusPill>
              ) : selected.lastMeasurementAt ? (
                <StatusPill tone="warn" dot={false}>
                  {t("Historical")}
                </StatusPill>
              ) : (
                <StatusPill tone="neutral" dot={false}>
                  {t("No readings yet")}
                </StatusPill>
              )}
            </div>

            {selected.lastMeasurementAt ? (
              <p className="text-2xs text-muted">
                {t("Last reading")}: {formatDateTime(selected.lastMeasurementAt)}
              </p>
            ) : (
              <p className="text-2xs leading-relaxed text-muted">
                {t("Pair a robot and let it post readings. Nothing is simulated here.")}
              </p>
            )}

            {selected.latestGps ? (
              <p className="text-2xs text-muted">
                {t("Last position")}:{" "}
                <span className="font-mono text-ink" dir="ltr">
                  {selected.latestGps.latitude.toFixed(5)}, {selected.latestGps.longitude.toFixed(5)}
                </span>{" "}
                · {formatDateTime(selected.latestGps.measuredAt)}
              </p>
            ) : (
              <p className="text-2xs text-muted">
                {t("No robot position has been uploaded. The map does not invent one.")}
              </p>
            )}

            <p className="text-[10px] leading-relaxed text-muted">
              {t("A probe measures one point and one depth. It does not represent the whole field.")}
            </p>
          </div>

          <div>
            <p className="eyebrow mb-1">{t("Sensors with GPS")}</p>
            {selected.nodes.length === 0 ? (
              <p className="text-2xs text-muted">
                {t("No sensor reading includes latitude and longitude yet.")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {selected.nodes.slice(0, 8).map((node) => (
                  <li key={node.key} className="rounded-md border border-line px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-2xs font-medium text-ink">{node.label}</span>
                      <span className="text-[10px] text-muted">{formatDateTime(node.measuredAt)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {node.metrics.map((metric) => {
                        const definition = SENSOR_METRICS[metric.key];
                        return (
                          <span key={metric.key} className="flex items-center gap-1 text-[10px] text-muted">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: definition.color }}
                              aria-hidden="true"
                            />
                            {t(definition.label)}{" "}
                            <span className="font-mono text-ink">
                              {formatNumber(metric.value, definition.decimals)} {metric.unit}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showDetail && !selected && entries.length > 0 && (
        <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
          {t("Select a field on the map or in this list to see its boundary, robot status and sensor readings.")}
        </p>
      )}
    </section>
  );
}
