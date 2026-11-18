import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { AlertIcon, InfoIcon, RefreshIcon } from "./Icons";

/** Skeleton placeholder shown while an API call is in flight (never a blank screen). */
export function LoadingState({
  label = "Loading data…",
  rows = 3,
  variant = "cards",
}: {
  label?: string;
  rows?: number;
  variant?: "cards" | "chart" | "list";
}) {
  const { t } = useI18n();

  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
      <span className="sr-only">{t(label)}</span>
      {variant === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="card animate-pulse-soft p-5">
              <div className="h-2.5 w-24 rounded bg-sage-200" />
              <div className="mt-4 h-7 w-20 rounded bg-sage-200" />
              <div className="mt-3 h-2 w-32 rounded bg-sage-100" />
            </div>
          ))}
        </div>
      )}
      {variant === "chart" && (
        <div className="card animate-pulse-soft p-5">
          <div className="h-2.5 w-40 rounded bg-sage-200" />
          <div className="mt-6 flex h-52 items-end gap-1.5">
            {Array.from({ length: 28 }).map((_, index) => (
              <div
                key={index}
                className="flex-1 rounded-t bg-sage-100"
                style={{ height: `${18 + ((index * 37) % 62)}%` }}
              />
            ))}
          </div>
        </div>
      )}
      {variant === "list" && (
        <div className="card animate-pulse-soft divide-y divide-line">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center justify-between p-4">
              <div className="h-2.5 w-40 rounded bg-sage-200" />
              <div className="h-2.5 w-16 rounded bg-sage-100" />
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-muted">{t(label)}</p>
    </div>
  );
}

/**
 * Friendly error panel. `error.message` already comes from our API error
 * envelope, so technical stack traces never reach the user.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  details,
  onRetry,
}: {
  title?: string;
  message: string;
  details?: string | null;
  onRetry?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div
      role="alert"
      className="card border-[#e7c4bd] bg-[#fbf3f1] p-6 dark:border-[#6b3a32] dark:bg-[#2a1714]"
    >
      <div className="flex gap-3">
        <span className="mt-0.5 text-[#963c2f] dark:text-[#f0a294]">
          <AlertIcon size={22} />
        </span>
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-[#7e2f25] dark:text-[#f4b7ab]">{t(title)}</h3>
          <p className="text-sm leading-relaxed text-[#7e2f25]/90 dark:text-[#f4b7ab]/90">{t(message)}</p>
          {details && (
            <p className="font-mono text-xs text-[#7e2f25]/70 dark:text-[#f4b7ab]/70">{t(details)}</p>
          )}
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn-secondary btn-sm mt-2">
              <RefreshIcon size={14} />
              {t("Try again")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Empty state for a successful but data-less response. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sage-100 text-forest-600">
        {icon ?? <InfoIcon size={20} />}
      </span>
      <h3 className="text-sm font-semibold">{t(title)}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{t(description)}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
