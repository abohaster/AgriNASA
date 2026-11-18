import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api/client";
import type { DeviceToken } from "../api/types";
import { DeviceKeyReveal } from "../components/robot/DeviceKeyReveal";
import { InfoNote } from "../components/ui/InfoNote";
import { SectionHeading } from "../components/ui/SectionHeading";
import { StatusPill } from "../components/ui/StatusPill";
import { AlertIcon, CheckIcon, CpuIcon } from "../components/ui/Icons";
import { useAsync } from "../hooks/useAsync";
import { useI18n } from "../i18n/I18nContext";
import { formatDateTime } from "../lib/format";

/**
 * Target of the pairing QR.
 *
 * Opening this page with a live code does not pair anything by itself: the
 * button below burns the code and reveals the device key exactly once.
 */
export function PairRobotPage() {
  const { t } = useI18n();
  const { code = "" } = useParams();
  const normalized = code.trim().toUpperCase();
  const info = useAsync((signal) => api.pairingCodeInfo(normalized, signal), [normalized]);
  const [issued, setIssued] = useState<DeviceToken | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const token = await api.claimPairingCode(normalized);
      setIssued(token);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PAIRING_CODE_GONE") {
        setError(t("This pairing code is no longer valid. Create a new one on the robot page."));
      } else {
        setError(err instanceof Error ? err.message : t("The device could not be paired."));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page max-w-2xl space-y-6 py-8 sm:py-10">
      <SectionHeading
        eyebrow={t("Field robot")}
        title={t("Link this robot")}
        description={t(
          "A one-time code from the robot page opens this screen. Pairing issues the device key the ESP32 uses to post readings.",
        )}
        as="h1"
      />

      {!normalized && (
        <InfoNote tone="warn" title={t("No code in the link")}>
          {t("Open the robot page from your field and create a pairing QR first.")}{" "}
          <Link to="/fields" className="link-underline">
            {t("Go to My Fields")}
          </Link>
        </InfoNote>
      )}

      {normalized && info.status === "loading" && (
        <p className="text-sm text-muted">{t("Checking the code…")}</p>
      )}

      {normalized && info.status === "error" && (
        <InfoNote tone="warn" title={t("This code cannot be used")}>
          <span className="flex items-start gap-1.5">
            <AlertIcon size={13} />
            <span>
              {info.error instanceof ApiError && info.error.code === "PAIRING_CODE_GONE"
                ? t("The code was already used or has expired. Create a new QR on the robot page.")
                : t("The code is not recognised. Create a new QR on the robot page.")}
            </span>
          </span>
        </InfoNote>
      )}

      {normalized && info.status === "success" && info.data && (
        <div className="card card-pad space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">{t("Pairing code")}</p>
              <p className="mt-1 font-mono text-xl tracking-[0.18em] text-ink" dir="ltr">
                {normalized}
              </p>
            </div>
            <StatusPill tone="good" dot={false}>
              <CheckIcon size={12} /> {t("Valid")}
            </StatusPill>
          </div>

          <dl className="grid gap-2 border-y border-line py-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted">{t("Field")}</dt>
              <dd className="mt-0.5 font-medium text-ink">{info.data.field_name}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("Expires")}</dt>
              <dd className="mt-0.5 font-medium text-ink">{formatDateTime(info.data.expires_at)}</dd>
            </div>
          </dl>

          {!issued && (
            <>
              <button type="button" className="btn-primary btn-sm" onClick={() => void claim()} disabled={busy}>
                <CpuIcon size={14} />
                {busy ? t("Pairing…") : t("Pair this robot")}
              </button>
              {error && (
                <p className="flex items-start gap-1.5 text-2xs text-clay-600">
                  <AlertIcon size={13} />
                  {error}
                </p>
              )}
            </>
          )}

          {issued && (
            <div className="space-y-3">
              <DeviceKeyReveal issued={issued} robotHref={`/robot/${issued.device.field_id}`} />
              <Link to={`/robot/${issued.device.field_id}`} className="btn-primary btn-sm">
                {t("Open the live sensor panel")}
              </Link>
            </div>
          )}
        </div>
      )}

      <InfoNote tone="neutral" title={t("How the key is stored")}>
        {t(
          "The server keeps only a hash and a short prefix of the device key. It cannot be shown again, and revoking the device stops its readings immediately.",
        )}
      </InfoNote>
    </div>
  );
}