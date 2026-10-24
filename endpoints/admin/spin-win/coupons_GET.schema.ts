import { z } from "zod";
import { spinAdminFetch, spinQuery } from "../../../helpers/spinWinAdminFetch";
import { SPIN_COUPON_STATUSES, type SpinCouponStatus } from "../../../helpers/spinWinRules";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const COUPON_SORTS = ["issued_desc", "issued_asc", "expires_asc", "expires_desc"] as const;

export const schema = z.object({
  campaignId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  status: z.enum(SPIN_COUPON_STATUSES).optional(),
  sort: z.enum(COUPON_SORTS).default("issued_desc"),
  from: day.optional(),
  to: day.optional(),
});

export type InputType = z.input<typeof schema>;

export type AdminSpinCouponRow = {
  id: number;
  code: string;
  userId: number;
  studentName: string | null;
  studentEmail: string | null;
  studentMobile: string | null;
  rewardName: string;
  rewardType: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  minOrderValue: number;
  maxDiscountAmount: number | null;
  campaignId: number;
  campaignName: string;
  status: SpinCouponStatus;
  issuedAt: Date;
  expiresAt: Date;
  orderId: number | null;
};

export type OutputType = { rows: AdminSpinCouponRow[]; total: number; page: number; pageSize: number };

export const getAdminSpinCoupons = (params: InputType, init?: RequestInit) =>
  spinAdminFetch<OutputType>(`coupons${spinQuery(schema.parse(params) as Record<string, string | number | undefined>)}`, undefined, init);