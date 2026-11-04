import { courseEffectivePrice } from "./coursePricing";
import { promoCodeAppliesToItem, type PromoItemType } from "./promoCodeEligibility";
import { promoDiscountFor } from "./promoCodeDiscount";

/*
 * Teacher offers on courses and study notes. A teacher's public, active coupon
 * is applied to their courses and notes automatically: course listings, the
 * course and study note pages, the cart and checkout all show the same
 * coupon-adjusted price, and the server picks and charges it. A cart gets at most one automatic offer per item (see
 * helpers/cartCouponStack), and the student can add one coupon of their own on
 * top. Tests, live tests and bundles never get an automatic offer, even when
 * the coupon also covers them; typing the code still applies it to them.
 */

/** Cart line kinds that take an automatic teacher offer. */
export type AutoOfferKind = "course" | "digitalProduct";

export const AUTO_OFFER_KINDS: readonly AutoOfferKind[] = ["course", "digitalProduct"];

const PROMO_ITEM_TYPE: Record<AutoOfferKind, PromoItemType> = {
  course: "course",
  digitalProduct: "digital_product",
};

export const isAutoOfferKind = (kind: string): kind is AutoOfferKind =>
  (AUTO_OFFER_KINDS as readonly string[]).includes(kind);

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
  validFrom: Date;
  validUntil: Date | null;
};

/** The automatic offer on one course or study note, priced by the server. */
export type CourseCouponOffer = {
  promoCodeId: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  /** The item's list price. */
  originalPrice: number;
  /** What the item costs before the coupon: its sale price, else the list price. */
  basePrice: number;
  discountAmount: number;
  finalPrice: number;
  /** Total saving against the list price, in whole percent. */
  percentOff: number;
  validFrom: Date;
  validUntil: Date | null;
};

/** An automatic teacher offer on a cart, as the server will charge it. */
export type CartAutoCoupon = {
  promoCodeId: number;
  code: string;
  /** The teacher who created the coupon; it only covers their items. */
  teacherId: number;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;
  /** Courses in the cart the discount is spread across. */
  eligibleCourseIds: number[];
  /** Study notes in the cart the discount is spread across. */
  eligibleDigitalProductIds: number[];
};

export type CartOfferLine = {
  kind: AutoOfferKind;
  id: number;
  teacherId: number | null;
  /** Effective price: the sale price when valid, else the list price. */
  price: number;
};

const roundPaise = (amount: number) => Math.round(amount * 100) / 100;

/** Highest discount first; the older coupon wins a tie so the pick is stable. */
const byDiscountThenId = (a: { discount: number; id: number }, b: { discount: number; id: number }) =>
  b.discount - a.discount || a.id - b.id;

export function couponCoversItem(
  candidate: CourseCouponCandidate,
  kind: AutoOfferKind,
  itemId: number,
  teacherId: number | null
): boolean {
  return candidate.createdByTeacherId === teacherId && promoCodeAppliesToItem(candidate, PROMO_ITEM_TYPE[kind], itemId);
}

/** Whether a cart offer's discount is spread over this line. */
export function offerCoversLine(offer: CartAutoCoupon, line: { kind: string; id: number }): boolean {
  if (line.kind === "course") return offer.eligibleCourseIds.includes(line.id);
  if (line.kind === "digitalProduct") return offer.eligibleDigitalProductIds.includes(line.id);
  return false;
}

/** The best automatic offer for one course or study note, or null when none gives a discount. */
export function bestItemCouponOffer(
  candidates: CourseCouponCandidate[],
  kind: AutoOfferKind,
  item: { id: number; teacherId: number | null; price: number | string; discountPrice: number | string | null }
): CourseCouponOffer | null {
  const originalPrice = Number(item.price) || 0;
  const basePrice = courseEffectivePrice(item.price, item.discountPrice);
  if (!(basePrice > 0)) return null;

  const ranked = candidates
    .filter((c) => couponCoversItem(c, kind, item.id, item.teacherId))
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
    validFrom: best.candidate.validFrom,
    validUntil: best.candidate.validUntil,
  };
}

export function bestCourseCouponOffer(
  candidates: CourseCouponCandidate[],
  course: { id: number; teacherId: number | null; price: number | string; discountPrice: number | string | null }
): CourseCouponOffer | null {
  return bestItemCouponOffer(candidates, "course", course);
}

/**
 * Every offer that would discount this cart, best first. The minimum purchase
 * is checked against the cart's eligible items, and a percentage cap applies
 * to the whole order, as it does for a typed code.
 */
export function rankCartAutoCoupons(
  candidates: CourseCouponCandidate[],
  lines: CartOfferLine[]
): CartAutoCoupon[] {
  const ranked: Array<CartAutoCoupon & { id: number; discount: number }> = [];
  for (const c of candidates) {
    const eligible = lines.filter((l) => l.price > 0 && couponCoversItem(c, l.kind, l.id, l.teacherId));
    if (eligible.length === 0) continue;
    const eligibleTotal = eligible.reduce((sum, l) => sum + l.price, 0);
    const discount = promoDiscountFor(c, eligibleTotal);
    if (discount === null) continue;
    ranked.push({
      id: c.id,
      discount,
      promoCodeId: c.id,
      code: c.code,
      teacherId: c.createdByTeacherId,
      discountType: c.discountType,
      discountValue: c.discountValue,
      discountAmount: discount,
      eligibleCourseIds: eligible.filter((l) => l.kind === "course").map((l) => l.id),
      eligibleDigitalProductIds: eligible.filter((l) => l.kind === "digitalProduct").map((l) => l.id),
    });
  }
  return ranked.sort(byDiscountThenId).map(({ id: _id, discount: _discount, ...offer }) => offer);
}

/** "2 courses", "1 study note", "1 course and 2 study notes". */
export function describeOfferItems(courseCount: number, noteCount: number): string {
  const parts = [
    courseCount > 0 ? `${courseCount} course${courseCount === 1 ? "" : "s"}` : null,
    noteCount > 0 ? `${noteCount} study note${noteCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" and ") : "0 items";
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
 * The one way a course or study note price is shown: list price, sale price
 * and the server's automatic offer. Never recomputes the coupon; it only reads couponOffer.
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
