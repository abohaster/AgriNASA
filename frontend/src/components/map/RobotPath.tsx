import { Polyline, Tooltip } from "react-leaflet";
import { useI18n } from "../../i18n/I18nContext";
import { isFresh, type RobotTrackPoint } from "./mapData";
import { MAP_COLORS } from "./mapConfig";

/**
 * GPS trail from stored sensor readings.
 *
 * The solid segment is inside the six-hour freshness window; the dashed segment
 * is older history. Both come from readings the robot uploaded. A path is never
 * interpolated or animated to look like live tracking.
 */
export function RobotPath({ points, fieldName }: { points: RobotTrackPoint[]; fieldName: string }) {
  const { t } = useI18n();
  if (points.length < 2) return null;

  const firstLive = points.findIndex((point) => isFresh(point.measuredAt));
  const history = firstLive === -1 ? points : points.slice(0, firstLive + 1);
  const live = firstLive === -1 ? [] : points.slice(firstLive);

  const historyPositions = history.map((point) => [point.latitude, point.longitude] as [number, number]);
  const livePositions = live.map((point) => [point.latitude, point.longitude] as [number, number]);

  return (
    <>
      {historyPositions.length > 1 && (
        <Polyline
          positions={historyPositions}
          pathOptions={{
            color: MAP_COLORS.pathHistory,
            weight: 3,
            opacity: 0.85,
            dashArray: "6 6",
            bubblingMouseEvents: false,
          }}
        >
          <Tooltip sticky>
            {t("Robot path · {n} historical GPS positions", { n: historyPositions.length })} · {fieldName}
          </Tooltip>
        </Polyline>
      )}
      {livePositions.length > 1 && (
        <Polyline
          positions={livePositions}
          pathOptions={{
            color: MAP_COLORS.pathLive,
            weight: 4,
            opacity: 0.95,
            bubblingMouseEvents: false,
          }}
        >
          <Tooltip sticky>
            {t("Robot path · {n} GPS positions in the last 6 hours", {
              n: livePositions.length,
            })}{" "}
            · {fieldName}
          </Tooltip>
        </Polyline>
      )}
    </>
  );
}
