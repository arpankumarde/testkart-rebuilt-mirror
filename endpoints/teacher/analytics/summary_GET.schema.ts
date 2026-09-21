import { z } from "zod";
import superjson from "superjson";
import { AnalyticsRangeValues, AnalyticsRange, AnalyticsBucket } from "../../../helpers/teacherAnalyticsTime";

export const schema = z.object({
  range: z.enum(AnalyticsRangeValues).default("30d"),
});

export type InputType = z.infer<typeof schema>;

export type AnalyticsKpiPair = { current: number; previous: number };

export type AnalyticsSummaryKpis = {
  /** Net of the platform fee, from the same sale rows as Overview and Earnings. */
  net: AnalyticsKpiPair;
  gross: AnalyticsKpiPair;
  /**
   * Distinct completed orders where the teacher's share was paid for. Free
   * claims (about three in four orders platform-wide) are counted apart in
   * freeOrders so they do not drag the average order value toward zero.
   */
  orders: AnalyticsKpiPair;
  freeOrders: AnalyticsKpiPair;
  /** Gross per paid order: the teacher's share of an average basket. */
  averageOrderValue: AnalyticsKpiPair;
  /** Orders placed in the window that were later refunded. */
  refunds: AnalyticsKpiPair;
  /** Percent of paid plus refunded orders that were refunded. */
  refundRate: AnalyticsKpiPair;
  /** Average stars of reviews written in the window; 0 when there were none. */
  averageRating: AnalyticsKpiPair;
  reviews: AnalyticsKpiPair;
  /** Distinct browsers that viewed the teacher's profile or any of their items. */
  visitors: AnalyticsKpiPair;
  views: AnalyticsKpiPair;
  /** Orders with money to pay holding the teacher's content, and how many of them were paid. */
  paymentAttempts: AnalyticsKpiPair;
  paymentsPaid: AnalyticsKpiPair;
};

/** One day (YYYY-MM-DD) or, for 12 months, one month (YYYY-MM). */
export type AnalyticsSummaryPoint = {
  bucket: string;
  net: number;
  gross: number;
  orders: number;
  averageOrderValue: number;
};

export type OutputType = {
  range: AnalyticsRange;
  bucket: AnalyticsBucket;
  generatedAt: Date;
  /** When visit tracking started on the site; null until the first visit is recorded. */
  trackingSince: Date | null;
  kpis: AnalyticsSummaryKpis;
  series: AnalyticsSummaryPoint[];
};

export const getTeacherAnalyticsSummary = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ range: query.range });
  const result = await fetch(`/_api/teacher/analytics/summary?${params.toString()}`, {
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