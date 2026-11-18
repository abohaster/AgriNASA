/** Formatting helpers shared by cards, charts and tables. */

/**
 * Arabic UI keeps Latin digits (`-u-nu-latn`) so scientific values and chart
 * axes stay consistent with the numbers shown in the calculation chain.
 */
function locale(): string | undefined {
  if (typeof document !== "undefined" && document.documentElement.lang === "ar") {
    return "ar-EG-u-nu-latn";
  }
  return undefined;
}

export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString(locale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompact(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString(locale(), { maximumFractionDigits: decimals });
}

/** Parse YYYY-MM-DD as a *local* date to avoid UTC off-by-one display bugs. */
export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return parseIsoDate(value).toLocaleDateString(locale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "—";
  return parseIsoDate(value).toLocaleDateString(locale(), {
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  // Format in local time: toISOString() would shift the date in UTC+ zones.
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function daysBetween(startIso: string, endIso: string): number {
  const ms = parseIsoDate(endIso).getTime() - parseIsoDate(startIso).getTime();
  return Math.round(ms / 86_400_000);
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function truncate(value: string, max = 140): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
