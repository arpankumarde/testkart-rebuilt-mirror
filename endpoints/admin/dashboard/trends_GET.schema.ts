import { z } from "zod";
import superjson from "superjson";

export const TrendPeriodValues = ["daily", "weekly", "monthly"] as const;
export type TrendPeriod = (typeof TrendPeriodValues)[number];

export const schema = z.object({
  period: z.enum(TrendPeriodValues),
});

export type InputType = z.infer<typeof schema>;

/**
 * One calendar day, Monday-start week or month in Asia/Kolkata. `start` is its
 * first day as YYYY-MM-DD; the last bucket is the current one, still running.
 * Revenue counts completed orders (sandbox payments left out) plus teacher
 * subscription payments; students and teachers are new sign-ups.
 */
export type TrendBucket = {
  start: string;
  revenue: number;
  orders: number;
  students: number;
  teachers: number;
};

export type OutputType = {
  period: TrendPeriod;
  buckets: TrendBucket[];
  userGrowth: Array<{ period: string; teachers: number; students: number; total: number }>;
  revenueTrend: Array<{ period: string; revenue: number; orders: number }>;
};

export const getAdminDashboardTrends = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ period: query.period });
  const result = await fetch(`/_api/admin/dashboard/trends?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};