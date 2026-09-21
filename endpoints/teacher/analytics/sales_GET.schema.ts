import { z } from "zod";
import superjson from "superjson";
import { AnalyticsRangeValues, AnalyticsRange, AnalyticsBucket } from "../../../helpers/teacherAnalyticsTime";
import type { TeacherMixKind } from "../dashboard/overview_GET.schema";

export const schema = z.object({
  range: z.enum(AnalyticsRangeValues).default("30d"),
});

export type InputType = z.infer<typeof schema>;

/** One day (YYYY-MM-DD) or, for 12 months, one month (YYYY-MM). fee = gross - net. */
export type AnalyticsSalesPoint = {
  bucket: string;
  gross: number;
  net: number;
  fee: number;
  orders: number;
};

export type AnalyticsKindTotal = {
  kind: TeacherMixKind;
  gross: number;
  net: number;
  paidUnits: number;
  freeUnits: number;
};

export type AnalyticsCouponSide = { orders: number; gross: number; net: number; discount: number };

export type AnalyticsTopCode = {
  code: string;
  /** False for a platform code an admin created that also applied to this teacher's content. */
  ownCode: boolean;
  redemptions: number;
  gross: number;
  discount: number;
};

/**
 * Coupons are read off completed orders (orders.promo_code_id), never the
 * usage rows, which are written when checkout starts. Paid orders are split by
 * whether a code was used; redemptions also count orders a 100% code made free.
 */
export type AnalyticsCoupons = {
  redemptions: number;
  /** Discount across every order that used a code, free ones included. */
  discount: number;
  paidWithCode: AnalyticsCouponSide;
  paidWithoutCode: AnalyticsCouponSide;
  topCodes: AnalyticsTopCode[];
};

export type OutputType = {
  range: AnalyticsRange;
  bucket: AnalyticsBucket;
  generatedAt: Date;
  totals: { gross: number; net: number; fee: number; orders: number };
  series: AnalyticsSalesPoint[];
  byKind: AnalyticsKindTotal[];
  coupons: AnalyticsCoupons;
};

export const getTeacherAnalyticsSales = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ range: query.range });
  const result = await fetch(`/_api/teacher/analytics/sales?${params.toString()}`, {
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