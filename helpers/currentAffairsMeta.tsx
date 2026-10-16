import type {
  CurrentAffairsContentType,
  CurrentAffairsLanguage,
  CurrentAffairsStatus,
  CurrentAffairsTagKind,
} from "./schema";

const CONTENT_TYPES: { value: CurrentAffairsContentType; label: string; short: string }[] = [
  { value: "daily_digest", label: "Daily Digest", short: "Daily" },
  { value: "editorial_analysis", label: "Editorial Analysis", short: "Editorial" },
  { value: "weekly_digest", label: "Weekly Digest", short: "Weekly" },
  { value: "monthly_digest", label: "Monthly Digest", short: "Monthly" },
  { value: "individual_item", label: "Individual Current Affairs Item", short: "Single item" },
];

const STATUSES: { value: CurrentAffairsStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const LANGUAGES: { value: CurrentAffairsLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
];

const TAG_KINDS: { value: CurrentAffairsTagKind; label: string; plural: string }[] = [
  { value: "topic", label: "Topic", plural: "Topics" },
  { value: "exam", label: "Exam", plural: "Exams" },
  { value: "syllabus", label: "Syllabus", plural: "Syllabus" },
];

const DIGEST_TYPES: readonly CurrentAffairsContentType[] = ["daily_digest", "weekly_digest", "monthly_digest"];

const DEFAULT_QUIZ_QUESTIONS = 5;
const OPTIONS_PER_QUESTION = 4;
const DIGEST_TARGET = { min: 8, max: 12 } as const;
const WORDS_PER_MINUTE = 200;

const IST_OFFSET_MS = 330 * 60 * 1000;

const contentTypeLabel = (value: CurrentAffairsContentType) =>
  CONTENT_TYPES.find((t) => t.value === value)?.label ?? value;

const contentTypeShort = (value: CurrentAffairsContentType) =>
  CONTENT_TYPES.find((t) => t.value === value)?.short ?? value;

const statusLabel = (value: CurrentAffairsStatus) => STATUSES.find((s) => s.value === value)?.label ?? value;

const languageLabel = (value: CurrentAffairsLanguage) => LANGUAGES.find((l) => l.value === value)?.label ?? value;

const isDigest = (value: CurrentAffairsContentType) => DIGEST_TYPES.includes(value);

/** A Date as the "YYYY-MM-DDTHH:mm" an IST datetime-local input holds. */
const toIstInput = (date: Date | string | null | undefined): string => {
  if (!date) return "";
  const time = new Date(date).getTime();
  if (!Number.isFinite(time)) return "";
  return new Date(time + IST_OFFSET_MS).toISOString().slice(0, 16);
};

/** "YYYY-MM-DDTHH:mm" read as IST wall-clock time. */
const fromIstInput = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+05:30`);
  return Number.isFinite(date.getTime()) ? date : null;
};

/** Today's calendar day in IST, as YYYY-MM-DD. */
const istToday = (): string => toIstInput(new Date()).slice(0, 10);

const istDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const istDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const formatIst = (date: Date | string | null | undefined): string => {
  if (!date) return "";
  const d = new Date(date);
  return Number.isFinite(d.getTime()) ? `${istDateTimeFormatter.format(d)} IST` : "";
};

/** "2026-10-23" to "23 October 2026", without a timezone shift. */
const formatDay = (isoDay: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) return isoDay;
  return istDateFormatter.format(new Date(`${isoDay}T12:00:00+05:30`));
};

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const wordCount = (texts: string[]): number =>
  texts.reduce((sum, text) => {
    const plain = stripHtml(text);
    return sum + (plain ? plain.split(" ").length : 0);
  }, 0);

const readingMinutes = (texts: string[]): number => Math.max(1, Math.round(wordCount(texts) / WORDS_PER_MINUTE));

export const currentAffairsMeta = {
  CONTENT_TYPES,
  STATUSES,
  LANGUAGES,
  TAG_KINDS,
  DEFAULT_QUIZ_QUESTIONS,
  OPTIONS_PER_QUESTION,
  DIGEST_TARGET,
  contentTypeLabel,
  contentTypeShort,
  statusLabel,
  languageLabel,
  isDigest,
  toIstInput,
  fromIstInput,
  istToday,
  formatIst,
  formatDay,
  stripHtml,
  readingMinutes,
};