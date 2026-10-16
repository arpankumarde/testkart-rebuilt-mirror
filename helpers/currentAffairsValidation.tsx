import type { InputType, ValidationIssue } from "../endpoints/admin/current-affairs/save_POST.schema";
import { currentAffairsMeta } from "./currentAffairsMeta";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isBlank = (value: string) => currentAffairsMeta.stripHtml(value).length === 0;

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
};

const isValidDay = (value: string) => DAY_PATTERN.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime());

type Source = { name: string; url: string };

/** Rows with both fields blank are treated as unused and dropped on save. */
const checkSources = (
  sources: Source[],
  base: string,
  strict: boolean,
  issues: ValidationIssue[],
  requireOne: string | null
) => {
  let filled = 0;
  sources.forEach((source, index) => {
    const name = source.name.trim();
    const url = source.url.trim();
    if (!name && !url) return;
    filled++;
    if (url && !isHttpUrl(url)) {
      issues.push({ path: `${base}.${index}.url`, message: "Enter a full link starting with https://" });
    }
    if (strict && !url) issues.push({ path: `${base}.${index}.url`, message: "Add the source link" });
    if (strict && !name) issues.push({ path: `${base}.${index}.name`, message: "Name the source, e.g. PIB" });
  });
  if (strict && requireOne && filled === 0) {
    issues.push({ path: requireOne, message: "Add at least one source" });
  }
};

/**
 * Field-level checks keyed by the editor's form paths. A draft only needs a title and well-formed
 * values; scheduling or publishing needs everything the public page renders.
 * List-wide messages use their own keys (itemCount, quiz.questionCount) so they never collide with
 * the per-row paths beneath a list.
 */
export function validateCurrentAffairs(input: InputType, now: Date = new Date()): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const strict = input.status !== "draft";
  const add = (path: string, message: string) => issues.push({ path, message });

  if (!input.title.trim()) add("title", "Add a headline");
  if (input.slug && !SLUG_PATTERN.test(input.slug)) {
    add("slug", "Use lowercase letters, numbers and single hyphens");
  }

  const publishAt = input.publishAt ? currentAffairsMeta.fromIstInput(input.publishAt) : null;
  if (input.publishAt && !publishAt) add("publishAt", "Enter a valid date and time");
  if (input.digestDate && !isValidDay(input.digestDate)) add("digestDate", "Enter a valid date");

  if (input.status === "scheduled") {
    if (!input.publishAt) add("publishAt", "Choose when this goes live");
    else if (publishAt && publishAt.getTime() <= now.getTime() + 60_000) {
      add("publishAt", "A scheduled time must be in the future");
    }
  }
  if (input.status === "published" && publishAt && publishAt.getTime() > now.getTime() + 60_000) {
    add("publishAt", "This time is in the future - set the status to Scheduled instead");
  }

  checkSources(input.sources, "sources", strict, issues, null);

  input.items.forEach((item, index) => {
    const base = `items.${index}`;
    checkSources(item.sources, `${base}.sources`, strict, issues, strict ? `${base}.sources` : null);
    if (!strict) return;
    if (!item.headline.trim()) add(`${base}.headline`, "Add a headline");
    if (isBlank(item.whyInNews)) add(`${base}.whyInNews`, "Say why this is in the news");
    if (isBlank(item.keyPoints)) add(`${base}.keyPoints`, "Add the key points");
    if (item.imageUrl && !item.imageAlt.trim()) add(`${base}.imageAlt`, "Describe the image for screen readers");
  });

  input.corrections.forEach((correction, index) => {
    if (!correction.date && !correction.note.trim()) return;
    if (!isValidDay(correction.date)) add(`corrections.${index}.date`, "Date the correction");
    if (!correction.note.trim()) add(`corrections.${index}.note`, "Describe what was corrected");
  });

  if (strict) {
    if (!input.summary.trim()) add("summary", "Add a short summary");
    if (!input.coverImageUrl) add("coverImageUrl", "Upload a cover image");
    if (input.coverImageUrl && !input.coverImageAlt.trim()) add("coverImageAlt", "Describe the image for screen readers");
    if (!input.authorId) add("authorId", "Choose an author");

    switch (input.contentType) {
      case "daily_digest":
        if (!input.digestDate) add("digestDate", "Choose the day this digest covers");
        if (input.items.length === 0) add("itemCount", "Add at least one item");
        break;
      case "weekly_digest":
      case "monthly_digest":
        if (!input.digestDate) add("digestDate", "Choose the period this digest starts on");
        if (input.items.length === 0 && isBlank(input.body)) add("itemCount", "Add items or an overview");
        break;
      case "editorial_analysis":
        if (isBlank(input.body)) add("body", "Write the analysis");
        if (!input.sources.some((s) => s.name.trim() || s.url.trim())) add("sources", "Add at least one source");
        break;
      case "individual_item":
        if (input.items.length !== 1) add("itemCount", "A single item post holds exactly one story");
        break;
    }
  }

  const quiz = input.quiz;
  if (quiz && quiz.isPublished) {
    if (!quiz.title.trim()) add("quiz.title", "Name the quiz");
    if (quiz.questions.length !== quiz.questionCount) {
      add("quiz.questionCount", `The quiz is set to ${quiz.questionCount} questions but has ${quiz.questions.length}`);
    }
    quiz.questions.forEach((question, index) => {
      const base = `quiz.questions.${index}`;
      if (!question.question.trim()) add(`${base}.question`, "Write the question");
      const seen = new Set<string>();
      question.options.forEach((option, optionIndex) => {
        const text = option.trim().toLowerCase();
        if (!text) add(`${base}.options.${optionIndex}`, "Fill in this option");
        else if (seen.has(text)) add(`${base}.options.${optionIndex}`, "Two options match");
        seen.add(text);
      });
      if (question.options.length !== currentAffairsMeta.OPTIONS_PER_QUESTION) {
        add(`${base}.question`, "Each question needs four options");
      }
      if (question.correctOption === null) add(`${base}.correctOption`, "Mark the correct answer");
      if (!question.explanation.trim()) add(`${base}.explanation`, "Explain the answer");
    });
  }

  return issues;
}