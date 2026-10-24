import { z } from "zod";
import type { AdminSpinCampaign } from "../../../helpers/spinWinAdmin";
import type { SpinDailyPoint, SpinFinance, SpinRange, SpinStats } from "../../../helpers/spinWinAnalytics";
import { spinAdminFetch, spinQuery } from "../../../helpers/spinWinAdminFetch";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const schema = z.object({
  from: day.optional(),
  to: day.optional(),
});

export type InputType = z.infer<typeof schema>;

export type AdminSpinCampaignRow = AdminSpinCampaign & {
  spins: number;
  coupons: number;
  redeemed: number;
  activeRewards: number;
  probabilityTotal: number;
};

export type OutputType = {
  campaigns: AdminSpinCampaignRow[];
  range: SpinRange;
  stats: SpinStats;
  finance: SpinFinance;
  daily: SpinDailyPoint[];
};

export const getAdminSpinCampaigns = (params: InputType = {}, init?: RequestInit) =>
  spinAdminFetch<OutputType>(`campaigns${spinQuery(schema.parse(params))}`, undefined, init);