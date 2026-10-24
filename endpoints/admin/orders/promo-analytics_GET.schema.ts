import { z } from "zod";
import superjson from "superjson";

export const PROMO_ANALYTICS_RANGES = ["7d", "30d", "90d", "365d", "all"] as const;
export type PromoAnalyticsRange = (typeof PROMO_ANALYTICS_RANGES)[number];

export const schema = z.object({
  range: z.enum(PROMO_ANALYTICS_RANGES).default("30d"),
});

export type InputType = z.infer<typeof schema>;

/* Order figures cover orders placed in the range; code settings and usesHeld are lifetime. */
export type PromoCodeAnalyticsRow = {
  id: number;
  code: string;
  description: string | null;
  ownerType: "teacher" | "admin";
  ownerName: string | null;
  appliesTo: string;
  discountType: string;
  discountValue: number;
  maxDiscountAmount: number | null;
  isActive: boolean;
  isPublic: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  usageLimit: number | null;
  usesHeld: number;
  createdAt: Date | null;
  attempts: number;
  completed: number;
  paidCompleted: number;
  freeCompleted: number;
  pending: number;
  failed: number;
  cancelled: number;
  refunded: number;
  revenue: number;
  discountGiven: number;
  students: number;
  lastOrderAt: Date | null;
};

export type PromoAnalyticsSummary = {
  totalCodes: number;
  activeCodes: number;
  codesUsed: number;
  attempts: number;
  completed: number;
  paidCompleted: number;
  freeCompleted: number;
  dropped: number;
  revenue: number;
  discountGiven: number;
  students: number;
  paidOrdersAll: number;
  paidRevenueAll: number;
};

export type OutputType = {
  range: PromoAnalyticsRange;
  since: Date | null;
  summary: PromoAnalyticsSummary;
  codes: PromoCodeAnalyticsRow[];
};

export const getAdminPromoAnalytics = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const { range } = schema.parse(params);
  const result = await fetch(`/_api/admin/orders/promo-analytics?${new URLSearchParams({ range })}`, {
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