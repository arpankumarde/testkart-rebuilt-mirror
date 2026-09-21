import { z } from "zod";
import superjson from "superjson";
import { AnalyticsRangeValues, AnalyticsRange, AnalyticsBucket } from "../../../helpers/teacherAnalyticsTime";

export const ANALYTICS_PAYMENTS_PAGE_SIZE = 20;

export const schema = z.object({
  range: z.enum(AnalyticsRangeValues).default("30d"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export type InputType = z.infer<typeof schema>;

export type AnalyticsPaymentCounts = {
  /** Orders with something to pay that hold this teacher's content. Free claims are not payments. */
  attempts: number;
  paid: number;
  /** Declined by the bank, card or UPI app, or a technical error. */
  failed: number;
  /** Cancelled, closed or timed out on the payment page, or a UPI request never approved. */
  abandoned: number;
  pending: number;
  refunded: number;
  /** Distinct students who tried to pay. */
  payers: number;
  /** Students with a failed or abandoned attempt and no paid order for the same item afterwards. */
  lostStudents: number;
  /** The teacher's share (gross) on failed and abandoned attempts that were never paid later. */
  lostAmount: number;
};

/** abandoned: the student walked away; failed: declined or errored; unknown: nothing was recorded. */
export type AnalyticsPaymentReasonKind = "abandoned" | "failed" | "unknown";

export type AnalyticsPaymentReason = {
  reason: string;
  label: string;
  kind: AnalyticsPaymentReasonKind;
  attempts: number;
};

export type AnalyticsPaymentPoint = { bucket: string; attempts: number; paid: number; unpaid: number };

/**
 * One failed or abandoned attempt. The student's name is shown so the teacher
 * can help them finish; no email or phone number is sent.
 */
export type AnalyticsFailedAttempt = {
  orderId: number;
  createdAt: Date;
  studentName: string;
  summary: string;
  /** The teacher's share of the order before the platform fee. */
  amount: number;
  status: "failed" | "cancelled";
  reasonLabel: string;
  paidLater: boolean;
};

export type OutputType = {
  range: AnalyticsRange;
  bucket: AnalyticsBucket;
  generatedAt: Date;
  current: AnalyticsPaymentCounts;
  previous: AnalyticsPaymentCounts;
  series: AnalyticsPaymentPoint[];
  reasons: AnalyticsPaymentReason[];
  failures: AnalyticsFailedAttempt[];
  failuresTotal: number;
  page: number;
  pageSize: number;
};

export const getTeacherAnalyticsPayments = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ range: query.range, page: String(query.page) });
  const result = await fetch(`/_api/teacher/analytics/payments?${params.toString()}`, {
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