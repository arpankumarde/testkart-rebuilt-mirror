import type { LiveCourseClass } from "./liveCourseData";
import { WEEKDAYS, dateToIst } from "./liveCourseRules";

/* Display-only derivations for the public live course page. Nothing here changes data. */

export type DescriptionBlock = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

const BULLET = /^\s*(?:[-*•●▪‣⁃]|\d{1,2}[.)])\s+/;

/** Splits a teacher-written description into paragraphs and bullet lists. */
export function descriptionBlocks(text: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join("\n") });
    para = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: "ul", items: list });
    list = [];
  };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
    } else if (BULLET.test(line)) {
      flushPara();
      list.push(line.replace(BULLET, ""));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

const LEAD_MAX = 240;

/** The hero lead and whatever the overview should still show, so the two never repeat. */
export function splitLead(blocks: DescriptionBlock[]): { lead: string | null; rest: DescriptionBlock[] } {
  const first = blocks[0];
  if (!first || first.kind !== "p") return { lead: null, rest: blocks };
  if (first.text.length <= LEAD_MAX) return { lead: first.text, rest: blocks.slice(1) };
  const cut = first.text.slice(0, LEAD_MAX);
  return { lead: `${cut.slice(0, cut.lastIndexOf(" ") > 120 ? cut.lastIndexOf(" ") : LEAD_MAX).trim()}...`, rest: blocks };
}

const mode = <T,>(values: T[]): { value: T; share: number } | null => {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T = values[0];
  let bestCount = 0;
  counts.forEach((n, v) => {
    if (n > bestCount) {
      best = v;
      bestCount = n;
    }
  });
  return { value: best, share: bestCount / values.length };
};

const istWeekdayOf = (at: Date | string): number => {
  const { date } = dateToIst(at);
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
};

const formatHm = (hm: string): string => {
  const [h, m] = hm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
};

function weekdayLabel(days: number[]): string {
  if (days.length === 7) return "Every day";
  const sorted = [...days].sort((a, b) => a - b);
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  const short = (d: number) => WEEKDAYS.find((w) => w.value === d)?.short ?? "";
  if (sorted.length >= 3 && consecutive) return `${short(sorted[0])} to ${short(sorted[sorted.length - 1])}`;
  return sorted.map(short).join(", ");
}

export type ScheduleSummary = {
  /** "Mon to Sat", or null when classes fall on no steady weekdays. */
  days: string | null;
  /** "7:30 pm", or null when start times vary. */
  time: string | null;
  /** The usual class length in minutes. */
  minutes: number | null;
  weeks: number | null;
  first: Date | null;
  last: Date | null;
};

export function scheduleSummary(classes: LiveCourseClass[]): ScheduleSummary {
  const held = classes.filter((c) => c.status !== "cancelled");
  if (held.length === 0) return { days: null, time: null, minutes: null, weeks: null, first: null, last: null };
  const dayCounts = new Map<number, number>();
  for (const c of held) {
    const d = istWeekdayOf(c.startTime);
    dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
  }
  const weeks = (() => {
    const first = new Date(held[0].startTime).getTime();
    const last = new Date(held[held.length - 1].startTime).getTime();
    return Math.max(1, Math.ceil((last - first + 86400000) / (7 * 86400000)));
  })();
  const steadyDays = [...dayCounts.entries()].filter(([, n]) => n >= Math.max(1, Math.floor(weeks / 2))).map(([d]) => d);
  const time = mode(held.map((c) => dateToIst(c.startTime).time));
  const minutes = mode(held.map((c) => c.durationMinutes));
  return {
    days: steadyDays.length ? weekdayLabel(steadyDays) : null,
    time: time && time.share >= 0.6 ? formatHm(time.value) : null,
    minutes: minutes ? minutes.value : null,
    weeks,
    first: new Date(held[0].startTime),
    last: new Date(held[held.length - 1].startTime),
  };
}

export type MonthGroup = { key: string; label: string; classes: LiveCourseClass[] };

/** Classes bucketed by IST calendar month, in order. */
export function classesByMonth(classes: LiveCourseClass[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const c of classes) {
    const key = dateToIst(c.startTime).date.slice(0, 7);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const label = new Date(c.startTime).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "long", year: "numeric" });
      group = { key, label, classes: [] };
      groups.push(group);
    }
    group.classes.push(c);
  }
  return groups;
}

export const istDayParts = (at: Date | string) => {
  const d = new Date(at);
  return {
    day: d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric" }),
    weekday: d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short" }),
    time: d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }),
  };
};
