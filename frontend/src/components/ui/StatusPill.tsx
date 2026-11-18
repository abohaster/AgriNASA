import type { ReactNode } from "react";

export type Tone = "good" | "warn" | "bad" | "neutral" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  good: "border-forest-200 bg-forest-50 text-forest-800",
  warn: "border-clay-200 bg-clay-50 text-clay-600",
  bad: "border-[#e7c4bd] bg-[#fbf0ee] text-[#963c2f] dark:border-[#6b3a32] dark:bg-[#2a1714] dark:text-[#f0a294]",
  neutral: "border-line bg-sage-50 text-muted",
  info: "border-survey-200 bg-survey-50 text-survey-700",
};

const DOT_CLASSES: Record<Tone, string> = {
  good: "bg-forest-500",
  warn: "bg-clay-500",
  bad: "bg-[#a63d33] dark:bg-[#d97a68]",
  neutral: "bg-muted/60",
  info: "bg-survey-500",
};

/**
 * Small status label used for demand, health, confidence and data nature.
 * Tone is always paired with a text label so colour is never the only signal.
 */
export function StatusPill({
  tone = "neutral",
  children,
  dot = true,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
