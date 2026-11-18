import type { ReactNode } from "react";
import { AlertIcon, InfoIcon } from "./Icons";

const TONES = {
  info: "border-survey-200 bg-survey-50 text-survey-700",
  warn: "border-clay-200 bg-clay-50 text-clay-600",
  danger:
    "border-[#e7c4bd] bg-[#fbf0ee] text-[#8a352a] dark:border-[#6b3a32] dark:bg-[#2a1714] dark:text-[#f0b0a3]",
  neutral: "border-line bg-sage-50 text-muted",
};

/**
 * Explanatory callout for assumptions, limitations and demo notices.
 * Used deliberately instead of tooltips alone: scientific caveats should be
 * readable without a pointer.
 */
export function InfoNote({
  title,
  children,
  tone = "info",
  className = "",
}: {
  title?: string;
  children: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <div className={`flex gap-2.5 rounded-md border px-3.5 py-3 text-xs leading-relaxed ${TONES[tone]} ${className}`}>
      <span className="mt-0.5 shrink-0">
        {tone === "danger" || tone === "warn" ? <AlertIcon size={15} /> : <InfoIcon size={15} />}
      </span>
      <div>
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
