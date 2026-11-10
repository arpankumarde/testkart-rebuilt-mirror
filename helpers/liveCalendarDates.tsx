/*
 * Calendar date math for the admin Live Lessons module, pinned to India Standard Time (UTC+05:30,
 * no daylight saving) so the grid matches the times teachers and learners see, whatever time zone
 * the admin's browser is in. Days are passed around as "YYYY-MM-DD" keys.
 */

export const IST_TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60000;
const DAY_MS = 86400000;

export type DayKey = string;
export type CalendarView = "month" | "week" | "day" | "agenda";

const pad = (n: number) => String(n).padStart(2, "0");

function shifted(date: Date | number): Date {
  return new Date((typeof date === "number" ? date : date.getTime()) + IST_OFFSET_MS);
}

export function dayKeyOf(date: Date | number): DayKey {
  const d = shifted(date);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function todayKey(): DayKey {
  return dayKeyOf(Date.now());
}

export function isDayKey(v: string | null | undefined): v is DayKey {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

function parts(key: DayKey) {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

/* The instant an IST day starts. */
export function dayStart(key: DayKey): Date {
  const { y, m, d } = parts(key);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

export function addDays(key: DayKey, n: number): DayKey {
  const { y, m, d } = parts(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/* 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(key: DayKey): number {
  const { y, m, d } = parts(key);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function startOfWeek(key: DayKey): DayKey {
  return addDays(key, -weekdayIndex(key));
}

export function startOfMonth(key: DayKey): DayKey {
  const { y, m } = parts(key);
  return `${y}-${pad(m)}-01`;
}

export function addMonths(key: DayKey, n: number): DayKey {
  const { y, m } = parts(key);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-01`;
}

export function monthOf(key: DayKey): number {
  return parts(key).m;
}

export function dayOfMonth(key: DayKey): number {
  return parts(key).d;
}

export function daysBetween(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let k = from; k < to; k = addDays(k, 1)) out.push(k);
  return out;
}

/* The day keys a view shows, and the instants to fetch for them. */
export function viewRange(view: CalendarView, anchor: DayKey): { days: DayKey[]; from: Date; to: Date } {
  let first: DayKey;
  let end: DayKey;
  if (view === "day") {
    first = anchor;
    end = addDays(anchor, 1);
  } else if (view === "week") {
    first = startOfWeek(anchor);
    end = addDays(first, 7);
  } else if (view === "month") {
    first = startOfWeek(startOfMonth(anchor));
    end = addDays(first, 42);
  } else {
    first = startOfMonth(anchor);
    end = addMonths(anchor, 1);
  }
  return { days: daysBetween(first, end), from: dayStart(first), to: dayStart(end) };
}

export function stepAnchor(view: CalendarView, anchor: DayKey, dir: 1 | -1): DayKey {
  if (view === "day") return addDays(anchor, dir);
  if (view === "week") return addDays(anchor, 7 * dir);
  return addMonths(anchor, dir);
}

/* Minutes since IST midnight. */
export function minutesOfDay(date: Date | number): number {
  const d = shifted(date);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: IST_TZ, ...opts });
const timeFmt = fmt({ hour: "numeric", minute: "2-digit" });
const shortDateFmt = fmt({ day: "numeric", month: "short" });
const longDateFmt = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const monthYearFmt = fmt({ month: "long", year: "numeric" });
const weekdayShortFmt = fmt({ weekday: "short" });
const dateTimeFmt = fmt({ day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export const formatTime = (d: Date | number) => timeFmt.format(d).replace(" ", " ");
export const formatShortDate = (d: Date | number) => shortDateFmt.format(d);
export const formatLongDate = (d: Date | number) => longDateFmt.format(d);
export const formatDateTime = (d: Date | number) => dateTimeFmt.format(d);
export const formatWeekdayShort = (key: DayKey) => weekdayShortFmt.format(dayStart(key));
export const formatDayLong = (key: DayKey) => longDateFmt.format(dayStart(key));

export function formatRangeLabel(view: CalendarView, anchor: DayKey): string {
  if (view === "day") return longDateFmt.format(dayStart(anchor));
  if (view === "week") {
    const first = startOfWeek(anchor);
    const last = addDays(first, 6);
    const a = dayStart(first);
    const b = dayStart(last);
    const sameMonth = monthOf(first) === monthOf(last);
    return sameMonth
      ? `${dayOfMonth(first)} - ${dayOfMonth(last)} ${fmt({ month: "short", year: "numeric" }).format(b)}`
      : `${shortDateFmt.format(a)} - ${fmt({ day: "numeric", month: "short", year: "numeric" }).format(b)}`;
  }
  return monthYearFmt.format(dayStart(anchor));
}

const relFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelative(date: Date | number): string {
  const diffMin = Math.round((new Date(date).getTime() - Date.now()) / 60000);
  if (Math.abs(diffMin) < 60) return relFmt.format(diffMin, "minute");
  const h = Math.round(diffMin / 60);
  if (Math.abs(h) < 24) return relFmt.format(h, "hour");
  return relFmt.format(Math.round(h / 24), "day");
}

export const formatDuration = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;

/*
 * Side-by-side layout for overlapping timed events, as calendar apps do it: events that overlap
 * transitively form a cluster, each event takes the first free column, and every event in a
 * cluster gets the cluster's column count.
 */
export function layoutOverlaps<T extends { key: string; startMin: number; endMin: number }>(
  items: T[]
): Map<string, { col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const result = new Map<string, { col: number; cols: number }>();
  let cluster: T[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = colEnds.length;
    for (const it of cluster) result.get(it.key)!.cols = cols;
    cluster = [];
    colEnds = [];
  };

  for (const it of sorted) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= it.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(it.endMin);
    } else {
      colEnds[col] = it.endMin;
    }
    result.set(it.key, { col, cols: 1 });
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  if (cluster.length) flush();
  return result;
}

export { DAY_MS };