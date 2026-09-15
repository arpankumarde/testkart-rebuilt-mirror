import { z } from "zod";
import superjson from "superjson";

export const PeriodEnum = z.enum([
  'all',
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year',
  'last_year',
  'custom'
]);

export type PeriodType = z.infer<typeof PeriodEnum>;

export const schema = z.object({
  period: PeriodEnum.default('all'),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(),   // ISO date string
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  // Flow metrics (filtered by date)
  totalRevenue: number;
  totalPlatformFee: number;
  totalTeacherEarnings: number;
  totalDisbursed: number;
  subscriptionRevenue: number;
  subscriptionTransactionsCount: number;
  failedSubscriptionTransactionsCount: number;
  sponsoredRevenue: number;

  // Revenue breakdown by product type (flow metrics, filtered by date)
  regularMockTestRevenue: number;
  liveTestRevenue: number;
  courseRevenue: number;
  digitalProductRevenue: number;
  otherRevenue: number;

  // Stock metrics (always all-time)
  totalTeacherWalletBalance: number;
  totalPendingWithdrawals: number;
  activePaidSubscriptionsCount: number;
  totalSubscriptionsCount: number;

  // Student wallet metrics (stock metrics - always all-time)
  studentWalletBalance: number;
  studentPendingWithdrawals: number;
};

export const getAdminFinanceSummary = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  queryParams.set("period", params.period);
  if (params.startDate) queryParams.set("startDate", params.startDate);
  if (params.endDate) queryParams.set("endDate", params.endDate);

  const result = await fetch(`/_api/admin/finance/summary?${queryParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};