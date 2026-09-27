import Papa from "papaparse";

export const PERFORMANCE_PATH = "/teacher/students/performance";

export type PerformanceTab = "students" | "leaderboards" | "courses" | "notes";

/** Links into the Performance page, used by the content cards' shortcut strip and the notes list. */
export const performanceHref = (
  tab: PerformanceTab,
  target?: { series?: number; live?: number; course?: number; item?: number; note?: number }
): string => {
  const params = new URLSearchParams();
  if (tab !== "students") params.set("tab", tab);
  if (target?.series) params.set("series", String(target.series));
  if (target?.item) params.set("item", String(target.item));
  if (target?.live) params.set("live", String(target.live));
  if (target?.course) params.set("course", String(target.course));
  if (target?.note) params.set("note", String(target.note));
  const query = params.toString();
  return query ? `${PERFORMANCE_PATH}?${query}` : PERFORMANCE_PATH;
};

/** "72.7%", "-12%", or a dash for no score. Negative marking can take a score below zero. */
export const scoreText = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
};

/** 21.57 minutes reads as "21m 34s"; an hour or more as "1h 05m". */
export const durationText = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) return "-";
  const totalSeconds = Math.round(minutes * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

/** DD-MM-YYYY, as elsewhere in the teacher console. */
export const dateText = (value: Date | string | null | undefined): string => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateFormatter.format(date).replace(/\//g, "-");
};

export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
};

export const downloadCsv = (fileStem: string, rows: Record<string, string | number>[]): void => {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileStem}-${dateText(new Date())}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export type SortDirection = "asc" | "desc";

/** Nulls always sink to the bottom, whichever way the column is sorted. */
export const compareNullable = (
  a: number | string | null | undefined,
  b: number | string | null | undefined,
  direction: SortDirection
): number => {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  const result =
    typeof a === "string" && typeof b === "string"
      ? a.localeCompare(b, "en", { sensitivity: "base" })
      : Number(a) - Number(b);
  return direction === "asc" ? result : -result;
};
