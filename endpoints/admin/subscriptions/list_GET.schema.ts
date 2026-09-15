import { z } from "zod";
import superjson from "superjson";
import { SubscriptionStatus, SubscriptionStatusArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  planId: z.number().int().positive().optional(),
  status: z.enum(SubscriptionStatusArrayValues).optional(),
  includeFree: z.boolean().optional(),
  /* Raw status active with end_date in the next 7 days, on every plan including the free one. */
  expiringWithin7Days: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

export type SubscriptionAdminView = {
  subscriptionId: number;
  teacherId: number;
  teacherName: string;
  teacherEmail: string | null;
  planName: string;
  status: SubscriptionStatus;
  startDate: Date | null;
  endDate: Date | null;
  nextRenewalDate: Date | null;
  autoRenew: boolean;
  daysUntilRenewal: number;
  platformFeePercentage: number;
  platformFeeOverride: number | null;
  paymentMethod: string | null;
  adminNote: string | null;
  isAdminTrial: boolean;
};

export type PlanBreakdownItem = {
  planId: number;
  planName: string;
  activeCount: number;
  totalCount: number;
};

export type SubscriptionStats = {
  totalSubscriptions: number;
  activeCount: number;
  expiredCount: number;
  cancelledCount: number;
  planBreakdown: PlanBreakdownItem[];
  freeTeachersCount: number;
};

export type OutputType = {
  subscriptions: SubscriptionAdminView[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  stats: SubscriptionStats;
};

export const getAdminSubscriptionsList = async (
  params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set("search", params.search);
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.planId) queryParams.set("planId", params.planId.toString());
  if (params.status) queryParams.set("status", params.status);
  if (params.includeFree !== undefined) queryParams.set("includeFree", params.includeFree.toString());
  if (params.expiringWithin7Days) queryParams.set("expiringWithin7Days", "true");

  const result = await fetch(`/_api/admin/subscriptions/list?${queryParams.toString()}`, {
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