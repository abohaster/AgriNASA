import { Link } from "react-router-dom";
import { Marker, Popup, Tooltip } from "react-leaflet";
import { StatusPill } from "../ui/StatusPill";
import { useI18n } from "../../i18n/I18nContext";
import { formatDateTime } from "../../lib/format";
import type { RobotTrackPoint } from "./mapData";
import { robotIcon } from "./mapIcons";

/**
 * Latest reported robot position.
 *
 * The marker is only rendered when the robot actually sent latitude/longitude.
 * A live pulse is tied to reading freshness, not to the presence of a marker.
 */
export function RobotMarker({
  point,
  online,
  fieldId,
  fieldName,
  lastMeasurementAt,
}: {
  point: RobotTrackPoint;
  online: boolean;
  fieldId: number;
  fieldName: string;
  lastMeasurementAt: string | null;
}) {
  const { t } = useI18n();

  return (
    <Marker
      position={[point.latitude, point.longitude]}
      icon={robotIcon(online)}
      zIndexOffset={1000}
      riseOnHover
      title={`${t("Robot")} · ${fieldName}`}
    >
      <Tooltip direction="top" offset={[0, -20]}>
        {t("Robot")} · {online ? t("Live") : t("Last known position")}
      </Tooltip>
      <Popup minWidth={210}>
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{t("Field robot")}</p>
              <p className="text-2xs text-muted">{fieldName}</p>
            </div>
            <StatusPill tone={online ? "good" : "neutral"} dot>
              {online ? t("Live") : t("Historical")}
            </StatusPill>
          </div>
          <dl className="space-y-1 text-2xs">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("Last position")}</dt>
              <dd className="font-mono text-ink" dir="ltr">
                {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("Measured at")}</dt>
              <dd className="text-end text-ink">
                {formatDateTime(point.measuredAt)}
                {!online && lastMeasurementAt && lastMeasurementAt !== point.measuredAt
                  ? ` · ${t("latest reading")} ${formatDateTime(lastMeasurementAt)}`
                  : ""}
              </dd>
            </div>
          </dl>
          <p className="text-[10px] leading-relaxed text-muted">
            {t("GPS positions are reported by the robot and shown exactly as received. No movement is simulated.")}
          </p>
          <Link to={`/robot/${fieldId}`} className="btn-secondary btn-sm">
            {t("Robot page")}
          </Link>
        </div>
      </Popup>
    </Marker>
  );
}
