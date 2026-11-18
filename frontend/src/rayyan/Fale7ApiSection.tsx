import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { AlertIcon, CheckIcon, LayersIcon, RefreshIcon, TrashIcon } from "../components/ui/Icons";
import { InfoNote } from "../components/ui/InfoNote";
import { StatusPill } from "../components/ui/StatusPill";
import { useI18n } from "../i18n/I18nContext";
import { describeError, rayyanApi, type RayyanErrorInfo } from "./client";
import { useRayyanT } from "./strings";
import type { Fale7ApiKeyState } from "./types";

/**
 * Auto-generation runs once even if React StrictMode mounts the section twice:
 * both mounts share the same in-flight request.
 */
let pendingGenerate: Promise<Fale7ApiKeyState> | null = null;

function generateOnce(): Promise<Fale7ApiKeyState> {
  if (!pendingGenerate) {
    pendingGenerate = rayyanApi.fale7Generate().finally(() => {
      pendingGenerate = null;
    });
  }
  return pendingGenerate;
}

function formatTime(value: string | null, lang: "en" | "ar"): string {
  if (!value) return lang === "ar" ? "أبدًا" : "Never";
  return new Date(value).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ErrorLine({ error }: { error: RayyanErrorInfo }) {
  return (
    <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-clay-600">
      <AlertIcon size={13} />
      <span>
        {error.message}
        {error.details ? ` ${error.details}` : ""}
      </span>
    </p>
  );
}

export function Fale7ApiSection() {
  const { t } = useRayyanT();
  const { lang } = useI18n();
  const [state, setState] = useState<Fale7ApiKeyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<RayyanErrorInfo | null>(null);
  const [protectedAccess, setProtectedAccess] = useState(false);
  const [busy, setBusy] = useState<"generate" | "revoke" | "link" | "copy" | null>(null);
  const [notice, setNotice] = useState<"generated" | "revoked" | "copied" | null>(null);
  const [qr, setQr] = useState<{ url: string; expires: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await rayyanApi.fale7State();
        if (cancelled) return;
        setState(data);
        setLoading(false);
        if (!data.exists) {
          const issued = await generateOnce();
          if (!cancelled) {
            setState(issued);
            setNotice("generated");
          }
        }
      } catch (err) {
        if (cancelled) return;
        const info = describeError(err);
        if (info.code === "SETTINGS_UNAUTHORIZED") setProtectedAccess(true);
        else setError(info);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per mount; the in-flight promise is shared across StrictMode remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!qr) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [qr]);

  async function copyText(value: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("copied");
      setError(null);
      return true;
    } catch {
      return false;
    }
  }

  async function copyVisibleKey(value: string) {
    if (await copyText(value)) return;
    setError({
      message: t("fapi.copyFailed"),
      details: null,
      code: "CLIPBOARD_ERROR",
      status: null,
    });
  }

  async function copyExistingKey() {
    setBusy("copy");
    setError(null);
    try {
      const link = await rayyanApi.fale7AccessLink();
      const grant = await rayyanApi.fale7Reveal(link.token);
      const copied = await copyText(grant.key);
      // If the clipboard is blocked, show the key once so it can be copied by hand.
      if (!copied) setState((current) => (current ? { ...current, key: grant.key } : current));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    if (!window.confirm(t("fapi.confirmRegenerate"))) return;
    setBusy("generate");
    setError(null);
    setQr(null);
    try {
      const issued = await rayyanApi.fale7Generate();
      setState(issued);
      setNotice("generated");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (!window.confirm(t("fapi.confirmRevoke"))) return;
    setBusy("revoke");
    setError(null);
    setQr(null);
    try {
      const updated = await rayyanApi.fale7Revoke();
      setState(updated);
      setNotice("revoked");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  async function createQr() {
    setBusy("link");
    setError(null);
    try {
      const link = await rayyanApi.fale7AccessLink();
      setQr({
        url: `${window.location.origin}/rayyan/api/access/${link.token}`,
        expires: new Date(link.expires_at).getTime(),
      });
      setNow(Date.now());
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  const minutesLeft = qr ? Math.max(0, Math.ceil((qr.expires - now) / 60000)) : 0;
  const qrExpired = Boolean(qr) && minutesLeft === 0;
  const active = state?.status === "active";
  const endpoint = `${window.location.origin}/api/rayyan/v1/ask`;

  return (
    <section id="fale7-api" className="card mt-5" aria-labelledby="fale7-api-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-forest-800 text-paper">
            <LayersIcon size={15} />
          </span>
          <h2 id="fale7-api-title" className="text-sm font-semibold">
            {t("fapi.title")}
          </h2>
          {state?.exists && (
            <StatusPill tone={active ? "good" : "bad"}>
              {active ? t("fapi.statusActive") : t("fapi.statusRevoked")}
            </StatusPill>
          )}
        </div>
        {state?.exists && (
          <span className="font-mono text-2xs text-muted" dir="ltr">
            {state.key_prefix}…
          </span>
        )}
      </div>

      <div className="px-4 py-4">
        <p className="text-xs leading-relaxed text-muted">{t("fapi.description")}</p>

        {loading && <p className="mt-3 text-xs text-muted">{t("common.loading")}</p>}

        {protectedAccess && (
          <div className="mt-3">
            <InfoNote tone="warn" title={t("fapi.protectedTitle")}>
              {t("fapi.protectedBody")}{" "}
              <Link to="/rayyan/settings" className="link-underline">
                {t("fapi.unlock")}
              </Link>
            </InfoNote>
          </div>
        )}

        {!loading && !protectedAccess && error && !state && (
          <div className="mt-3">
            <ErrorLine error={error} />
          </div>
        )}

        {!loading && state && (
          <>
            {notice && (
              <p className="mt-3 flex items-center gap-1.5 text-2xs font-medium text-forest-700">
                <CheckIcon size={13} />
                {t(
                  notice === "generated"
                    ? "fapi.generated"
                    : notice === "revoked"
                      ? "fapi.revoked"
                      : "fapi.copied",
                )}
              </p>
            )}
            {error && (
              <div className="mt-3">
                <ErrorLine error={error} />
              </div>
            )}

            {!state.exists && (
              <p className="mt-3 rounded-md border border-dashed border-line bg-sage-50 p-3 text-2xs text-muted">
                {t("fapi.noKey")}
              </p>
            )}

            {state.key && (
              <div className="mt-3 rounded-md border border-forest-200 bg-forest-50 p-3">
                <p className="text-2xs font-medium text-forest-800">{t("fapi.keyOnce")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code
                    dir="ltr"
                    className="scroll-thin min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded border border-forest-200 bg-white px-2.5 py-1.5 font-mono text-xs text-ink"
                  >
                    {state.key}
                  </code>
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={() => void copyVisibleKey(state.key ?? "")}
                  >
                    {t("fapi.copy")}
                  </button>
                </div>
              </div>
            )}

            {state.exists && !state.key && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-sage-50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-2xs font-medium text-ink">{t("fapi.keyLabel")}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted" dir="ltr">
                    {state.key_prefix}…
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => void copyExistingKey()}
                  disabled={busy !== null || !active}
                >
                  {busy === "copy" ? t("common.loading") : t("fapi.copyViaLink")}
                </button>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => void regenerate()}
                disabled={busy !== null}
              >
                <RefreshIcon size={13} />
                {state.exists ? t("fapi.regenerate") : t("fapi.generate")}
              </button>
              {state.exists && active && (
                <button
                  type="button"
                  className="btn-ghost btn-sm text-clay-600"
                  onClick={() => void revoke()}
                  disabled={busy !== null}
                >
                  <TrashIcon size={13} />
                  {t("fapi.revoke")}
                </button>
              )}
            </div>

            <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-2xs sm:grid-cols-2">
              <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                <dt className="text-muted">{t("fapi.totalRequests")}</dt>
                <dd className="font-mono text-ink">{state.request_count}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                <dt className="text-muted">{t("fapi.thisHour")}</dt>
                <dd className="font-mono text-ink">
                  {state.requests_this_hour} / {state.rate_limit_per_hour}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                <dt className="text-muted">{t("fapi.lastRequest")}</dt>
                <dd className="text-ink">{formatTime(state.last_used_at, lang)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                <dt className="text-muted">{t("fapi.lastStatus")}</dt>
                <dd className="font-mono text-ink" dir="ltr">
                  {state.last_status ?? "—"}
                  {state.last_error_code ? ` · ${state.last_error_code}` : ""}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                <dt className="text-muted">{t("fapi.rateLimit")}</dt>
                <dd className="text-ink">{t("fapi.perHour", { count: state.rate_limit_per_hour })}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                <dt className="text-muted">{t("fapi.created")}</dt>
                <dd className="text-ink">{formatTime(state.created_at, lang)}</dd>
              </div>
            </dl>
          </>
        )}

        {state?.exists && active && (
          <div className="mt-4 rounded-md border border-line bg-paper p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-ink">{t("fapi.qrTitle")}</p>
                <p className="mt-0.5 max-w-[52ch] text-2xs leading-relaxed text-muted">
                  {t("fapi.qrDescription", { minutes: 10 })}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => void createQr()}
                disabled={busy !== null}
              >
                {qr ? t("fapi.qrRefresh") : t("fapi.qrCreate")}
              </button>
            </div>

            {qr && !qrExpired && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="rounded-md border border-line bg-white p-2.5">
                  <QRCodeSVG
                    value={qr.url}
                    size={148}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#10241c"
                    aria-label={t("fapi.qrTitle")}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xs font-medium text-ink">
                    {t("fapi.qrDescription", { minutes: minutesLeft })}
                  </p>
                  <p className="mt-1 text-2xs leading-relaxed text-clay-600">{t("fapi.qrWarning")}</p>
                </div>
              </div>
            )}
            {qr && qrExpired && (
              <p className="mt-3 rounded-md border border-dashed border-line bg-sage-50 p-3 text-2xs text-muted">
                {t("fapi.qrExpired")}
              </p>
            )}
          </div>
        )}

        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-forest-700 hover:underline">
            {t("fapi.docsTitle")}
          </summary>
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted">
            <p>{t("fapi.docsIntro")}</p>

            <div>
              <p className="font-semibold text-ink">{t("fapi.docsAuthTitle")}</p>
              <p className="mt-1">{t("fapi.docsAuthBody")}</p>
              <pre dir="ltr" className="scroll-thin mt-1.5 overflow-x-auto rounded border border-line bg-sage-50 p-2.5 font-mono text-[10px] text-ink">
{`Authorization: Bearer fl7_YOUR_API_KEY`}
              </pre>
            </div>

            <div>
              <p className="font-semibold text-ink">{t("fapi.docsEndpointTitle")}</p>
              <pre dir="ltr" className="scroll-thin mt-1.5 overflow-x-auto rounded border border-line bg-sage-50 p-2.5 font-mono text-[10px] text-ink">
{`POST ${endpoint}
Content-Type: application/json`}
              </pre>
            </div>

            <div>
              <p className="font-semibold text-ink">{t("fapi.docsRequestTitle")}</p>
              <p className="mt-1">{t("fapi.docsRequestBody")}</p>
            </div>

            <div>
              <p className="font-semibold text-ink">{t("fapi.docsResponseTitle")}</p>
              <p className="mt-1">{t("fapi.docsResponseBody")}</p>
            </div>

            <div>
              <p className="font-semibold text-ink">{t("fapi.docsExampleRequest")}</p>
              <pre dir="ltr" className="scroll-thin mt-1.5 overflow-x-auto rounded border border-line bg-sage-50 p-2.5 font-mono text-[10px] leading-relaxed text-ink">
{`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer fl7_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "Should this field be irrigated today?",
    "field_id": 1,
    "crop": "wheat",
    "language": "en"
  }'`}
              </pre>
            </div>

            <div>
              <p className="font-semibold text-ink">{t("fapi.docsExampleResponse")}</p>
              <pre dir="ltr" className="scroll-thin mt-1.5 overflow-x-auto rounded border border-line bg-sage-50 p-2.5 font-mono text-[10px] leading-relaxed text-ink">
{`{
  "answer": "The computed irrigation demand is moderate. …",
  "recommendation": {
    "irrigation_demand": "moderate",
    "irrigation_label": "Monitor",
    "demand_reasons": ["ET0 is elevated", "Soil moisture is declining"],
    "crop_health_status": "good",
    "crop_health_reason": "No environmental stress detected"
  },
  "environmental_data": { "latest_values": { "…": "…" } },
  "data_sources": [{ "name": "NASA POWER daily weather" }],
  "warnings": [],
  "limitations": ["NASA POWER is coarse reanalysis, not on-farm data."],
  "confidence": { "level": "medium", "reasons": ["Recent rainfall is below normal"] },
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "data_mode": "live",
  "validation": {
    "status": "passed",
    "checks": ["numbers match the computed context"],
    "rejected_numbers": [],
    "removed_urls": 0,
    "word_count": 118
  },
  "conversation_id": "…",
  "usage": {
    "total_requests": 3,
    "requests_this_hour": 1,
    "rate_limit_per_hour": 60,
    "window_resets_at": "2026-11-19T15:00:00Z"
  }
}`}
              </pre>
            </div>

            <div>
              <p className="font-semibold text-ink">{t("fapi.docsRateTitle")}</p>
              <p className="mt-1">{t("fapi.docsRateBody", { count: state?.rate_limit_per_hour ?? 60 })}</p>
            </div>

            <div>
              <p className="font-semibold text-ink">{t("fapi.docsErrorsTitle")}</p>
              <p className="mt-1">{t("fapi.docsErrorsBody")}</p>
              <div className="scroll-thin mt-1.5 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-start text-[10px]">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className="py-1 pe-3 text-start font-semibold" dir="ltr">HTTP</th>
                      <th className="py-1 pe-3 text-start font-semibold" dir="ltr">code</th>
                      <th className="py-1 text-start font-semibold">{t("fapi.docsErrorsMeaning")}</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-ink">
                    <tr className="border-b border-line/60">
                      <td className="py-1 pe-3" dir="ltr">401</td>
                      <td className="py-1 pe-3" dir="ltr">FALE7_API_UNAUTHORIZED</td>
                      <td className="py-1 font-sans text-muted" dir="ltr">Missing, malformed or unknown key</td>
                    </tr>
                    <tr className="border-b border-line/60">
                      <td className="py-1 pe-3" dir="ltr">401</td>
                      <td className="py-1 pe-3" dir="ltr">FALE7_API_REVOKED</td>
                      <td className="py-1 font-sans text-muted" dir="ltr">The key was revoked</td>
                    </tr>
                    <tr className="border-b border-line/60">
                      <td className="py-1 pe-3" dir="ltr">404</td>
                      <td className="py-1 pe-3" dir="ltr">NOT_FOUND</td>
                      <td className="py-1 font-sans text-muted" dir="ltr">Field not found in this workspace</td>
                    </tr>
                    <tr className="border-b border-line/60">
                      <td className="py-1 pe-3" dir="ltr">422</td>
                      <td className="py-1 pe-3" dir="ltr">VALIDATION_ERROR</td>
                      <td className="py-1 font-sans text-muted" dir="ltr">Invalid body, missing field_id or crop mismatch</td>
                    </tr>
                    <tr>
                      <td className="py-1 pe-3" dir="ltr">429</td>
                      <td className="py-1 pe-3" dir="ltr">FALE7_API_RATE_LIMITED</td>
                      <td className="py-1 font-sans text-muted" dir="ltr">Hourly request limit reached</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p className="border-t border-line pt-2 text-2xs">{t("fapi.docsNoSecret")}</p>
          </div>
        </details>
      </div>
    </section>
  );
}
