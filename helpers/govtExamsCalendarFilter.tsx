import { GEC_CATEGORIES, GEC_TABLES, type GecCategory, type GecRow, type GecTable } from "./govtExamsCalendarData";

export const ALL = "all";

export interface GecFilters {
  query: string;
  category: GecCategory | typeof ALL;
  month: string;
}

export const EMPTY_FILTERS: GecFilters = { query: "", category: ALL, month: ALL };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11" to "Nov 2026". */
export const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

/** Every month any row touches, oldest first. */
export const GEC_MONTH_OPTIONS = [...new Set(GEC_TABLES.flatMap((table) => table.rows.flatMap((row) => row.months)))]
  .sort()
  .map((key) => ({ value: key, label: monthLabel(key) }));

const categoryLabel = (category: GecCategory | undefined) =>
  GEC_CATEGORIES.find((item) => item.value === category)?.label ?? "";

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9/&.\s]/g, " ");

const haystackOf = (table: GecTable, row: GecRow) =>
  normalise(
    [
      ...row.cells,
      row.status?.label ?? "",
      row.keywords ?? "",
      table.searchPrefix ?? "",
      categoryLabel(row.category ?? table.category),
    ].join(" ")
  );

/** Every word of the query must appear somewhere in the row, so "rrb je" finds "RRB Junior Engineer ... (je)". */
export const rowMatches = (table: GecTable, row: GecRow, filters: GecFilters) => {
  if (filters.category !== ALL && (row.category ?? table.category) !== filters.category) return false;
  if (filters.month !== ALL && !row.months.includes(filters.month)) return false;
  const words = normalise(filters.query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = haystackOf(table, row);
  return words.every((word) => haystack.includes(word));
};

export const isFiltering = (filters: GecFilters) =>
  filters.query.trim() !== "" || filters.category !== ALL || filters.month !== ALL;

/** Today's date in India as YYYY-MM-DD, the timezone every last date on the page is in. */
export const todayInIndia = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Whole days from `today` to `deadline`, both YYYY-MM-DD. Negative once the date has passed. */
export const daysUntil = (deadline: string, today: string) =>
  Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
