import {
  MENTORSHIP_MIN_RATE_PER_UNIT,
  MENTORSHIP_SESSION_DURATIONS,
  PACKAGE_MAX_CLASSES_PER_WEEK,
  PACKAGE_WEEKS,
} from "./liveLessonConfig";

/** Shared by server and browser: a teacher's four 1:1 prices and the package maths. */

export type LiveClassMinutes = (typeof MENTORSHIP_SESSION_DURATIONS)[number];

export type LivePrices = {
  trial25: number;
  trial50: number;
  class25: number;
  class50: number;
};

type PriceColumns = {
  mentorshipRatePerUnit: unknown;
  mentorshipClassPrice50: unknown;
  mentorshipTrialPrice25: unknown;
  mentorshipTrialPrice50: unknown;
};

const toNumber = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

/** Null when the teacher has never set a class price. Unset 50-minute and trial prices fall back. */
export function resolveLivePrices(row: PriceColumns): LivePrices | null {
  const class25 = toNumber(row.mentorshipRatePerUnit);
  if (class25 === null) return null;
  const class50 = toNumber(row.mentorshipClassPrice50) ?? class25 * 2;
  return {
    class25,
    class50,
    trial25: toNumber(row.mentorshipTrialPrice25) ?? class25,
    trial50: toNumber(row.mentorshipTrialPrice50) ?? class50,
  };
}

export const isLiveClassMinutes = (m: number): m is LiveClassMinutes =>
  (MENTORSHIP_SESSION_DURATIONS as readonly number[]).includes(m);

export const minClassPrice = (minutes: LiveClassMinutes) => MENTORSHIP_MIN_RATE_PER_UNIT * (minutes / 25);

export const classPriceFor = (p: LivePrices, minutes: LiveClassMinutes) => (minutes === 25 ? p.class25 : p.class50);
export const trialPriceFor = (p: LivePrices, minutes: LiveClassMinutes) => (minutes === 25 ? p.trial25 : p.trial50);

export const pricesMeetFloors = (p: LivePrices) =>
  p.class25 >= minClassPrice(25) && p.class50 >= minClassPrice(50) && p.trial25 >= 0 && p.trial50 >= 0;

export const PACKAGE_CLASSES_PER_WEEK_OPTIONS = Array.from({ length: PACKAGE_MAX_CLASSES_PER_WEEK }, (_, i) => i + 1);

export const packageClassCount = (classesPerWeek: number) => classesPerWeek * PACKAGE_WEEKS;
export const packageCycleTotal = (pricePerClass: number, classesPerWeek: number) =>
  pricePerClass * packageClassCount(classesPerWeek);
/** The mandate cap: this teacher's biggest package at the chosen class length. */
export const packageMandateMax = (pricePerClass: number) => pricePerClass * packageClassCount(PACKAGE_MAX_CLASSES_PER_WEEK);

export const formatRupees = (amount: number) =>
  `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2 })}`;
