import type { MySpinCoupon } from "../endpoints/spin-win/my-coupons_GET.schema";
import type { SpinCouponStatus } from "./spinWinRules";

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