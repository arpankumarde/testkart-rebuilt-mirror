/**
 * Time windows and raw-row readers shared by the teacher Overview and the
 * teacher Analytics endpoints, so both cut days the same way and their numbers
 * reconcile.
 */

// Teachers and the platform both work in India. IST has no daylight saving, so
// a fixed offset is exact and calendar days can be cut in JS without a
// timezone library. Same convention as the admin overview.
export const IST_OFFSET_MS = 330 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const IST = "Asia/Kolkata";

export type Row = Record<string, unknown>;

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

// The db instance runs CamelCasePlugin, which rewrites result keys of raw sql
// queries too, so a column aliased draft_tests arrives as draftTests.
export const get = (row: Row, key: string): unknown => row[key] ?? row[toCamel(key)];

export const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const str = (value: unknown, fallback = ""): string =>
  value === null || value === undefined ? fallback : String(value);

export const date = (value: unknown): Date => {
  const parsed = value instanceof Date ? value : new Date(str(value));
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

/** The IST calendar day (YYYY-MM-DD) a UTC instant falls on. */
export const isoDay = (utcMs: number): string => new Date(utcMs + IST_OFFSET_MS).toISOString().slice(0, 10);

const todayLocalMidnightUtcMs = () => {
  const nowLocal = new Date(Date.now() + IST_OFFSET_MS);
  return Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) - IST_OFFSET_MS;
};

/**
 * Local-midnight boundaries for "the last N calendar days including today" and
 * the N days before that. Returned as UTC instants for timestamptz comparisons,
 * plus the ISO day strings the daily series is generated over.
 */
export function windowBounds(days: number) {
  const todayMs = todayLocalMidnightUtcMs();
  const currentStartMs = todayMs - (days - 1) * DAY_MS;
  const previousStartMs = currentStartMs - days * DAY_MS;
  return {
    currentStart: new Date(currentStartMs),
    previousStart: new Date(previousStartMs),
    currentStartDay: isoDay(currentStartMs),
    previousStartDay: isoDay(previousStartMs),
    todayDay: isoDay(todayMs),
  };
}

/**
 * Same shape as windowBounds, for "the last N calendar months including this
 * one" (the current month is partial) and the N months before that. Months
 * start at local midnight on the 1st.
 */
export function monthWindowBounds(months: number) {
  const todayMs = todayLocalMidnightUtcMs();
  const local = new Date(todayMs + IST_OFFSET_MS);
  const monthStartMs = (offset: number) =>
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - offset, 1) - IST_OFFSET_MS;
  const currentStartMs = monthStartMs(months - 1);
  const previousStartMs = monthStartMs(2 * months - 1);
  return {
    currentStart: new Date(currentStartMs),
    previousStart: new Date(previousStartMs),
    currentStartDay: isoDay(currentStartMs),
    previousStartDay: isoDay(previousStartMs),
    todayDay: isoDay(todayMs),
  };
}

export const AnalyticsRangeValues = ["7d", "30d", "90d", "12m"] as const;
export type AnalyticsRange = (typeof AnalyticsRangeValues)[number];
export type AnalyticsBucket = "day" | "month";

/**
 * The current and previous windows for an Analytics range, and the bucket keys
 * (YYYY-MM-DD days, or YYYY-MM months for 12m) its series run over. bucketOf
 * maps an ISO day into its bucket; comparing an ISO day against
 * currentStartDay splits current from previous.
 */
export function analyticsWindow(range: AnalyticsRange) {
  if (range === "12m") {
    const bounds = monthWindowBounds(12);
    const buckets: string[] = [];
    const [year, month] = bounds.currentStartDay.split("-").map(Number);
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(Date.UTC(year, month - 1 + i, 1));
      buckets.push(d.toISOString().slice(0, 7));
    }
    return {
      ...bounds,
      bucket: "month" as AnalyticsBucket,
      buckets,
      bucketOf: (day: string) => day.slice(0, 7),
    };
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const bounds = windowBounds(days);
  const buckets: string[] = [];
  for (let i = 0; i < days; i += 1) {
    buckets.push(isoDay(bounds.currentStart.getTime() + i * DAY_MS));
  }
  return {
    ...bounds,
    bucket: "day" as AnalyticsBucket,
    buckets,
    bucketOf: (day: string) => day,
  };
}
