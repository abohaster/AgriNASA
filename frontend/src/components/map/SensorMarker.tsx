import { Marker, Popup, Tooltip } from "react-leaflet";
import { StatusPill } from "../ui/StatusPill";
import { useI18n } from "../../i18n/I18nContext";
import { formatDateTime, formatNumber } from "../../lib/format";
import { SENSOR_METRICS, type SensorNode } from "./mapData";
import { sensorIcon } from "./mapIcons";

/**
 * One sensor node at the coordinate it reported.
 *
 * A probe can send several values in the same reading; the popup lists all of
 * them with units and the exact measurement time. The marker colour follows the
 * node's primary metric, and the legend names each colour.
 */
export function SensorMarker({ node, fieldName }: { node: SensorNode; fieldName: string }) {
  const { t } = useI18n();
  const primary = node.metrics.find((metric) => metric.key === node.primary) ?? node.metrics[0];
  const primaryDef = SENSOR_METRICS[primary.key];

  return (
    <Marker
      position={[node.latitude, node.longitude]}
      icon={sensorIcon(node.primary)}
      zIndexOffset={600}
      riseOnHover
      title={`${t(primaryDef.label)} · ${node.label}`}
    >
      <Tooltip direction="top" offset={[0, -16]}>
        {t(primaryDef.label)}: {formatNumber(primary.value, primaryDef.decimals)} {primary.unit}
      </Tooltip>
      <Popup minWidth={220}>
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{node.label}</p>
              <p className="text-2xs text-muted">
                {node.deviceLabel} · {fieldName}
              </p>
            </div>
            <StatusPill tone="good" dot={false}>
              {t("Measured on site")}
            </StatusPill>
          </div>

          <ul className="space-y-1 text-2xs">
            {node.metrics.map((metric) => {
              const definition = SENSOR_METRICS[metric.key];
              return (
                <li key={metric.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: definition.color }}
                      aria-hidden="true"
                    />
                    {t(definition.label)}
                  </span>
                  <span className="font-mono text-ink" dir="ltr">
                    {formatNumber(metric.value, definition.decimals)} {metric.unit}
                  </span>
                </li>
              );
            })}
          </ul>

          <dl className="space-y-1 border-t border-line pt-1.5 text-2xs">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("Measured at")}</dt>
              <dd className="text-end text-ink">{formatDateTime(node.measuredAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("Coordinates")}</dt>
              <dd className="font-mono text-ink" dir="ltr">
                {node.latitude.toFixed(5)}, {node.longitude.toFixed(5)}
              </dd>
            </div>
            {node.status !== "ok" && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t("Sensor status")}</dt>
                <dd className="text-ink">{node.status}</dd>
              </div>
            )}
          </dl>
        </div>
      </Popup>
    </Marker>
  );
}
