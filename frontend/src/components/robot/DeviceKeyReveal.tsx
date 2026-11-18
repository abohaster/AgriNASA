import { useState } from "react";
import { Link } from "react-router-dom";
import type { DeviceToken } from "../../api/types";
import { useI18n } from "../../i18n/I18nContext";
import { CheckIcon, CpuIcon } from "../ui/Icons";

/**
 * Shows a freshly minted device key exactly once.
 *
 * Only the hash and a short prefix are stored server-side, so the value can
 * never be retrieved again. The copy button uses the clipboard API when the
 * page is a secure context; the key stays selectable otherwise.
 */
export function DeviceKeyReveal({
  issued,
  robotHref,
}: {
  issued: DeviceToken;
  robotHref?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the key is displayed and selectable below.
    }
  }

  return (
    <div className="rounded-md border border-forest-200 bg-forest-50 p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-forest-900">
        <CpuIcon size={14} />
        {t("Device key for {label}", { label: issued.device.label })}
      </p>
      <p className="mt-1 text-2xs leading-relaxed text-forest-800">
        {t(
          "Paste it into the robot sketch now. It is shown once and cannot be recovered; if you lose it, revoke the device and create a new key.",
        )}
      </p>
      <pre
        dir="ltr"
        className="mt-2 select-all break-all rounded border border-forest-200 bg-card px-2.5 py-2 font-mono text-[11px] leading-relaxed text-ink"
      >
        {issued.token}
      </pre>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={() => void copyKey()}>
          {copied ? <CheckIcon size={13} /> : null}
          {copied ? t("Copied") : t("Copy key")}
        </button>
        {robotHref && (
          <Link to={robotHref} className="btn-ghost btn-sm">
            {t("Open the robot page")}
          </Link>
        )}
      </div>
    </div>
  );
}