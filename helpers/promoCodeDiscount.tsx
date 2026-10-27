import type { PublicPromoCode } from "../endpoints/promo-codes/public_GET.schema";

export type PromoDiscountTerms = Pick<
  PublicPromoCode,
  "discountType" | "discountValue" | "minPurchaseAmount" | "maxDiscountAmount"
>;

/**
 * The discount a coupon gives on one item, or null when it gives none. Mirrors
 * the calculation in endpoints/promo-codes/validate_POST.ts and
 * endpoints/payment/payu/initiate_POST.ts: the minimum purchase must be met,
 * a percentage is capped at maxDiscountAmount, the discount never exceeds the
 * amount, and it is rounded to paise. Keep in sync with those two.
 */
export function promoDiscountFor(terms: PromoDiscountTerms, amount: number): number | null {
  if (!(amount > 0)) return null;
  if (terms.minPurchaseAmount !== null && amount < terms.minPurchaseAmount) return null;
  let discount =
    terms.discountType === "percentage" ? (amount * terms.discountValue) / 100 : terms.discountValue;
  if (terms.discountType === "percentage" && terms.maxDiscountAmount !== null) {
    discount = Math.min(discount, terms.maxDiscountAmount);
  }
  discount = Math.round(Math.min(discount, amount) * 100) / 100;
  return discount > 0 ? discount : null;
}

/** The coupon that takes the most off this amount, with that discount. */
export function bestPromoCode<T extends PromoDiscountTerms>(
  promoCodes: T[],
  amount: number,
): { promo: T; discount: number } | null {
  let best: { promo: T; discount: number } | null = null;
  for (const promo of promoCodes) {
    const discount = promoDiscountFor(promo, amount);
    if (discount !== null && (!best || discount > best.discount)) best = { promo, discount };
  }
  return best;
}