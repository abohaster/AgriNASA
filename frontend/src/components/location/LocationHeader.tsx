import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { DataSourceRef } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { formatNumber } from "../../lib/format";
import type { SelectedLocation } from "../../lib/location";
import { FieldMap } from "../data/FieldMap";
import { DataSourceBadge } from "../ui/DataSourceBadge";
import { InfoNote } from "../ui/InfoNote";
import { MapPinIcon, SparkIcon } from "../ui/Icons";
import { SectionHeading } from "../ui/SectionHeading";

export function SourceBadges({ sources }: { sources: DataSourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {sources.map((source) => (
        <DataSourceBadge key={source.id} source={source} />
      ))}
    </div>
  );
}

/**
 * Location header shared by Location Analysis, Historical Data and Crop
 * Intelligence: name, coordinates, optional field boundary and provenance.
 */
export function LocationHeader({
  location,
  title,
  description,
  sources,
  right,
}: {
  location: SelectedLocation;
  title?: string;
  description?: string;
  sources?: DataSourceRef[];
  right?: ReactNode;
}) {
  const { t } = useI18n();
  const label = location.label ?? t("Selected point");

  return (
    <section className="space-y-4">
      <SectionHeading
        eyebrow={t("Location intelligence")}
        title={title ?? label}
        description={
          description ??
          t(
            "Point {lat}, {lon}. Weather and soil values come from the nearest model cell; a drawn field is analysed over its area where the source supports it.",
            {
              lat: formatNumber(location.latitude, 4),
              lon: formatNumber(location.longitude, 4),
            },
          )
        }
        actions={right}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card overflow-hidden">
          <FieldMap
            latitude={location.latitude}
            longitude={location.longitude}
            label={label}
            boundary={location.boundary}
            areaHa={location.areaHa}
            height={300}
            allowGibs
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-2xs text-muted">
            <span className="inline-flex items-center gap-1" dir="ltr">
              <MapPinIcon size={12} />
              {formatNumber(location.latitude, 5)}, {formatNumber(location.longitude, 5)}
            </span>
            {location.areaHa !== null && (
              <span>{t("Area: {n} ha", { n: formatNumber(location.areaHa, 2) })}</span>
            )}
            <span>
              {location.source === "field"
                ? t("Stored field boundary/point")
                : location.boundary
                  ? t("Drawn outline for this analysis")
                  : t("Point selection — no field boundary")}
            </span>
            {location.field ? (
              <Link to={`/rayyan?field=${location.field.id}`} className="btn-secondary btn-sm ms-auto">
                <SparkIcon size={13} />
                {t("Ask Fale7 about this field")}
              </Link>
            ) : !location.boundary ? (
              <Link
                to={`/fields/new?lat=${location.latitude}&lon=${location.longitude}${
                  location.label ? `&label=${encodeURIComponent(location.label)}` : ""
                }`}
                className="btn-secondary btn-sm ms-auto"
              >
                {t("Save as a field")}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <div className="card card-pad">
            <h2 className="text-sm font-semibold">{t("Where this is")}</h2>
            <dl className="mt-2 space-y-1.5 text-xs text-muted">
              <div className="flex justify-between gap-3">
                <dt>{t("Name")}</dt>
                <dd className="text-end text-ink">{label}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t("Coordinates")}</dt>
                <dd className="font-mono text-ink" dir="ltr">
                  {formatNumber(location.latitude, 4)}, {formatNumber(location.longitude, 4)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t("Area")}</dt>
                <dd className="text-ink">
                  {location.areaHa !== null ? `${formatNumber(location.areaHa, 2)} ha` : t("Point only")}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-2xs leading-relaxed text-muted">
              {t(
                "Administrative names come from OpenStreetMap. An empty name means the geocoder returned none; none is invented.",
              )}
            </p>
          </div>

          {sources && sources.length > 0 && (
            <div className="card card-pad">
              <h2 className="text-sm font-semibold">{t("Data sources")}</h2>
              <div className="mt-2">
                <SourceBadges sources={sources} />
              </div>
            </div>
          )}

          <InfoNote tone="warn">
            {t(
              "Model and satellite estimates are not on-farm measurements. SoilGrids is modelled, SMAP/Open-Meteo soil moisture is not a depth probe, and crop screening is not a yield forecast.",
            )}
          </InfoNote>
        </div>
      </div>
    </section>
  );
}
