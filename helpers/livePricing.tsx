import {
  MENTORSHIP_MIN_CLASS_PRICE,
  MENTORSHIP_SESSION_DURATIONS,
  MENTORSHIP_TRIAL_DISCOUNT_PERCENT,
  PACKAGE_MAX_CLASSES_PER_WEEK,
  PACKAGE_WEEKS,
} from "./liveLessonConfig";

/**
 * Shared by server and browser: a teacher's 1:1 prices and the package maths. Teachers set a
 * 30-minute and a 60-minute class price; the trial is that price, or a fixed discount off it when
 * the teacher turns the trial discount on. There is no separate trial price and no free class.
 */

export type LiveClassMinutes = (typeof MENTORSHIP_SESSION_DURATIONS)[number];

export type LivePrices = {
  class30: number;
  class60: number;
  trial30: number;
  trial60: number;
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
  const class30 = toNumber(row.mentorshipRatePerUnit);
  const class60 = toNumber(row.mentorshipClassPrice60);
  if (class30 === null || class60 === null) return null;
  const trialDiscount = row.mentorshipTrialDiscount === true;
  return {
    class30,
    class60,
    trial30: trialPriceFrom(class30, 30, trialDiscount),
    trial60: trialPriceFrom(class60, 60, trialDiscount),
    trialDiscount,
  };
}

export const isLiveClassMinutes = (m: number): m is LiveClassMinutes =>
  (MENTORSHIP_SESSION_DURATIONS as readonly number[]).includes(m);

export const classPriceFor = (p: LivePrices, minutes: LiveClassMinutes) => (minutes === 30 ? p.class30 : p.class60);
export const trialPriceFor = (p: LivePrices, minutes: LiveClassMinutes) => (minutes === 30 ? p.trial30 : p.trial60);

export const pricesMeetFloors = (p: LivePrices) =>
  p.class30 >= minClassPrice(30) && p.class60 >= minClassPrice(60) && p.trial30 > 0 && p.trial60 > 0;

export const PACKAGE_CLASSES_PER_WEEK_OPTIONS = Array.from({ length: PACKAGE_MAX_CLASSES_PER_WEEK }, (_, i) => i + 1);

export const packageClassCount = (classesPerWeek: number) => classesPerWeek * PACKAGE_WEEKS;
export const packageCycleTotal = (pricePerClass: number, classesPerWeek: number) =>
  pricePerClass * packageClassCount(classesPerWeek);
/** The mandate cap: this teacher's biggest package at the chosen class length. */
export const packageMandateMax = (pricePerClass: number) => pricePerClass * packageClassCount(PACKAGE_MAX_CLASSES_PER_WEEK);

export const formatRupees = (amount: number) =>
  `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2 })}`;