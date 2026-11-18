import { addDaysIso, parseIsoDate, todayIso } from "./format";

export type PeriodKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "season"
  | "year"
  | "custom";

export interface DatePeriod {
  key: PeriodKey;
  start: string;
  end: string;
}

export const PERIOD_KEYS: PeriodKey[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "this_month",
  "last_month",
  "season",
  "year",
  "custom",
];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  this_month: "This month",
  last_month: "Previous month",
  season: "This season",
  year: "This year",
  custom: "Custom period",
};

function monthStart(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEnd(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(
    last.getDate(),
  ).padStart(2, "0")}`;
}

function previousMonthStart(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}-01`;
}

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(parseIsoDate(value).getTime());
}

/**
 * Resolve a quick period to explicit dates.
 *
 * Weather reanalyses publish with a lag, so the rolling options end yesterday;
 * "Today" still sends today's date and the backend reports missing data honestly.
 * "This season" starts at the planting date unless that is in the future.
 */
export function resolvePeriod(
  key: PeriodKey,
  options: { today?: string; plantingDate?: string | null; start?: string; end?: string } = {},
): DatePeriod {
  const today = options.today ?? todayIso();

  switch (key) {
    case "today":
      return { key, start: today, end: today };
    case "yesterday": {
      const yesterday = addDaysIso(today, -1);
      return { key, start: yesterday, end: yesterday };
    }
    case "7d":
      return { key, start: addDaysIso(today, -7), end: addDaysIso(today, -1) };
    case "30d":
      return { key, start: addDaysIso(today, -30), end: addDaysIso(today, -1) };
    case "this_month":
      return { key, start: monthStart(today), end: today };
    case "last_month": {
      const start = previousMonthStart(today);
      return { key, start, end: monthEnd(start) };
    }
    case "season": {
      const planting = options.plantingDate;
      const start = planting && isIsoDate(planting) && planting <= today ? planting : today;
      return { key, start, end: today };
    }
    case "year":
      return { key, start: `${today.slice(0, 4)}-01-01`, end: today };
    case "custom":
    default: {
      const start = isIsoDate(options.start) ? options.start : addDaysIso(today, -7);
      const end = isIsoDate(options.end) ? options.end : today;
      return { key: "custom", start, end };
    }
  }
}
