import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertIcon, CheckIcon } from "../components/ui/Icons";
import { describeError, rayyanApi, type RayyanErrorInfo } from "./client";
import { RayyanShell } from "./RayyanShell";
import { useRayyanT } from "./strings";
import type { Fale7AccessGrant } from "./types";

/**
 * The QR link is single-use. StrictMode remounts must not consume it twice, so
 * every token maps to one in-flight request for this page load.
 */
const inflight = new Map<string, Promise<Fale7AccessGrant>>();

function revealOnce(token: string): Promise<Fale7AccessGrant> {
  const existing = inflight.get(token);
  if (existing) return existing;
  const promise = rayyanApi.fale7Reveal(token).finally(() => {
    inflight.delete(token);
  });
  inflight.set(token, promise);
  return promise;
}

export function Fale7AccessPage() {
  const { t } = useRayyanT();
  const { token = "" } = useParams<{ token: string }>();
  const [grant, setGrant] = useState<Fale7AccessGrant | null>(null);
  const [error, setError] = useState<RayyanErrorInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    revealOnce(token)
      .then((value) => {
        if (!cancelled) setGrant(value);
      })
      .catch((err) => {
        if (!cancelled) setError(describeError(err));
      });
    return () => {
      cancelled = true;
      // The request itself is never aborted: aborting would not restore the link.
    };
  }, [token]);

  async function copyKey() {
    if (!grant) return;
    try {
      await navigator.clipboard.writeText(grant.key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const gone = error?.code === "FALE7_ACCESS_LINK_GONE";
  const revoked = error?.code === "FALE7_API_KEY_REVOKED";

  return (
    <RayyanShell title="Fale7" subtitle={t("brand.subtitle")}>
      <div className="mx-auto max-w-xl">
        <div className="card card-pad">
          {!grant && !error && (
            <p className="text-sm text-muted" role="status">
              {t("access.checking")}
            </p>
          )}

          {(gone || revoked) && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <AlertIcon size={16} />
                {gone ? t("access.goneTitle") : t("access.revokedTitle")}
              </p>
              <p className="text-xs leading-relaxed text-muted">
                {gone ? t("access.goneBody") : t("access.revokedBody")}
              </p>
              <Link to="/rayyan" className="btn-secondary btn-sm mt-2">
                {t("access.back")}
              </Link>
            </div>
          )}

          {error && !gone && !revoked && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <AlertIcon size={16} />
                {error.message}
              </p>
              {error.details && <p className="text-xs text-muted">{error.details}</p>}
              <Link to="/rayyan" className="btn-secondary btn-sm mt-2">
                {t("access.back")}
              </Link>
            </div>
          )}

          {grant && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-forest-700">
                  {t("fapi.title")}
                </p>
                <h1 className="mt-1 text-lg font-semibold text-ink">{t("access.title")}</h1>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t("access.description")}</p>
              </div>

              <div className="rounded-md border border-forest-200 bg-forest-50 p-3">
                <code
                  dir="ltr"
                  className="scroll-thin block select-all overflow-x-auto whitespace-nowrap rounded border border-forest-200 bg-white px-2.5 py-2 font-mono text-xs text-ink"
                >
                  {grant.key}
                </code>
                <button type="button" className="btn-primary btn-sm mt-2" onClick={() => void copyKey()}>
                  {t("fapi.copy")}
                </button>
                {copied && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-2xs font-medium text-forest-700">
                    <CheckIcon size={13} />
                    {t("fapi.copied")}
                  </p>
                )}
              </div>

              <p className="rounded-md border border-clay-200 bg-clay-50 px-3 py-2 text-2xs leading-relaxed text-clay-600">
                {t("access.warning")}
              </p>

              <dl className="grid gap-x-4 gap-y-1 text-2xs sm:grid-cols-2">
                <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                  <dt className="text-muted">{t("fapi.keyPrefix")}</dt>
                  <dd className="font-mono text-ink" dir="ltr">
                    {grant.key_prefix}…
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                  <dt className="text-muted">{t("fapi.scope")}</dt>
                  <dd className="text-ink">{t("fapi.scopeAsk")}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                  <dt className="text-muted">{t("fapi.rateLimit")}</dt>
                  <dd className="text-ink">{t("fapi.perHour", { count: grant.rate_limit_per_hour })}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                  <dt className="text-muted">{t("fapi.created")}</dt>
                  <dd className="text-ink">
                    {new Date(grant.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </dd>
                </div>
              </dl>

              <Link to="/rayyan" className="text-2xs font-medium text-forest-700 hover:underline">
                {t("access.back")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </RayyanShell>
  );
}
