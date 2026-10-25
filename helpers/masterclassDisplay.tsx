// Display helpers shared by the public /masterclass list and detail pages.
// Pure functions only, so they are safe on the server render too.

const IST = "Asia/Kolkata";

export type MasterclassPhase = "upcoming" | "live" | "completed" | "cancelled";

/**
 * Where a masterclass sits in its lifecycle right now. Mirrors the server:
 * "completed" once start + duration has passed (the list and get endpoints'
 * isPast), and "live" from the start time, which is also when the register
 * endpoint stops taking sign-ups.
 */
export const getMasterclassPhase = (
  m: { startTime: Date | string; durationMinutes: number | null; status?: string },
  now: number = Date.now()
): MasterclassPhase => {
  if (m.status === "cancelled") return "cancelled";
  const start = new Date(m.startTime).getTime();
  const end = start + (m.durationMinutes ?? 60) * 60 * 1000;
  if (now >= end) return "completed";
  if (now >= start) return "live";
  return "upcoming";
};

const partsOf = (date: Date | string, options: Intl.DateTimeFormatOptions) => {
  const parts = new Intl.DateTimeFormat("en-IN", { ...options, timeZone: IST }).formatToParts(new Date(date));
  return (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
};

/** "Sun, 29 Nov 2026" */
export const formatMasterclassDay = (date: Date | string) => {
  const part = partsOf(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}`;
};

/** "Sunday, 29 November 2026" */
export const formatMasterclassLongDay = (date: Date | string) => {
  const part = partsOf(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}`;
};

/** "10:00 am" */
export const formatMasterclassTime = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST })
    .format(new Date(date))
    .toLowerCase();

/** "45 min", "2 hr", "1 hr 30 min" */
export const formatMasterclassDuration = (minutes: number | null) => {
  const total = minutes ?? 60;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
};

export const hostInitials = (name: string | null) => {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "TK";
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
};

export type MasterclassContentBlock = { type: "paragraph"; text: string } | { type: "list"; items: string[] };

export type MasterclassContent = {
  about: MasterclassContentBlock[];
  learnings: string[];
  hostBio: MasterclassContentBlock[];
  sections: { title: string; blocks: MasterclassContentBlock[] }[];
};

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;
const HEADING = /^\s*#{2,3}\s+(.+?)\s*#*\s*$/;
const LEARNINGS_TITLE = /^(what\s+you(?:'|’)?ll\s+learn|what\s+you\s+will\s+learn|key\s+takeaways)/i;
const HOST_TITLE = /^(about\s+(?:the\s+|your\s+)?host|meet\s+(?:the\s+|your\s+)?host)/i;

const toBlocks = (lines: string[]): MasterclassContentBlock[] => {
  const blocks: MasterclassContentBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: "list", items: list });
    list = [];
  };
  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (BULLET.test(line)) {
      flushParagraph();
      list.push(line.replace(BULLET, "").trim());
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
};

/**
 * Splits the admin's plain-text description into the detail page's sections.
 * Text before any heading is "About this masterclass". A "## What you'll learn"
 * heading feeds the checklist, "## About the host" feeds the host bio, and any
 * other "## Heading" becomes its own section. Lines starting with "-", "*" or
 * "1." become lists. A description with no headings renders exactly as before.
 */
export const parseMasterclassDescription = (description: string | null): MasterclassContent => {
  const content: MasterclassContent = { about: [], learnings: [], hostBio: [], sections: [] };
  if (!description?.trim()) return content;

  const groups: { title: string | null; lines: string[] }[] = [{ title: null, lines: [] }];
  for (const line of description.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = line.match(HEADING);
    if (heading) groups.push({ title: heading[1], lines: [] });
    else groups[groups.length - 1].lines.push(line);
  }

  for (const group of groups) {
    const blocks = toBlocks(group.lines);
    if (blocks.length === 0) continue;
    if (group.title === null) content.about.push(...blocks);
    else if (LEARNINGS_TITLE.test(group.title))
      content.learnings.push(...blocks.flatMap((b) => (b.type === "list" ? b.items : [b.text])));
    else if (HOST_TITLE.test(group.title)) content.hostBio.push(...blocks);
    else content.sections.push({ title: group.title, blocks });
  }
  return content;
};