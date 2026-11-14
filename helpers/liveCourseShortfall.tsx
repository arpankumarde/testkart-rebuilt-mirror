import { db } from "./db";
import { cashfreeGatewayEnv, fetchCashfreeRefund, type CashfreeRefund } from "./cashfree";
import { LiveCourseError, refundLiveCourseEnrollment, startCashfreeRefund, type RefundOutcome } from "./liveCourseServer";
import { sendRefundNotices } from "./liveCourseNotices";

/*
 * Shortfall refunds. A published course must still be able to hold its min classes (held plus
 * scheduled). For every min class it can no longer hold, each enrolled student gets price / min
 * back through Cashfree and keeps the seat; the teacher keeps what the held classes earned. When no
 * class can be held at all the enrolment is refunded in full and the seat freed.
 *
 * A class cancelled less than an hour ago still counts while the course is published, so a teacher
 * who cancels and adds a replacement does not set off a refund. A cancelled course has no grace.
 */

const GRACE_MS = 60 * 60000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type ShortfallResult = { refunded: RefundOutcome[]; failed: { enrollmentId: string; error: string }[] };

/** How many of the min classes the course can no longer hold. */
export async function shortfallClasses(courseId: string, minClasses: number, graceMs: number): Promise<number> {
  const since = new Date(Date.now() - graceMs);
  const row = await db
    .selectFrom("groupLessons")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("liveCourseId", "=", courseId)
    .where((eb) =>
      eb.or([
        eb("status", "in", ["completed", "scheduled"]),
        ...(graceMs > 0 ? [eb.and([eb("status", "=", "cancelled"), eb("cancelledAt", ">", since)])] : []),
      ])
    )
    .executeTakeFirst();
  return Math.max(0, minClasses - Number(row?.n ?? 0));
}

type ShortfallRow = {
  id: string;
  studentId: number;
  amountPaid: string;
  shortfallRefundedClasses: number;
  shortfallRefundAmount: string;
  paymentTransactionId: string | null;
};

async function refundShortfall(e: ShortfallRow, minClasses: number, owed: number): Promise<RefundOutcome> {
  if (!e.paymentTransactionId) throw new LiveCourseError("This enrolment was not paid through Cashfree.");
  const target = round2((Number(e.amountPaid) * owed) / minClasses);
  const amount = round2(target - Number(e.shortfallRefundAmount));
  const refundId = `lcs-${e.id}-${owed}`;

  const claimed = await db
    .updateTable("liveCourseEnrollments")
    .set({ shortfallRefundRequestedAt: new Date() })
    .where("id", "=", e.id)
    .where("status", "=", "enrolled")
    .where("shortfallRefundedClasses", "=", e.shortfallRefundedClasses)
    .where((eb) =>
      eb.or([
        eb("shortfallRefundRequestedAt", "is", null),
        eb("shortfallRefundRequestedAt", "<", new Date(Date.now() - 2 * 60000)),
      ])
    )
    .returning("id")
    .executeTakeFirst();
  if (!claimed) throw new LiveCourseError("A refund for this enrolment is already being processed.");

  let refund: CashfreeRefund | null = null;
  if (amount > 0) {
    try {
      refund = await startCashfreeRefund({
        cashfreeOrderId: e.paymentTransactionId,
        refundId,
        amount,
        note: "Live course classes not held",
      });
    } catch (error) {
      await db.updateTable("liveCourseEnrollments").set({ shortfallRefundRequestedAt: null }).where("id", "=", e.id).execute();
      throw new LiveCourseError(`The refund could not be started: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  await db
    .updateTable("liveCourseEnrollments")
    .set({
      shortfallRefundedClasses: owed,
      shortfallRefundAmount: target.toFixed(2),
      ...(refund ? { shortfallRefundId: refundId, shortfallRefundStatus: refund.refund_status ?? "PENDING" } : {}),
      shortfallRefundRequestedAt: null,
      updatedAt: new Date(),
    })
    .where("id", "=", e.id)
    .where("shortfallRefundedClasses", "=", e.shortfallRefundedClasses)
    .execute();

  return { enrollmentId: e.id, amount, refundStatus: refund?.refund_status ?? "PENDING" };
}

/**
 * Pays every enrolled student of one course back for the min classes it can no longer hold.
 * Failures are returned, not thrown, so one bad payment does not stop the rest. Notices are sent
 * (awaited) for each refund that started.
 */
export async function reconcileShortfallRefunds(courseId: string, by = "system"): Promise<ShortfallResult> {
  const result: ShortfallResult = { refunded: [], failed: [] };
  const course = await db
    .selectFrom("liveCourses")
    .select(["id", "status", "minClasses", "cancellationReason"])
    .where("id", "=", courseId)
    .executeTakeFirst();
  if (!course?.minClasses || course.status === "draft") return result;
  const minClasses = course.minClasses;
  const owed = await shortfallClasses(course.id, minClasses, course.status === "published" ? GRACE_MS : 0);
  if (owed === 0) return result;

  const env = cashfreeGatewayEnv();
  const rows = await db
    .selectFrom("liveCourseEnrollments")
    .innerJoin("orders", "orders.id", "liveCourseEnrollments.orderId")
    .select([
      "liveCourseEnrollments.id",
      "liveCourseEnrollments.studentId",
      "liveCourseEnrollments.amountPaid",
      "liveCourseEnrollments.shortfallRefundedClasses",
      "liveCourseEnrollments.shortfallRefundAmount",
      "orders.paymentTransactionId",
    ])
    .where("liveCourseEnrollments.liveCourseId", "=", course.id)
    .where("liveCourseEnrollments.status", "=", "enrolled")
    .where("liveCourseEnrollments.shortfallRefundedClasses", "<", owed)
    .where("orders.status", "=", "completed")
    .where("orders.paymentMethod", "=", "cashfree")
    .where((eb) => eb.or([eb("orders.gatewayEnv", "is", null), eb("orders.gatewayEnv", "=", env)]))
    .execute();

  const cancelled = course.status === "cancelled";
  for (const e of rows) {
    try {
      if (owed >= minClasses) {
        const outcome = await refundLiveCourseEnrollment({ enrollmentId: e.id, by, force: true });
        result.refunded.push(outcome);
        await sendRefundNotices(
          course.id,
          e.studentId,
          outcome.amount,
          cancelled ? `The course was cancelled${course.cancellationReason ? `: ${course.cancellationReason}` : "."}` : "The course has no classes left."
        );
      } else {
        const classes = owed - e.shortfallRefundedClasses;
        const outcome = await refundShortfall(e, minClasses, owed);
        result.refunded.push(outcome);
        if (outcome.amount > 0) {
          await sendRefundNotices(
            course.id,
            e.studentId,
            outcome.amount,
            `This is your share for ${classes} class${classes === 1 ? "" : "es"} of the course that will not be held. You keep your seat.`,
            { partial: true }
          );
        }
      }
    } catch (error) {
      result.failed.push({ enrollmentId: e.id, error: error instanceof Error ? error.message : "Refund failed" });
    }
  }
  if (result.failed.length) console.error(`[liveCourseShortfall] course ${course.id}: ${result.failed.length} refund(s) failed`, result.failed);
  return result;
}

/** Sweep part: every course with enrolled students that has a min set. */
export async function runShortfallSweep(): Promise<void> {
  const courses = await db
    .selectFrom("liveCourses")
    .select("id")
    .where("minClasses", "is not", null)
    .where("status", "in", ["published", "completed", "cancelled"])
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("liveCourseEnrollments")
          .select("liveCourseEnrollments.id")
          .whereRef("liveCourseEnrollments.liveCourseId", "=", "liveCourses.id")
          .where("liveCourseEnrollments.status", "=", "enrolled")
      )
    )
    .limit(200)
    .execute();
  for (const c of courses) await reconcileShortfallRefunds(c.id);

  const open = await db
    .selectFrom("liveCourseEnrollments")
    .innerJoin("orders", "orders.id", "liveCourseEnrollments.orderId")
    .select(["liveCourseEnrollments.id", "liveCourseEnrollments.shortfallRefundId", "orders.paymentTransactionId"])
    .where("liveCourseEnrollments.shortfallRefundId", "is not", null)
    .where((eb) =>
      eb.or([
        eb("liveCourseEnrollments.shortfallRefundStatus", "is", null),
        eb("liveCourseEnrollments.shortfallRefundStatus", "not in", ["SUCCESS", "CANCELLED"]),
      ])
    )
    .where("liveCourseEnrollments.updatedAt", ">", new Date(Date.now() - 30 * 24 * 60 * 60000))
    .limit(50)
    .execute();
  for (const e of open) {
    if (!e.paymentTransactionId || !e.shortfallRefundId) continue;
    try {
      const refund = await fetchCashfreeRefund(e.paymentTransactionId, e.shortfallRefundId);
      if (refund.refund_status) {
        await db.updateTable("liveCourseEnrollments").set({ shortfallRefundStatus: refund.refund_status }).where("id", "=", e.id).execute();
      }
    } catch (error) {
      console.warn(`[liveCourseShortfall] refund status for enrolment ${e.id}:`, error);
    }
  }
}

/**
 * What each enrolled student would get back if one more scheduled class were cancelled and not
 * replaced. Classes cancelled within the grace hour count as gone here, since they will be once it ends.
 */
export async function refundPerStudentIfOneMoreCancelled(courseId: string, minClasses: number, price: number): Promise<number> {
  const owedNow = await shortfallClasses(courseId, minClasses, 0);
  const owedAfter = await shortfallClasses(courseId, minClasses + 1, 0);
  return owedAfter > owedNow ? round2(price / minClasses) : 0;
}
