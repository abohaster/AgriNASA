import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Field } from "../api/types";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/AsyncState";
import { ArrowRightIcon, MapPinIcon, PlusIcon, TrashIcon, WheatIcon } from "../components/ui/Icons";
import { SectionHeading } from "../components/ui/SectionHeading";
import { useAsync } from "../hooks/useAsync";
import { useI18n } from "../i18n/I18nContext";
import { daysBetween, formatDate, titleCase, todayIso } from "../lib/format";

function FieldCard({
  field,
  onDelete,
  deleting,
}: {
  field: Field;
  onDelete: (field: Field) => void;
  deleting: boolean;
}) {
  const { t } = useI18n();
  const dap = daysBetween(field.planting_date, todayIso());

  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">{t(field.crop_name)}</p>
          <h2 className="truncate text-lg font-semibold tracking-[-0.015em]">{field.name}</h2>
        </div>
        <button
          type="button"
          onClick={() => onDelete(field)}
          disabled={deleting}
          className="rounded p-1.5 text-muted transition-colors hover:bg-[#fbf0ee] hover:text-[#963c2f] disabled:opacity-40 dark:hover:bg-[#2a1714] dark:hover:text-[#f0a294]"
          aria-label={t("Delete {name}", { name: field.name })}
          title={t("Delete field")}
        >
          <TrashIcon size={16} />
        </button>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
        <MapPinIcon size={13} />
        <span className="min-w-0">
          {field.location_label ?? t("Custom coordinates")}
          <span className="ms-1 font-mono text-2xs text-muted/80" dir="ltr">
            {field.latitude.toFixed(3)}, {field.longitude.toFixed(3)}
          </span>
        </span>
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-xs">
        <div>
          <dt className="text-muted">{t("Planted")}</dt>
          <dd className="mt-0.5 font-medium">{formatDate(field.planting_date)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("Crop age")}</dt>
          <dd className="mt-0.5 font-medium">
            {dap >= 0
              ? t("Day {n}", { n: dap })
              : t("In {n} days", { n: Math.abs(dap) })}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("Area")}</dt>
          <dd className="mt-0.5 font-medium">{field.area_ha ? `${field.area_ha} ha` : t("Not set")}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("Irrigation")}</dt>
          <dd className="mt-0.5 font-medium">
            {field.irrigation_system ? t(titleCase(field.irrigation_system)) : t("Not set")}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <span className="text-2xs text-muted">
          {field.soil_texture
            ? t("Soil: {value}", { value: t(titleCase(field.soil_texture)) })
            : t("Soil assumed loam")}
        </span>
        <Link to={`/dashboard/${field.id}`} className="btn-secondary btn-sm">
          {t("Open dashboard")}
          <ArrowRightIcon size={14} className="rtl:-scale-x-100" />
        </Link>
      </div>
    </article>
  );
}

/**
 * Field list / workspace entry point.
 *
 * This is the first screen after creating a field. It deliberately shows only
 * profile facts here; live environmental values and analyses live inside each
 * field's dashboard so data provenance stays contextual.
 */
export function FieldListPage() {
  const { t } = useI18n();
  const { status, data, error, reload } = useAsync((signal) => api.listFields(signal), []);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete(field: Field) {
    const confirmed = window.confirm(
      t(
        'Delete "{name}"? This removes its cached analyses and assistant conversation. This cannot be undone.',
        { name: field.name },
      ),
    );
    if (!confirmed) return;

    setDeletingId(field.id);
    setActionError(null);
    try {
      await api.deleteField(field.id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("The field could not be deleted."));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="container-page py-8 sm:py-10">
      <SectionHeading
        eyebrow={t("Field workspace")}
        title={t("Your fields")}
        description={t(
          "Create a field profile, then open its dashboard for NASA POWER conditions, FAO-56 irrigation demand and environmental crop-health indicators.",
        )}
        actions={
          <Link to="/fields/new" className="btn-primary btn-sm">
            <PlusIcon size={14} />
            {t("New field")}
          </Link>
        }
      />

      <div className="mt-7">
        {status === "loading" && <LoadingState label={t("Loading fields…")} rows={3} variant="list" />}

        {status === "error" && (
          <ErrorState
            title={t("Fields could not be loaded")}
            message={error?.message ?? t("The server did not return the field list.")}
            onRetry={reload}
          />
        )}

        {actionError && (
          <p
            role="alert"
            className="mb-4 rounded border border-[#e7c4bd] bg-[#fbf0ee] px-3 py-2 text-xs text-[#8a352a] dark:border-[#6b3a32] dark:bg-[#2a1714] dark:text-[#f0b0a3]"
          >
            {actionError}
          </p>
        )}

        {status === "success" && data && data.length === 0 && (
          <EmptyState
            icon={<WheatIcon size={20} />}
            title={t("No fields yet")}
            description={t(
              "Create your first field to start a location-aware analysis. You can use the demo snapshot to explore the platform without live NASA requests.",
            )}
            action={
              <Link to="/fields/new" className="btn-primary btn-sm">
                <PlusIcon size={14} />
                {t("Create a field")}
              </Link>
            }
          />
        )}

        {status === "success" && data && data.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((field) => (
              <FieldCard
                key={field.id}
                field={field}
                onDelete={handleDelete}
                deleting={deletingId === field.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
