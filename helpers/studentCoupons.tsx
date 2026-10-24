import type { MySpinCoupon } from "../endpoints/spin-win/my-coupons_GET.schema";
import { SPIN_CATEGORY_LABELS, type SpinCategory, type SpinCouponStatus } from "./spinWinRules";

export type StudentCouponStatus = "available" | "pending" | "redeemed" | "expired" | "withdrawn";

const FROM_SERVER: Record<SpinCouponStatus, StudentCouponStatus> = {
  active: "available",
  reserved: "pending",
  redeemed: "redeemed",
  expired: "expired",
  void: "withdrawn",
};

export const STUDENT_COUPON_LABELS: Record<StudentCouponStatus | "ineligible", string> = {
  available: "Available",
  pending: "Payment pending",
  redeemed: "Redeemed",
  expired: "Expired",
  withdrawn: "Withdrawn",
  ineligible: "Ineligible",
};

/** A coupon in checkout can be retried: starting payment again cancels the old attempt. */
export const studentCouponStatus = (coupon: Pick<MySpinCoupon, "status">): StudentCouponStatus => FROM_SERVER[coupon.status];

export const isUsableCoupon = (coupon: Pick<MySpinCoupon, "status">) => coupon.status === "active" || coupon.status === "reserved";

/*
 * Wording shared by the My Coupons card and its details modal, so both always describe a coupon
 * the same way. Every figure comes from the coupon row and matches computeSpinDiscount: only
 * eligible items count, the minimum applies to them, and the discount is capped by the coupon's
 * own cap and by maxDiscountPercent of the eligible total.
 */
export const couponRupees = (n: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

export const couponValueLabel = (c: Pick<MySpinCoupon, "discountType" | "discountValue">) =>
  c.discountType === "flat" ? `${couponRupees(c.discountValue)} OFF` : `${c.discountValue}% OFF`;

export const couponTypeLabel = (c: Pick<MySpinCoupon, "discountType">) => (c.discountType === "flat" ? "Flat discount" : "Percentage discount");

export const couponCategories = (categories: string[]) => categories.map((c) => SPIN_CATEGORY_LABELS[c as SpinCategory] ?? c).join(", ");

export const couponMinimumLabel = (c: Pick<MySpinCoupon, "minOrderValue">) =>
  c.minOrderValue > 0 ? `${couponRupees(c.minOrderValue)} on eligible items` : "No minimum order requirement";

export const couponMaxLabel = (c: Pick<MySpinCoupon, "maxDiscountAmount" | "maxDiscountPercent">, full = false) =>
  c.maxDiscountAmount
    ? `${couponRupees(c.maxDiscountAmount)} or ${c.maxDiscountPercent}% of eligible items${full ? ", whichever is lower" : ""}`
    : `${c.maxDiscountPercent}% of eligible items`;

/** "test series, courses and study notes": the categories as a sentence. */
export const couponCategoryPhrase = (categories: string[]) => {
  const names = categories.map((c) => (SPIN_CATEGORY_LABELS[c as SpinCategory] ?? c).toLowerCase());
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
};

export const couponRewardSummary = (c: Pick<MySpinCoupon, "discountType" | "discountValue" | "minOrderValue" | "maxDiscountPercent" | "eligibleCategories">) => {
  const items = couponCategoryPhrase(c.eligibleCategories);
  const minimum = c.minOrderValue > 0 ? ` once they total ${couponRupees(c.minOrderValue)} or more` : "";
  const value = c.discountType === "flat" ? couponRupees(c.discountValue) : `${c.discountValue}%`;
  return `${value} off your ${items}${minimum}, capped at ${c.maxDiscountPercent}% of their value.`;
};

/** The date that matters for the coupon's state: when it expires, expired or was redeemed. */
export const couponDateFact = (c: Pick<MySpinCoupon, "status" | "expiresAt" | "redeemedAt">): { label: string; date: Date | null } => {
  const status = studentCouponStatus(c);
  if (status === "redeemed") return { label: "Redeemed on", date: c.redeemedAt };
  if (status === "expired") return { label: "Expired on", date: c.expiresAt };
  return { label: "Expires on", date: c.expiresAt };
};
