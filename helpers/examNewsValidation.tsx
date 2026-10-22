import type { InputType, ValidationIssue } from "../endpoints/admin/exam-news/save_POST.schema";
import { examNewsMeta } from "./examNewsMeta";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isBlank = (value: string) => examNewsMeta.stripHtml(value).length === 0;

export const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
};

const isValidDay = (value: string) => DAY_PATTERN.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime());

const KEY_DATE_FIELDS = ["startDate", "endDate", "examDate", "resultDate"] as const;

/**
 * Field-level checks keyed by the editor's form paths. A draft only needs a headline and well-formed
 * values; scheduling or publishing also needs the standfirst, exam, author and story. Key dates,
 * sources and corrections stay optional, but any row that is filled in must be complete.
 */
export function validateExamNews(input: InputType, now: Date = new Date()): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const strict = input.status !== "draft";
  const add = (path: string, message: string) => issues.push({ path, message });

  if (!input.title.trim()) add("title", "Add a headline");
  if (input.slug && !SLUG_PATTERN.test(input.slug)) add("slug", "Use lowercase letters, numbers and single hyphens");

  const publishAt = input.publishAt ? examNewsMeta.fromIstInput(input.publishAt) : null;
  if (input.publishAt && !publishAt) add("publishAt", "Enter a valid date and time");
  if (input.status === "scheduled") {
    if (!input.publishAt) add("publishAt", "Choose when this goes live");
    else if (publishAt && publishAt.getTime() <= now.getTime() + 60_000) add("publishAt", "A scheduled time must be in the future");
  }
  if (input.status === "published" && publishAt && publishAt.getTime() > now.getTime() + 60_000) {
    add("publishAt", "This time is in the future - choose Schedule for later instead");
  }

  input.keyDates.forEach((row, index) => {
    const base = `keyDates.${index}`;
    const filled = KEY_DATE_FIELDS.filter((field) => row[field].trim());
    if (!row.eventName.trim() && filled.length === 0 && !row.note.trim()) return;
    if (!row.eventName.trim()) add(`${base}.eventName`, "Name the event");
    if (filled.length === 0) add(`${base}.startDate`, "Add a date or a status such as To be announced");
  });

  const officialName = input.officialSourceName.trim();
  const officialUrl = input.officialSourceUrl.trim();
  if (officialUrl && !isHttpUrl(officialUrl)) add("officialSourceUrl", "Enter a full link starting with https://");
  if (officialName && !officialUrl) add("officialSourceUrl", "Add the link to the official notice");

  input.sources.forEach((source, index) => {
    const name = source.name.trim();
    const url = source.url.trim();
    if (!name && !url) return;
    if (!url) add(`sources.${index}.url`, "Add the link");
    else if (!isHttpUrl(url)) add(`sources.${index}.url`, "Enter a full link starting with https://");
  });

  input.corrections.forEach((correction, index) => {
    if (!correction.date && !correction.note.trim()) return;
    if (!isValidDay(correction.date)) add(`corrections.${index}.date`, "Date the correction");
    if (!correction.note.trim()) add(`corrections.${index}.note`, "Describe what was corrected");
  });

  if (input.canonicalUrl.trim() && !isHttpUrl(input.canonicalUrl)) {
    add("canonicalUrl", "Enter a full link starting with https://");
  }

  if (strict) {
    if (!input.summary.trim()) add("summary", "Write a one or two line standfirst");
    if (!input.examId) add("examId", "Choose the exam this story is about");
    if (!input.authorId) add("authorId", "Choose an author");
    if (isBlank(input.body)) add("body", "Write the story");
    if (input.heroImageUrl && !input.heroImageAlt.trim()) add("heroImageAlt", "Describe the image for screen readers");
  }

  return issues;
}