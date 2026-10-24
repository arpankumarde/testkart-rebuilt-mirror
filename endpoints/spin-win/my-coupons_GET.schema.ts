import { z } from "zod";
import superjson from "superjson";
import type { SpinCouponStatus } from "../../helpers/spinWinRules";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type MySpinCoupon = {
  id: number;
  code: string;
  campaignName: string;
  campaignSlug: string;
  rewardName: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  minOrderValue: number;
  maxDiscountAmount: number | null;
  maxDiscountPercent: number;
  eligibleCategories: string[];
  issuedAt: Date;
  expiresAt: Date;
  status: SpinCouponStatus;
  /** The paid order it was used on, else the one in checkout. */
  orderId: number | null;
  /** What the student saved, once redeemed. */
  savedAmount: number | null;
  /** When the paid order that used it was completed. */
  redeemedAt: Date | null;
};

export type OutputType = { coupons: MySpinCoupon[] };

export const getSpinWinMyCoupons = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/spin-win/my-coupons`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};