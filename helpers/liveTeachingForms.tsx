import type { AvailabilityWindow } from "../endpoints/teacher/mentorship/availability/get_GET.schema";
import type { OutputType as RateOutput } from "../endpoints/teacher/mentorship/rate_GET.schema";
import type { LiveClassMinutes } from "./livePricing";
import { FULL_SESSION_MINUTES, SHORT_SESSION_MINUTES } from "./liveLessonConfig";
import {
  EMAIL_PATTERN,
  INDIAN_MOBILE_PATTERN,
  LIVE_TEACHING_HEADLINE_MAX,
  LIVE_TEACHING_MIN_BIO_CHARS,
  type LiveTeachingChecklistItem,
  type LiveTeachingChecklistKey,
} from "./liveTeachingRules";

/*
 * Drafts and checks shared by the live teaching application steps and the
 * Live settings page, so both validate prices, hours and profile the same way
 * the endpoints do.
 */

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/* Monday first, the way teachers plan a week. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

export const toMinutes = (time: string) => {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

/* Mirrors the set endpoint's own rule, so the teacher sees it before saving. */
export const rangeProblem = (w: AvailabilityWindow): string | null => {
  const start = toMinutes(w.startTime);
  const end = toMinutes(w.endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return "Enter a start and an end time.";
  if (end <= start) return "End time must be after the start time.";
  return null;
};

export const overlapsAnother = (w: AvailabilityWindow, all: AvailabilityWindow[]) => {
  if (!w.isActive || rangeProblem(w)) return false;
  const start = toMinutes(w.startTime);
  const end = toMinutes(w.endTime);
  return all.some(
    (o) =>
      o !== w &&
      o.isActive &&
      o.dayOfWeek === w.dayOfWeek &&
      !rangeProblem(o) &&
      start < toMinutes(o.endTime) &&
      toMinutes(o.startTime) < end
  );
};

export type HoursDraft = { timezone: string; windows: AvailabilityWindow[] };

export const hoursSnapshot = (d: HoursDraft) =>
  JSON.stringify([
    d.timezone.trim(),
    d.windows.map((w) => [w.dayOfWeek, w.startTime.slice(0, 5), w.endTime.slice(0, 5), w.isActive]),
  ]);

/* requireOpen: the application needs at least one open window; settings may close every day. */
export const hoursProblem = (d: HoursDraft, requireOpen: boolean): string | null => {
  if (!d.timezone.trim()) return "Pick your timezone.";
  if (d.windows.some((w) => rangeProblem(w))) return "Fix the highlighted hours.";
  if (requireOpen && !d.windows.some((w) => w.isActive)) return "Add at least one block of hours students can book.";
  return null;
};

export type PriceKey = "classShort" | "classFull";
export const PRICE_KEYS: PriceKey[] = ["classShort", "classFull"];
export const KEY_MINUTES: Record<PriceKey, LiveClassMinutes> = {
  classShort: SHORT_SESSION_MINUTES,
  classFull: FULL_SESSION_MINUTES,
};
export const KEY_NAME: Record<PriceKey, string> = { classShort: "Short session", classFull: "Full session" };

export type PriceDraft = { classShort: string; classFull: string; trialDiscount: boolean };
export type PriceRules = { min: Record<PriceKey, number>; discountPercent: Record<PriceKey, number> };

export const priceRulesFrom = (data: RateOutput | undefined): PriceRules => ({
  min: { classShort: data?.minClassPriceShort ?? 49, classFull: data?.minClassPriceFull ?? 99 },
  discountPercent: {
    classShort: data?.trialDiscountPercentShort ?? 30,
    classFull: data?.trialDiscountPercentFull ?? 50,
  },
});

export const priceDraftFrom = (data: RateOutput): PriceDraft => ({
  classShort: String(data.prices?.classShort ?? data.minClassPriceShort),
  classFull: String(data.prices?.classFull ?? data.minClassPriceFull),
  trialDiscount: data.trialDiscount,
});

export const priceSnapshot = (d: PriceDraft) => JSON.stringify([d.classShort.trim(), d.classFull.trim(), d.trialDiscount]);

/* One message per price, or null when that price is fine. */
export const priceFieldErrors = (d: PriceDraft, rules: PriceRules): Record<PriceKey, string | null> => {
  const check = (key: PriceKey) => {
    const raw = d[key].trim();
    const value = Number(raw);
    if (!raw) return "Enter a price.";
    if (!Number.isInteger(value) || value <= 0) return "Use whole rupees.";
    if (value < rules.min[key]) return `At least ₹${rules.min[key]}.`;
    if (value > 100000) return "At most ₹1,00,000.";
    return null;
  };
  return { classShort: check("classShort"), classFull: check("classFull") };
};

export const priceValues = (d: PriceDraft) => ({ classShort: Number(d.classShort), classFull: Number(d.classFull) });

export type ContactDraft = { email: string; mobileNumber: string };

export const contactErrors = (d: ContactDraft): Record<keyof ContactDraft, string | null> => ({
  email: !d.email.trim()
    ? "Email address is required."
    : !EMAIL_PATTERN.test(d.email.trim())
      ? "Enter a valid email address."
      : null,
  mobileNumber: !d.mobileNumber.trim()
    ? "Phone number is required."
    : !INDIAN_MOBILE_PATTERN.test(d.mobileNumber.trim())
      ? "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9."
      : null,
});

export type ProfileDraft = {
  avatarUrl: string;
  avatarFileId: string | null;
  tagline: string;
  bio: string;
  expertiseAreas: string[];
  languages: string[];
};

export const profileSnapshot = (d: ProfileDraft) =>
  JSON.stringify([d.avatarUrl, d.tagline.trim(), d.bio.trim(), d.expertiseAreas, d.languages]);

/* extraSubjects: teaching categories from onboarding also count as subjects, as on the server checklist. */
export const profileErrors = (
  d: ProfileDraft,
  extraSubjects: number
): Record<"avatarUrl" | "tagline" | "bio" | "expertiseAreas" | "languages", string | null> => {
  const bioLength = d.bio.trim().length;
  return {
    avatarUrl: d.avatarUrl ? null : "Add a profile photo.",
    tagline: !d.tagline.trim()
      ? "Add a headline."
      : d.tagline.length > LIVE_TEACHING_HEADLINE_MAX
        ? `Keep it to ${LIVE_TEACHING_HEADLINE_MAX} characters.`
        : null,
    bio:
      bioLength < LIVE_TEACHING_MIN_BIO_CHARS
        ? `Write at least ${LIVE_TEACHING_MIN_BIO_CHARS} characters (${LIVE_TEACHING_MIN_BIO_CHARS - bioLength} to go).`
        : null,
    expertiseAreas: d.expertiseAreas.length + extraSubjects > 0 ? null : "Add at least one subject.",
    languages: d.languages.length > 0 ? null : "Add at least one language.",
  };
};

/* Older rows stored expertise as { examName } objects. */
export const expertiseList = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((area) => (typeof area === "string" ? area : ((area as { examName?: string })?.examName ?? "")))
    .filter(Boolean);
};

export const formatDay = (date: Date | null | undefined) =>
  date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export type LiveApplyStep = "contact" | "profile" | "prices" | "hours" | "video" | "review";

export type LiveApplyStepMeta = { key: LiveApplyStep; label: string; hint: string; items: LiveTeachingChecklistKey[] };

/* The application's steps in order, each with the checklist items it completes. */
export const LIVE_APPLY_STEPS: LiveApplyStepMeta[] = [
  { key: "contact", label: "Contact", hint: "Email and phone", items: ["email", "phone"] },
  { key: "profile", label: "Profile", hint: "Photo, headline, bio", items: ["photo", "headline", "bio", "subjects", "languages"] },
  { key: "prices", label: "Prices", hint: "Your 1:1 rates", items: ["rate"] },
  { key: "hours", label: "Hours", hint: "When students book", items: ["hours"] },
  { key: "video", label: "Intro video", hint: "1 to 2 minutes", items: ["video"] },
  { key: "review", label: "Review", hint: "Check and submit", items: [] },
];

export const isLiveApplyStep = (value: string | null): value is LiveApplyStep =>
  LIVE_APPLY_STEPS.some((s) => s.key === value);

export const checklistDone = (checklist: LiveTeachingChecklistItem[], keys: LiveTeachingChecklistKey[]) =>
  keys.every((k) => checklist.find((item) => item.key === k)?.done);

/** The first step with something missing, or review when everything is in place. */
export const firstOpenStep = (checklist: LiveTeachingChecklistItem[]): LiveApplyStep =>
  LIVE_APPLY_STEPS.find((s) => s.items.length > 0 && !checklistDone(checklist, s.items))?.key ?? "review";