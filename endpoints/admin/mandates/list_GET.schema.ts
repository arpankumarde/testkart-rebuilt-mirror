import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;

export type MandateAdminRow = {
  subscriptionId: number;
  teacherId: number;
  teacherName: string;
  teacherEmail: string | null;
  planId: number;
  planName: string;
  planPrice: number;
  status: string;
  autoRenew: boolean;
  mandateId: string;
  mandateStatus: string | null;
  mandateMaxAmount: number | null;
  mandateFrequency: string | null;
  mandatePaymentMode: string | null;
  mandateStartDate: Date | null;
  mandateEndDate: Date | null;
  lastChargeDate: Date | null;
  nextChargeDate: Date | null;
  preDebitSentAt: Date | null;
  promoCodeId: number | null;
  promoCode: string | null;
  promoDuration: string | null;
  promoDiscountAmount: number | null;
  effectiveChargeAmount: number;
  platformFeeOverride: number | null;
  adminNote: string | null;
  lastTransactionStatus: string | null;
  lastTransactionDate: Date | null;
  lastTransactionError: string | null;
};

export type MandatePlanBreakdownItem = {
  planId: number;
  planName: string;
  activeMandateCount: number;
  estimatedMrr: number;
};

export type MandateStats = {
  totalMandates: number;
  statusCounts: Record<string, number>;
  paymentModeCounts: Record<string, number>;
  frequencyCounts: Record<string, number>;
  dueWithin7Days: number;
  dueWithin30Days: number;
  overdue: number;
  failedLastCharge: number;
  activeEveryMonthPromoCount: number;
  activeFirstMonthPromoCount: number;
  monthlyRecurringDiscountTotal: number;
  totalDiscountGivenAllTime: number;
  planBreakdown: MandatePlanBreakdownItem[];
};

export type OutputType = {
  mandates: MandateAdminRow[];
  stats: MandateStats;
};

export const getAdminMandates = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/mandates/list`, {
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
