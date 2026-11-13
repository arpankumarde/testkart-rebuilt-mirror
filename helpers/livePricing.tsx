import {
  FULL_SESSION_MINUTES,
  MENTORSHIP_MIN_CLASS_PRICE,
  MENTORSHIP_SESSION_DURATIONS,
  MENTORSHIP_TRIAL_DISCOUNT_PERCENT,
  PACKAGE_MAX_CLASSES_PER_WEEK,
  PACKAGE_WEEKS,
  SHORT_SESSION_MINUTES,
} from "./liveLessonConfig";

/**
 * Shared by server and browser: a teacher's 1:1 prices and the package maths. Teachers set a
 * short session (25 min) and a full session (50 min) price; the trial is that price, or a fixed
 * discount off it when the teacher turns the trial discount on. There is no separate trial price
 * and no free class.
 */

export type LiveClassMinutes = (typeof MENTORSHIP_SESSION_DURATIONS)[number];

export type LivePrices = {
  classShort: number;
  classFull: number;
  trialShort: number;
  trialFull: number;
  trialDiscount: boolean;
};

type PriceColumns = {
  mentorshipRatePerUnit: unknown;
  mentorshipClassPrice60: unknown;
  mentorshipTrialDiscount: unknown;
};

const toNumber = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

export const minClassPrice = (minutes: LiveClassMinutes) => MENTORSHIP_MIN_CLASS_PRICE[minutes];

export const trialPriceFrom = (classPrice: number, minutes: LiveClassMinutes, discount: boolean) =>
  discount ? Math.round((classPrice * (100 - MENTORSHIP_TRIAL_DISCOUNT_PERCENT[minutes])) / 100) : classPrice;

/** Null until the teacher has set both class prices. */
export function resolveLivePrices(row: PriceColumns): LivePrices | null {
  const classShort = toNumber(row.mentorshipRatePerUnit);
  const classFull = toNumber(row.mentorshipClassPrice60);
  if (classShort === null || classFull === null) return null;
  const trialDiscount = row.mentorshipTrialDiscount === true;
  return {
    classShort,
    classFull,
    trialShort: trialPriceFrom(classShort, SHORT_SESSION_MINUTES, trialDiscount),
    trialFull: trialPriceFrom(classFull, FULL_SESSION_MINUTES, trialDiscount),
    trialDiscount,
  };
}

export const isLiveClassMinutes = (m: number): m is LiveClassMinutes =>
  (MENTORSHIP_SESSION_DURATIONS as readonly number[]).includes(m);

export const classPriceFor = (p: LivePrices, minutes: LiveClassMinutes) =>
  minutes === SHORT_SESSION_MINUTES ? p.classShort : p.classFull;
export const trialPriceFor = (p: LivePrices, minutes: LiveClassMinutes) =>
  minutes === SHORT_SESSION_MINUTES ? p.trialShort : p.trialFull;

export const pricesMeetFloors = (p: LivePrices) =>
  p.classShort >= minClassPrice(SHORT_SESSION_MINUTES) &&
  p.classFull >= minClassPrice(FULL_SESSION_MINUTES) &&
  p.trialShort > 0 &&
  p.trialFull > 0;

/** Classes-a-week choices for a teacher who teaches on `teachingDays` weekdays (one class a day). */
export const packagePerWeekOptions = (teachingDays: number) =>
  Array.from({ length: Math.max(0, Math.min(teachingDays, PACKAGE_MAX_CLASSES_PER_WEEK)) }, (_, i) => i + 1);

export const packageClassCount = (classesPerWeek: number) => classesPerWeek * PACKAGE_WEEKS;
export const packageCycleTotal = (pricePerClass: number, classesPerWeek: number) =>
  pricePerClass * packageClassCount(classesPerWeek);
/** The mandate cap: this teacher's biggest package at the chosen class length. */
export const packageMandateMax = (pricePerClass: number) => pricePerClass * packageClassCount(PACKAGE_MAX_CLASSES_PER_WEEK);

/** A 1:1 class length by name. Classes booked at the older 30 / 60 minute lengths keep the matching name. */
export const classLengthName = (minutes: number) => (minutes <= 30 ? "Short session" : "Full session");

/** "Short session (25 min)": the name first, the minutes as a detail. */
export const formatClassLength = (minutes: number) => `${classLengthName(minutes)} (${minutes} min)`;

export const formatRupees = (amount: number) =>
  `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2 })}`;