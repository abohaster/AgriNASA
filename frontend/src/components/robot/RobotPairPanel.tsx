import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../api/client";
import type { PairingCode } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { AlertIcon, CpuIcon, RefreshIcon } from "../ui/Icons";

/**
 * Creates a single-use pairing code and renders it as a QR link.
 *
 * The QR carries no secret: the code is short-lived, one-use and stored only
 * as a hash. The device key is minted when the pairing page is opened.
 */
export function RobotPairPanel({ fieldId }: { fieldId: number }) {
  const { t } = useI18n();
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pairing) return;
    const timer = window.setInterval(() => setNow(Date.now()), 20000);
    return () => window.clearInterval(timer);
  }, [pairing]);

  async function generate() {
    setCreating(true);
    setError(null);
    try {
      const code = await api.createPairingCode(fieldId);
      setPairing(code);
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("The pairing code could not be created."));
    } finally {
      setCreating(false);
    }
  }

  const expiry = pairing ? new Date(pairing.expires_at).getTime() : 0;
  const minutesLeft = pairing ? Math.max(0, Math.ceil((expiry - now) / 60000)) : 0;
  const expired = Boolean(pairing) && minutesLeft === 0;
  const pairUrl = pairing ? `${window.location.origin}/robot/pair/${pairing.code}` : "";

  return (
    <div className="space-y-3">
      {!pairing && (
        <>
          <p className="text-xs leading-relaxed text-muted">
            {t(
              "A pairing QR opens a one-time page that issues the robot's key. The code expires after 15 minutes and stops working once used.",
            )}
          </p>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => void generate()}
            disabled={creating}
          >
            <CpuIcon size={14} />
            {creating ? t("Creating…") : t("Create pairing QR")}
          </button>
        </>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-clay-600">
          <AlertIcon size={13} />
          {error}
        </p>
      )}

      {pairing && (
        <div className={expired ? "space-y-2 opacity-60" : "space-y-2"}>
          {!expired ? (
            <div className="flex justify-center rounded-md border border-line bg-white p-3">
              <QRCodeSVG
                value={pairUrl}
                size={168}
                level="M"
                bgColor="#ffffff"
                fgColor="#10241c"
                aria-label={t("Pairing QR code")}
              />
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-line bg-sage-50 p-3 text-xs text-muted">
              {t("This pairing code has expired. Create a new one.")}
            </p>
          )}
          <p className="text-center font-mono text-sm tracking-[0.18em] text-ink" dir="ltr">
            {pairing.code}
          </p>
          <p className="text-center text-2xs text-muted">
            {expired
              ? t("Expired")
              : t("Valid for {minutes} more minutes · pairs to {field}", {
                  minutes: minutesLeft,
                  field: pairing.field_name,
                })}
          </p>
          <p className="text-2xs leading-relaxed text-muted">
            {t(
              "Scanning opens the pairing page, where the device key is shown once. Keep the screen private until the code expires.",
            )}
          </p>
          <div className="flex justify-center">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => void generate()}
              disabled={creating}
            >
              <RefreshIcon size={13} />
              {t("Replace with a new code")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}