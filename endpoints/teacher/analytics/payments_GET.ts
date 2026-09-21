import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { Row, get, num, str, date, isoDay, analyticsWindow } from "../../../helpers/teacherAnalyticsTime";
import {
  analyticsJson,
  analyticsErrorResponse,
  resolveAnalyticsTeacher,
} from "../../../helpers/teacherAnalyticsAccess";
import { paymentFailureReason } from "../../../helpers/paymentFailureReason";
import { paidAttemptSql } from "../../../helpers/teacherAnalyticsSql";
import {
  schema,
  OutputType,
  AnalyticsPaymentCounts,
  AnalyticsPaymentPoint,
  AnalyticsPaymentReason,
  AnalyticsPaymentReasonKind,
  AnalyticsFailedAttempt,
  ANALYTICS_PAYMENTS_PAGE_SIZE,
} from "./payments_GET.schema";

type Attempt = {
  orderId: number;
  day: string;
  createdAt: Date;
  status: string;
  userId: number | null;
  amount: number;
  studentName: string;
  summary: string;
  paidLater: boolean;
  reason: { key: string; label: string };
};

const NO_REASON = { key: "not_recorded", label: "No reason recorded" };
// Cancelled on our side with nothing from PayU: the checkout was left before paying.
const CLOSED_CHECKOUT = { key: "closed_checkout", label: "Closed before paying" };

const emptyCounts = (): AnalyticsPaymentCounts => ({
  attempts: 0,
  paid: 0,
  failed: 0,
  abandoned: 0,
  pending: 0,
  refunded: 0,
  payers: 0,
  lostStudents: 0,
  lostAmount: 0,
});

/**
 * Abandonment, not a decline: cancelled or closed on the payment page, never
 * reached PayU, or a UPI request nobody approved in time. About 95% of unpaid
 * orders are these; the rest are real bank, card or UPI failures.
 */
const ABANDON_REASONS = new Set(["cancelled", "left_payment_page", "not_started", "not_confirmed", "closed_checkout"]);

const reasonKind = (key: string): AnalyticsPaymentReasonKind =>
  ABANDON_REASONS.has(key) ? "abandoned" : key === NO_REASON.key ? "unknown" : "failed";

function tally(attempts: Attempt[]): AnalyticsPaymentCounts {
  const counts = emptyCounts();
  const payers = new Set<number>();
  const lost = new Set<number>();
  for (const attempt of attempts) {
    counts.attempts += 1;
    if (attempt.userId !== null) payers.add(attempt.userId);
    if (attempt.status === "completed") counts.paid += 1;
    else if (attempt.status === "refunded") counts.refunded += 1;
    else if (attempt.status === "pending") counts.pending += 1;
    else {
      if (attempt.status === "cancelled" || ABANDON_REASONS.has(attempt.reason.key)) counts.abandoned += 1;
      else counts.failed += 1;
      if (!attempt.paidLater) {
        counts.lostAmount += attempt.amount;
        if (attempt.userId !== null) lost.add(attempt.userId);
      }
    }
  }
  counts.payers = payers.size;
  counts.lostStudents = lost.size;
  return counts;
}

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolveAnalyticsTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const input = schema.parse({
      range: url.searchParams.get("range") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
    });
    const window = analyticsWindow(input.range);

    // Every order with money to pay that holds this teacher's content, from
    // the previous window's start. amount is the teacher's items only, so a
    // mixed cart counts just their share. paid_later: the same student paid
    // for one of the same items in a later completed order.
    const result = await sql<Row>`
      WITH mine AS (
        SELECT oi.order_id AS id,
               sum(oi.price_at_purchase - oi.discount_amount) AS amount,
               count(*) AS item_count,
               (array_agg(coalesce(mt.title, c.title, dp.title) ORDER BY oi.id))[1]::text AS first_title
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN mock_tests mt ON mt.id = oi.mock_test_id
        LEFT JOIN courses c ON c.id = oi.course_id
        LEFT JOIN digital_products dp ON dp.id = oi.digital_product_id
        WHERE o.created_at >= ${window.previousStart}
          AND o.bundle_id IS NULL
          AND (mt.teacher_id = ${teacherId} OR c.teacher_id = ${teacherId} OR dp.teacher_id = ${teacherId})
        GROUP BY oi.order_id
        UNION ALL
        SELECT o.id, o.total_amount::numeric, 1, cb.title::text
        FROM orders o JOIN course_bundles cb ON cb.id = o.bundle_id
        WHERE o.created_at >= ${window.previousStart} AND cb.teacher_id = ${teacherId}
      )
      SELECT o.id, o.status::text AS status, o.created_at, o.user_id,
             mine.amount, mine.item_count, mine.first_title,
             o.payment_error_code, o.payment_error_message, o.payment_bank_message, o.payment_gateway_status,
             coalesce(nullif(trim(u.display_name), ''), 'Student') AS student_name,
             (o.status IN ('failed', 'cancelled') AND (
               EXISTS (
                 SELECT 1 FROM order_items oi1
                 JOIN order_items oi2 ON (
                   oi2.mock_test_id = oi1.mock_test_id OR oi2.course_id = oi1.course_id
                   OR oi2.digital_product_id = oi1.digital_product_id)
                 JOIN orders o2 ON o2.id = oi2.order_id
                 WHERE oi1.order_id = o.id AND o2.user_id = o.user_id
                   AND o2.status = 'completed' AND o2.created_at > o.created_at
               )
               OR (o.bundle_id IS NOT NULL AND EXISTS (
                 SELECT 1 FROM orders o2
                 WHERE o2.bundle_id = o.bundle_id AND o2.user_id = o.user_id
                   AND o2.status = 'completed' AND o2.created_at > o.created_at
               ))
             )) AS paid_later
      FROM mine
      JOIN orders o ON o.id = mine.id
      LEFT JOIN users u ON u.id = o.user_id
      WHERE ${paidAttemptSql}
      ORDER BY o.created_at DESC
    `.execute(db);

    const attempts: Attempt[] = result.rows.map((row) => {
      const createdAt = date(get(row, "created_at"));
      const itemCount = num(get(row, "item_count"));
      const firstTitle = str(get(row, "first_title"), "Untitled").trim() || "Untitled";
      const described = paymentFailureReason.describe({
        paymentErrorCode: (get(row, "payment_error_code") as string | null) ?? null,
        paymentErrorMessage: (get(row, "payment_error_message") as string | null) ?? null,
        paymentBankMessage: (get(row, "payment_bank_message") as string | null) ?? null,
        paymentGatewayStatus: (get(row, "payment_gateway_status") as string | null) ?? null,
      });
      const userId = get(row, "user_id");
      const status = str(get(row, "status"));
      return {
        orderId: num(get(row, "id")),
        day: isoDay(createdAt.getTime()),
        createdAt,
        status,
        userId: userId === null || userId === undefined ? null : num(userId),
        amount: num(get(row, "amount")),
        studentName: str(get(row, "student_name"), "Student"),
        summary: itemCount > 1 ? `${firstTitle} and ${itemCount - 1} more` : firstTitle,
        paidLater: get(row, "paid_later") === true,
        reason: described
          ? { key: described.reason, label: described.label }
          : status === "cancelled"
            ? CLOSED_CHECKOUT
            : NO_REASON,
      };
    });

    const current = attempts.filter((attempt) => attempt.day >= window.currentStartDay);
    const previous = attempts.filter((attempt) => attempt.day < window.currentStartDay);

    const byBucket = new Map<string, AnalyticsPaymentPoint>();
    for (const attempt of current) {
      const key = window.bucketOf(attempt.day);
      const point = byBucket.get(key) ?? { bucket: key, attempts: 0, paid: 0, unpaid: 0 };
      point.attempts += 1;
      if (attempt.status === "completed" || attempt.status === "refunded") point.paid += 1;
      else if (attempt.status !== "pending") point.unpaid += 1;
      byBucket.set(key, point);
    }
    const series = window.buckets.map((key) => byBucket.get(key) ?? { bucket: key, attempts: 0, paid: 0, unpaid: 0 });

    const unpaid = current.filter((attempt) => attempt.status === "failed" || attempt.status === "cancelled");
    const reasonCounts = new Map<string, AnalyticsPaymentReason>();
    for (const attempt of unpaid) {
      const entry = reasonCounts.get(attempt.reason.key) ?? {
        reason: attempt.reason.key,
        label: attempt.reason.label,
        kind: reasonKind(attempt.reason.key),
        attempts: 0,
      };
      entry.attempts += 1;
      reasonCounts.set(attempt.reason.key, entry);
    }

    const pageSize = ANALYTICS_PAYMENTS_PAGE_SIZE;
    const lastPage = Math.max(1, Math.ceil(unpaid.length / pageSize));
    const page = Math.min(input.page, lastPage);
    const failures: AnalyticsFailedAttempt[] = unpaid
      .slice((page - 1) * pageSize, page * pageSize)
      .map((attempt) => ({
        orderId: attempt.orderId,
        createdAt: attempt.createdAt,
        studentName: attempt.studentName,
        summary: attempt.summary,
        amount: attempt.amount,
        status: attempt.status as "failed" | "cancelled",
        reasonLabel: attempt.reason.label,
        paidLater: attempt.paidLater,
      }));

    const output: OutputType = {
      range: input.range,
      bucket: window.bucket,
      generatedAt: new Date(),
      current: tally(current),
      previous: tally(previous),
      series,
      reasons: [...reasonCounts.values()].sort((a, b) => b.attempts - a.attempts),
      failures,
      failuresTotal: unpaid.length,
      page,
      pageSize,
    };

    return analyticsJson(output);
  } catch (error) {
    return analyticsErrorResponse("payments", error);
  }
}