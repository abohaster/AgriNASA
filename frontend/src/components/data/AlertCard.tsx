import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, InfoIcon } from "../ui/Icons";

const TONES = {
  danger: {
    box: "border-[#e7c4bd] bg-[#fbf0ee] dark:border-[#6b3a32] dark:bg-[#2a1714]",
    icon: "text-[#963c2f] dark:text-[#f0a294]",
    title: "text-[#7e2f25] dark:text-[#f4b7ab]",
    body: "text-[#7e2f25]/85 dark:text-[#f4b7ab]/85",
    defaultIcon: <AlertIcon size={18} />,
  },
  warn: {
    box: "border-clay-200 bg-clay-50",
    icon: "text-clay-600",
    title: "text-clay-600",
    body: "text-clay-600/85",
    defaultIcon: <AlertIcon size={18} />,
  },
  info: {
    box: "border-survey-200 bg-survey-50",
    icon: "text-survey-700",
    title: "text-survey-700",
    body: "text-survey-700/85",
    defaultIcon: <InfoIcon size={18} />,
  },
  good: {
    box: "border-forest-200 bg-forest-50",
    icon: "text-forest-700",
    title: "text-forest-800",
    body: "text-forest-800/85",
    defaultIcon: <CheckIcon size={18} />,
  },
} as const;

/**
 * Dashboard alert for a demand class, stress status or data limitation.
 * Tone is always paired with a title, so colour is never the only meaning.
 */
export function AlertCard({
  tone = "info",
  title,
  children,
  action,
  icon,
}: {
  tone?: keyof typeof TONES;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  const palette = TONES[tone];
  return (
    <div className={`flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-start ${palette.box}`}>
      <span className={`mt-0.5 shrink-0 ${palette.icon}`}>{icon ?? palette.defaultIcon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${palette.title}`}>{title}</p>
        {children && <div className={`mt-0.5 text-xs leading-relaxed ${palette.body}`}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-start">{action}</div>}
    </div>
  );
}
