import type { Updateable } from "kysely";
import type { MockTests } from "./schema";
import { sanitizeHtml } from "./sanitizeHtml";

/*
 * Pure pieces of the teacher test series editor, shared by the pages and the
 * teacher endpoints so the rules can be specced without a session or a database.
 */

export type SeriesUpdateInput = {
  title: string;
  description: string;
  price: number;
  subjects?: string[];
  discountPrice?: number | null;
  isFree?: boolean;
  thumbnailUrl?: string | null;
  thumbnailFileId?: string | null;
  introVideoUrl?: string | null;
  introVideoFileId?: string | null;
  language?: string;
  whatYouLearn?: string[] | null;
  requirements?: string[] | null;
  longDescription?: string | null;
};

export type ResolvedExamWrite = { examId: number | null; examName: string | null };

/**
 * The column writes for teacher/tests/update. A field the request leaves out is
 * not written, so a partial save can never blank a stored thumbnail, intro video,
 * list or legacy subject tag. An explicit null or empty string still clears it.
 */
export function buildMockTestUpdateSet(
  input: SeriesUpdateInput,
  extras: { now: Date; slug?: string; exam?: ResolvedExamWrite }
): Updateable<MockTests> {
  const set: Updateable<MockTests> = {
    title: input.title,
    description: input.description,
    price: input.price.toString(),
    updatedAt: extras.now,
  };
  if (extras.slug) set.slug = extras.slug;
  if (extras.exam) {
    set.examId = extras.exam.examId;
    set.examName = extras.exam.examName;
  }
  if (input.subjects !== undefined) set.subject = JSON.stringify(input.subjects);
  if (input.discountPrice !== undefined) {
    set.discountPrice = input.discountPrice === null ? null : input.discountPrice.toString();
  }
  if (input.isFree !== undefined) set.isFree = input.isFree;
  if (input.thumbnailUrl !== undefined) set.thumbnailUrl = input.thumbnailUrl || null;
  if (input.thumbnailFileId !== undefined) set.thumbnailFileId = input.thumbnailFileId || null;
  if (input.introVideoUrl !== undefined) set.introVideoUrl = input.introVideoUrl || null;
  if (input.introVideoFileId !== undefined) set.introVideoFileId = input.introVideoFileId || null;
  if (input.language !== undefined) set.language = input.language;
  if (input.whatYouLearn !== undefined) {
    set.whatYouLearn = input.whatYouLearn ? JSON.stringify(input.whatYouLearn) : null;
  }
  if (input.requirements !== undefined) {
    set.requirements = input.requirements ? JSON.stringify(input.requirements) : null;
  }
  if (input.longDescription !== undefined) set.longDescription = input.longDescription ? sanitizeHtml(input.longDescription) : null;
  return set;
}

/** Stored list columns arrive as a JSON string, an array or null. */
export function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.trim() !== "") {
    try {
      return parseStringList(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

/** Trims every row and drops the blank ones; an empty result is stored as null. */
export function dropBlankEntries(list: readonly string[] | null | undefined): string[] | null {
  const kept = (list ?? []).map((v) => v.trim()).filter((v) => v !== "");
  return kept.length > 0 ? kept : null;
}

/** Tiptap writes an emptied editor as <p></p>, which should save as no description. */
export function isBlankHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  return html.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "").trim() === "";
}

type Issue = { path: (string | number)[]; message: string };

/** The validation issue for the field that sits highest on the page. */
export function pickFirstIssue<T extends Issue>(issues: readonly T[], fieldOrder: readonly string[]): T | null {
  let best: T | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const issue of issues) {
    const rank = fieldOrder.indexOf(String(issue.path[0] ?? ""));
    const effective = rank === -1 ? fieldOrder.length : rank;
    if (effective < bestRank) {
      best = issue;
      bestRank = effective;
    }
  }
  return best;
}

/**
 * Titles for newly added test items: "Test N", counting on from `startAt` and
 * skipping any title a live item in the series already uses.
 */
export function nextFreeTestTitles(existingTitles: Iterable<string>, count: number, startAt: number): string[] {
  const taken = new Set(existingTitles);
  const titles: string[] = [];
  let n = Math.max(1, startAt);
  while (titles.length < count) {
    const candidate = `Test ${n}`;
    if (!taken.has(candidate)) {
      titles.push(candidate);
      taken.add(candidate);
    }
    n++;
  }
  return titles;
}

/**
 * Splits requested subject names into the ones to insert and the ones skipped
 * because the test item (or an earlier entry in the same request) already has
 * that name, compared trimmed and case-insensitively.
 */
export function splitNewSubjectNames(
  requested: readonly string[],
  existing: readonly string[]
): { toCreate: string[]; skipped: string[] } {
  const seen = new Set(existing.map((name) => name.trim().toLowerCase()));
  const toCreate: string[] = [];
  const skipped: string[] = [];
  for (const raw of requested) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) {
      skipped.push(name);
      continue;
    }
    seen.add(key);
    toCreate.push(name);
  }
  return { toCreate, skipped };
}

export type RangeEntry = { fromQ: string; toQ: string };

/**
 * From Q / To Q values after the sections or questions under the editor change.
 * Rows the teacher has typed into keep their values, rows for removed sections
 * go, and every other row takes the value derived from the server.
 */
export function mergeRangeEntries(
  current: Readonly<Record<number, RangeEntry>>,
  derived: Readonly<Record<number, RangeEntry>>,
  touched: ReadonlySet<number>
): Record<number, RangeEntry> {
  const next: Record<number, RangeEntry> = {};
  for (const key of Object.keys(derived)) {
    const id = Number(key);
    next[id] = touched.has(id) && current[id] ? current[id] : derived[id];
  }
  return next;
}
