import { z } from "zod";
import { spinAdminFetch, spinQuery } from "../../../helpers/spinWinAdminFetch";
import type {
  SpinDailyPoint,
  SpinFinance,
  SpinRange,
  SpinRewardRow,
  SpinStats,
  SpinTypeCost,
} from "../../../helpers/spinWinAnalytics";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const schema = z.object({
  campaignId: z.coerce.number().int().positive().optional(),
  from: day.optional(),
  to: day.optional(),
});

export type InputType = z.input<typeof schema>;

export type OutputType = {
  range: SpinRange;
  stats: SpinStats;
  finance: SpinFinance;
  daily: SpinDailyPoint[];
  rewards: SpinRewardRow[];
  typeCosts: SpinTypeCost[];
  discountFunding: string | null;
};

export const getAdminSpinAnalytics = (params: InputType, init?: RequestInit) =>
  spinAdminFetch<OutputType>(`analytics${spinQuery(schema.parse(params))}`, undefined, init);