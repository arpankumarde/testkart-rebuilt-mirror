import { format } from "date-fns";

// Postgres `date` columns are calendar days, not moments. The driver returns
// them as UTC midnight of the stored day, and that is also the shape sent back,
// so the day survives any browser timezone.

const DAY_MS = 24 * 60 * 60 * 1000;

/** A stored calendar date as a local-midnight Date, for pickers and date-fns. */
export const calendarDateToLocal = (value: Date | string): Date => {
  const date = new Date(value);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

/** A day picked in the browser as UTC midnight of that same day, for sending. */
export const localToCalendarDate = (value: Date): Date =>
  new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));

/**
 * The `YYYY-MM-DD` string to write into a `date` column. Rounds to the nearest
 * UTC midnight, so a local-midnight Date from an older client still lands on
 * the day that was picked rather than the one before it.
 */
export const toDateOnlyString = (value: Date): string =>
  new Date(Math.round(value.getTime() / DAY_MS) * DAY_MS).toISOString().slice(0, 10);

/** Month and year of a stored calendar date, e.g. "Sep 2026". */
export const formatCalendarMonthYear = (value: Date | string | null | undefined): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(calendarDateToLocal(date), "MMM yyyy");
};