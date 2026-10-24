import { z } from "zod";
import { spinAdminFetch, spinQuery } from "../../../helpers/spinWinAdminFetch";
import type { AdminSpinCouponRow } from "./coupons_GET.schema";

export const schema = z.object({ id: z.coerce.number().int().positive() });

export type InputType = z.infer<typeof schema>;

export type AdminSpinCouponUsage = {
  orderId: number;
  orderStatus: string;
  originalAmount: number;
  discountAmount: number;
  paidAmount: number;
  createdAt: Date;
};

export type OutputType = {
  coupon: AdminSpinCouponRow & {
    eligibleCategories: string[];
    maxDiscountPercent: number;
    spunAs: string;
    spunAt: Date;
    claimedAt: Date | null;
    voidedAt: Date | null;
    voidedReason: string | null;
    voidedByName: string | null;
  };
  usages: AdminSpinCouponUsage[];
};

export const getAdminSpinCoupon = (params: InputType, init?: RequestInit) =>
  spinAdminFetch<OutputType>(`coupon${spinQuery(schema.parse(params))}`, undefined, init);