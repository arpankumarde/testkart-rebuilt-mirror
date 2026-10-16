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

type DigestType = "daily_digest" | "weekly_digest" | "monthly_digest";

/** The three types the editor offers; the other two stay readable for older posts. */
const DIGEST_OPTIONS: { value: DigestType; label: string; hint: string }[] = [
  { value: "daily_digest", label: "Daily Digest", hint: "One day's news, usually 8-12 items" },
  { value: "weekly_digest", label: "Weekly Digest", hint: "A Monday to Sunday round-up" },
  { value: "monthly_digest", label: "Monthly Digest", hint: "The month in review" },
];

const DEFAULT_QUIZ_QUESTIONS = 5;
const OPTIONS_PER_QUESTION = 4;
const DIGEST_TARGET = { min: 8, max: 12 } as const;
const WORDS_PER_MINUTE = 200;

const IST_OFFSET_MS = 330 * 60 * 1000;

const publicPath = (slug: string) => `/current-affairs/${slug}`;

/** Where a published post opens: its public page, relative so it works on preview and live hosts. */
const openHref = (post: { slug: string }) => publicPath(post.slug);

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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const dayParts = (isoDay: string) => {
  const [y, m, d] = isoDay.split("-").map(Number);
  return { y, m, d };
};

const shiftDay = (isoDay: string, days: number): string => {
  const { y, m, d } = dayParts(isoDay);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** The Monday on or before a day. */
const weekStart = (isoDay: string): string => {
  const { y, m, d } = dayParts(isoDay);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return shiftDay(isoDay, -((weekday + 6) % 7));
};

const monthStart = (isoDay: string): string => `${isoDay.slice(0, 7)}-01`;

/** Snaps a day to the start of the period the digest type covers. */
const periodStart = (type: CurrentAffairsContentType, isoDay: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) return isoDay;
  if (type === "weekly_digest") return weekStart(isoDay);
  if (type === "monthly_digest") return monthStart(isoDay);
  return isoDay;
};

/** "23 October 2026", "19-25 October 2026", "October 2026". */
const periodLabel = (type: CurrentAffairsContentType, isoDay: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) return "";
  const { y, m, d } = dayParts(isoDay);
  if (type === "monthly_digest") return `${MONTH_NAMES[m - 1]} ${y}`;
  if (type === "weekly_digest") {
    const end = dayParts(shiftDay(isoDay, 6));
    if (end.m === m) return `${d}-${end.d} ${MONTH_NAMES[m - 1]} ${y}`;
    if (end.y === y) return `${d} ${MONTH_NAMES[m - 1]} - ${end.d} ${MONTH_NAMES[end.m - 1]} ${y}`;
    return `${d} ${MONTH_NAMES[m - 1]} ${y} - ${end.d} ${MONTH_NAMES[end.m - 1]} ${end.y}`;
  }
  return formatDay(isoDay);
};

/** Short period for a thumbnail fallback: "23 Oct", "Week of 19 Oct", "Oct 2026". */
const periodShort = (type: CurrentAffairsContentType, isoDay: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) return "";
  const { y, m, d } = dayParts(isoDay);
  const month = MONTH_NAMES[m - 1].slice(0, 3);
  if (type === "monthly_digest") return `${month} ${y}`;
  if (type === "weekly_digest") return `Week of ${d} ${month}`;
  return `${d} ${month}`;
};

/** Whether a day falls inside the period that starts on `start`. */
const periodContains = (type: CurrentAffairsContentType, start: string, isoDay: string): boolean => {
  if (type === "monthly_digest") return start.slice(0, 7) === isoDay.slice(0, 7);
  if (type === "weekly_digest") return isoDay >= start && isoDay <= shiftDay(start, 6);
  return start === isoDay;
};

/** The headline a digest gets until the admin writes their own. */
const autoTitle = (type: CurrentAffairsContentType, isoDay: string): string => {
  const period = periodLabel(type, isoDay);
  if (!period) return "";
  if (type === "weekly_digest") return `Weekly Current Affairs: ${period}`;
  if (type === "monthly_digest") return `Monthly Current Affairs: ${period}`;
  return `Current Affairs: ${period}`;
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
  DIGEST_OPTIONS,
  publicPath,
  openHref,
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
  periodStart,
  periodContains,
  periodLabel,
  periodShort,
  autoTitle,
  stripHtml,
  readingMinutes,
};