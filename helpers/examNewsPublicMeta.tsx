import type { ExamNewsType } from "./schema";

/*
 * URL rules for the public Exam News pages (SOP "URL Structure and Slug Rules", 1.2):
 *   /exam-news                     hub
 *   /exam-news/{slug}              story
 *   /exam-news/exam/{exam-slug}    one exam
 *   /exam-news/type/{type}         one news type
 *   /exam-news/page/{n}            hub page 2+
 * Filtered listings page the same way: /exam-news/type/{type}/page/{n}, /exam-news/exam/{slug}/page/{n}.
 */

export const HUB_PATH = "/exam-news";

export const PAGE_SIZE = 12;

/** Path segments under /exam-news that can never be story slugs. */
export const RESERVED_SLUGS = ["exam", "type", "page"] as const;

const TYPES: { value: ExamNewsType; segment: string; label: string; plural: string }[] = [
  { value: "notification", segment: "notification", label: "Notification", plural: "Notifications" },
  { value: "admit_card", segment: "admit-card", label: "Admit Card", plural: "Admit Cards" },
  { value: "result", segment: "result", label: "Result", plural: "Results" },
  { value: "answer_key", segment: "answer-key", label: "Answer Key", plural: "Answer Keys" },
  { value: "syllabus", segment: "syllabus", label: "Syllabus", plural: "Syllabus" },
  { value: "cut_off", segment: "cut-off", label: "Cut-off", plural: "Cut-offs" },
  { value: "date_change", segment: "date-change", label: "Date Change", plural: "Date Changes" },
];

/** Shown first in the exam filter and sidebar, when the exam exists. */
export const POPULAR_EXAM_SLUGS = ["upsc-cse", "ssc-cgl", "neet-ug", "jee-main", "ugc-net", "gate"] as const;

const typeFromSegment = (segment: string | undefined): ExamNewsType | null =>
  TYPES.find((t) => t.segment === segment)?.value ?? null;

const typeSegment = (type: ExamNewsType) => TYPES.find((t) => t.value === type)?.segment ?? type;

const typeLabel = (type: ExamNewsType) => TYPES.find((t) => t.value === type)?.label ?? type;

const typePlural = (type: ExamNewsType) => TYPES.find((t) => t.value === type)?.plural ?? type;

const storyPath = (slug: string) => `${HUB_PATH}/${slug}`;

export type ListingScope = { type?: ExamNewsType; examSlug?: string };

/** The listing's page-1 path; page n adds /page/{n}. */
const listingPath = (scope: ListingScope, page = 1): string => {
  const base = scope.type
    ? `${HUB_PATH}/type/${typeSegment(scope.type)}`
    : scope.examSlug
      ? `${HUB_PATH}/exam/${scope.examSlug}`
      : HUB_PATH;
  return page > 1 ? `${base}/page/${page}` : base;
};

/** "/Exam-News//type/Result/" to "/exam-news/type/result": lowercase, single slashes, no trailing slash. */
const normalizePath = (pathname: string): string => {
  const clean = pathname.toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return clean || "/";
};

/** A /page/{n} segment as a page number; null when it is not a whole number of 1 or more. */
const parsePage = (raw: string | undefined): number | null => {
  if (raw === undefined) return 1;
  if (!/^\d{1,4}$/.test(raw)) return null;
  const page = Number(raw);
  return page >= 1 ? page : null;
};

const istDate = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
const istDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
const istLongDay = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });

const formatDate = (date: Date | string | null | undefined) => (date ? istDate.format(new Date(date)) : "");
const formatDateTime = (date: Date | string | null | undefined) => (date ? `${istDateTime.format(new Date(date))} IST` : "");
/** "2026-11-01" to "1 November 2026", without a timezone shift. */
const formatDay = (isoDay: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? istLongDay.format(new Date(`${isoDay}T12:00:00+05:30`)) : isoDay;

/** An edit counts as an update once it lands well after publishing; a quick fix right after does not. */
const wasUpdated = (publishedAt: Date | string | null, updatedAt: Date | string | null) =>
  !!publishedAt && !!updatedAt && new Date(updatedAt).getTime() - new Date(publishedAt).getTime() > 15 * 60_000;

export const examNewsPublicMeta = {
  TYPES,
  HUB_PATH,
  PAGE_SIZE,
  POPULAR_EXAM_SLUGS,
  RESERVED_SLUGS,
  typeFromSegment,
  typeSegment,
  typeLabel,
  typePlural,
  storyPath,
  listingPath,
  normalizePath,
  parsePage,
  formatDate,
  formatDateTime,
  formatDay,
  wasUpdated,
};