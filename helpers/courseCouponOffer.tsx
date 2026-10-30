import { courseEffectivePrice } from "./coursePricing";
import { promoCodeAppliesToItem } from "./promoCodeEligibility";
import { promoDiscountFor } from "./promoCodeDiscount";

/*
 * Teacher offers on courses. A teacher's public, active coupon is applied to
 * their courses automatically: listings, the course page and checkout all show
 * the same coupon-adjusted price, and the server picks and charges it. Only one
 * coupon works per order, so a cart gets the single offer that takes the most
 * off. The automatic offer only discounts courses, even when the coupon also
 * covers the teacher's tests or notes; typing the code still applies it to all.
 */

export type CourseCouponCandidate = {
  id: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minPurchaseAmount: number | null;
  maxDiscountAmount: number | null;
  appliesTo: string;
  targetItemIds: number[] | null;
  createdByTeacherId: number;
  validUntil: Date | null;
};

/** The automatic offer on one course, priced by the server. */
export type CourseCouponOffer = {
  promoCodeId: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  /** The course's list price. */
  originalPrice: number;
  /** What the course costs before the coupon: its sale price, else the list price. */
  basePrice: number;
  discountAmount: number;
  finalPrice: number;
  /** Total saving against the list price, in whole percent. */
  percentOff: number;
  validUntil: Date | null;
};

/** The one automatic offer a cart gets, as the server will charge it. */
export type CartAutoCoupon = {
  promoCodeId: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;
  /** Courses in the cart the discount is spread across. */
  eligibleCourseIds: number[];
};

export type CartCourseLine = {
  courseId: number;
  teacherId: number | null;
  /** Effective price: the sale price when valid, else the list price. */
  price: number;
};

const roundPaise = (amount: number) => Math.round(amount * 100) / 100;

/** Highest discount first; the older coupon wins a tie so the pick is stable. */
const byDiscountThenId = (a: { discount: number; id: number }, b: { discount: number; id: number }) =>
  b.discount - a.discount || a.id - b.id;

export function courseCouponCovers(candidate: CourseCouponCandidate, courseId: number, teacherId: number | null): boolean {
  return candidate.createdByTeacherId === teacherId && promoCodeAppliesToItem(candidate, "course", courseId);
}

/** The best automatic offer for one course, or null when none gives a discount. */
export function bestCourseCouponOffer(
  candidates: CourseCouponCandidate[],
  course: { id: number; teacherId: number | null; price: number | string; discountPrice: number | string | null }
): CourseCouponOffer | null {
  const originalPrice = Number(course.price) || 0;
  const basePrice = courseEffectivePrice(course.price, course.discountPrice);
  if (!(basePrice > 0)) return null;

  const ranked = candidates
    .filter((c) => courseCouponCovers(c, course.id, course.teacherId))
    .map((c) => ({ candidate: c, id: c.id, discount: promoDiscountFor(c, basePrice) ?? 0 }))
    .filter((r) => r.discount > 0)
    .sort(byDiscountThenId);
  const best = ranked[0];
  if (!best) return null;

  const finalPrice = roundPaise(basePrice - best.discount);
  return {
    promoCodeId: best.candidate.id,
    code: best.candidate.code,
    discountType: best.candidate.discountType,
    discountValue: best.candidate.discountValue,
    originalPrice,
    basePrice,
    discountAmount: best.discount,
    finalPrice,
    percentOff: originalPrice > 0 ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100) : 0,
    validUntil: best.candidate.validUntil,
  };
}

/**
 * Every offer that would discount this cart, best first. The minimum purchase
 * is checked against the cart's eligible courses, and a percentage cap applies
 * to the whole order, as it does for a typed code.
 */
export function rankCartCourseCoupons(
  candidates: CourseCouponCandidate[],
  lines: CartCourseLine[]
): CartAutoCoupon[] {
  const ranked: Array<CartAutoCoupon & { id: number; discount: number }> = [];
  for (const c of candidates) {
    const eligible = lines.filter((l) => l.price > 0 && courseCouponCovers(c, l.courseId, l.teacherId));
    if (eligible.length === 0) continue;
    const eligibleTotal = eligible.reduce((sum, l) => sum + l.price, 0);
    const discount = promoDiscountFor(c, eligibleTotal);
    if (discount === null) continue;
    ranked.push({
      id: c.id,
      discount,
      promoCodeId: c.id,
      code: c.code,
      discountType: c.discountType,
      discountValue: c.discountValue,
      discountAmount: discount,
      eligibleCourseIds: eligible.map((l) => l.courseId),
    });
  }
  return ranked.sort(byDiscountThenId).map(({ id: _id, discount: _discount, ...offer }) => offer);
}

/** Rupees with paise only when there are any: 1499 -> "₹1,499", 1619.1 -> "₹1,619.10". */
export function formatOfferInr(amount: number): string {
  const whole = Number.isInteger(Math.round(amount * 100) / 100);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

export type CoursePriceView = {
  /** What the student pays. */
  finalPrice: number;
  /** The list price to strike through, or null when nothing is taken off. */
  originalPrice: number | null;
  /** Saving against the list price in whole percent; 0 when there is none. */
  percentOff: number;
  /** The automatic teacher offer behind the price, if any. */
  offer: CourseCouponOffer | null;
  isFree: boolean;
};

/**
 * The one way a course price is shown: list price, sale price and the server's
 * automatic offer. Never recomputes the coupon; it only reads couponOffer.
 */
export function coursePriceView(
  price: number | string,
  discountPrice: number | string | null | undefined,
  couponOffer?: CourseCouponOffer | null
): CoursePriceView {
  const list = Number(price) || 0;
  if (list <= 0) return { finalPrice: 0, originalPrice: null, percentOff: 0, offer: null, isFree: true };
  const offer = couponOffer && couponOffer.finalPrice < courseEffectivePrice(list, discountPrice ?? null) ? couponOffer : null;
  const finalPrice = offer ? offer.finalPrice : courseEffectivePrice(list, discountPrice ?? null);
  const hasSaving = finalPrice < list;
  return {
    finalPrice,
    originalPrice: hasSaving ? list : null,
    percentOff: hasSaving ? Math.round(((list - finalPrice) / list) * 100) : 0,
    offer,
    isFree: false,
  };
}
