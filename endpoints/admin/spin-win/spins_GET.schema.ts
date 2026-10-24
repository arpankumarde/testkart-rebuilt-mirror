import { z } from "zod";
import { spinAdminFetch, spinQuery } from "../../../helpers/spinWinAdminFetch";
import type { SpinCouponStatus } from "../../../helpers/spinWinRules";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const schema = z.object({
  campaignId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  claimStatus: z.enum(["unclaimed", "claimed", "forfeited"]).optional(),
  spunAs: z.enum(["user", "guest"]).optional(),
  from: day.optional(),
  to: day.optional(),
});

export type InputType = z.input<typeof schema>;

export type AdminSpinRow = {
  id: string;
  campaignId: number;
  campaignName: string;
  userId: number | null;
  studentName: string | null;
  studentEmail: string | null;
  studentMobile: string | null;
  spunAs: "user" | "guest";
  /** First characters of the guest browser session, enough to match rows without exposing the token. */
  sessionRef: string | null;
  spunAt: Date;
  rewardName: string;
  claimStatus: string;
  claimedAt: Date | null;
  forfeitReason: string | null;
  couponCode: string | null;
  couponStatus: SpinCouponStatus | null;
};

export type OutputType = { rows: AdminSpinRow[]; total: number; page: number; pageSize: number };

export const getAdminSpinSpins = (params: InputType, init?: RequestInit) =>
  spinAdminFetch<OutputType>(`spins${spinQuery(schema.parse(params) as Record<string, string | number | undefined>)}`, undefined, init);