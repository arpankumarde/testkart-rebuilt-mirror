import { sql } from "kysely";
import { db } from "./db";
import { AUTO_COMPLETE_AFTER_MINUTES } from "./liveLessonConfig";
import { recordSessionEvent } from "./liveSessionLifecycle";
import { SWEEP_TEACHER_ABSENT_REASON } from "./adminLiveLessonsSql";
import { sendClassReminder } from "./liveCourseNotices";
import { cashfreeGatewayEnv, fetchCashfreeRefund, terminateCashfreeOrder } from "./cashfree";
import { settleCashfreeOrder } from "./cashfreeOrders";

/*
 * Live course upkeep, run from the live teaching sweep every 15 minutes: class reminders 24 hours
 * and 1 hour ahead, closing classes once they end (held when the teacher joined the classroom,
 * missed when not), closing courses whose last class is over, refreshing open refund statuses,
 * and settling or expiring every pending one-time Cashfree order (1:1, pay-now and live courses).
 */

const MIN_MS = 60000;
const HOUR_MS = 60 * MIN_MS;

async function sendReminders() {
  const now = Date.now();
  const dayAhead = await db
    .updateTable("groupLessons")
    .set({ reminder24hSentAt: new Date() })
    .where("liveCourseId", "in", db.selectFrom("liveCourses").select("id").where("status", "=", "published"))
    .where("status", "=", "scheduled")
    .where("reminder24hSentAt", "is", null)
    .where("startTime", ">", new Date(now + 3 * HOUR_MS))
    .where("startTime", "<=", new Date(now + 24 * HOUR_MS))
    .returning("id")
    .execute();
  for (const c of dayAhead) await sendClassReminder(c.id, "24h");

  const hourAhead = await db
    .updateTable("groupLessons")
    .set({ reminder1hSentAt: new Date() })
    .where("liveCourseId", "in", db.selectFrom("liveCourses").select("id").where("status", "=", "published"))
    .where("status", "=", "scheduled")
    .where("reminder1hSentAt", "is", null)
    .where("startTime", ">", new Date(now))
    .where("startTime", "<=", new Date(now + 75 * MIN_MS))
    .returning("id")
    .execute();
  for (const c of hourAhead) await sendClassReminder(c.id, "1h");
}

async function closeFinishedClasses() {
  const rows = await db
    .selectFrom("groupLessons")
    .innerJoin("liveCourses", "liveCourses.id", "groupLessons.liveCourseId")
    .select(["groupLessons.id", "groupLessons.startTime", "groupLessons.durationMinutes"])
    .where("liveCourses.status", "=", "published")
    .where("groupLessons.status", "=", "scheduled")
    .where("groupLessons.startTime", "<", new Date(Date.now() - AUTO_COMPLETE_AFTER_MINUTES * MIN_MS))
    .limit(200)
    .execute();
  const due = rows.filter(
    (c) => new Date(c.startTime).getTime() + (c.durationMinutes + AUTO_COMPLETE_AFTER_MINUTES) * MIN_MS <= Date.now()
  );
  if (due.length === 0) return;

  const joined = await db
    .selectFrom("liveLessonAttendance")
    .innerJoin("users", "users.id", "liveLessonAttendance.userId")
    .select("liveLessonAttendance.groupLessonId")
    .where("liveLessonAttendance.groupLessonId", "in", due.map((c) => c.id))
    .where("liveLessonAttendance.role", "=", "teacher")
    .where("users.role", "=", "teacher")
    .execute();
  const held = new Set(joined.map((j) => j.groupLessonId));

  for (const c of due) {
    await db.transaction().execute(async (trx) => {
      if (held.has(c.id)) {
        await trx
          .updateTable("groupLessons")
          .set({ status: "completed", completedAt: new Date(), completedBy: "system", updatedAt: new Date() })
          .where("id", "=", c.id)
          .where("status", "=", "scheduled")
          .execute();
        await recordSessionEvent(trx, {
          kind: "group",
          id: c.id,
          from: "scheduled",
          to: "completed",
          actor: { type: "system" },
          reason: "The teacher joined the classroom.",
        });
      } else {
        await trx
          .updateTable("groupLessons")
          .set({
            status: "cancelled",
            missedAt: new Date(),
            cancelledAt: new Date(),
            cancelledBy: "system",
            cancellationReason: SWEEP_TEACHER_ABSENT_REASON,
            updatedAt: new Date(),
          })
          .where("id", "=", c.id)
          .where("status", "=", "scheduled")
          .execute();
        await recordSessionEvent(trx, {
          kind: "group",
          id: c.id,
          from: "scheduled",
          to: "missed",
          actor: { type: "system" },
          reason: SWEEP_TEACHER_ABSENT_REASON,
        });
      }
    });
  }
}

/** Refunds start as PENDING at Cashfree; re-read the ones still open until they settle. */
async function syncRefundStatuses() {
  const open = await db
    .selectFrom("liveCourseEnrollments")
    .innerJoin("orders", "orders.id", "liveCourseEnrollments.orderId")
    .select(["liveCourseEnrollments.id", "liveCourseEnrollments.refundId", "orders.paymentTransactionId"])
    .where("liveCourseEnrollments.status", "=", "refunded")
    .where("liveCourseEnrollments.refundId", "is not", null)
    .where((eb) =>
      eb.or([eb("liveCourseEnrollments.refundStatus", "is", null), eb("liveCourseEnrollments.refundStatus", "not in", ["SUCCESS", "CANCELLED"])])
    )
    .where("liveCourseEnrollments.refundedAt", ">", new Date(Date.now() - 30 * 24 * HOUR_MS))
    .limit(50)
    .execute();
  for (const e of open) {
    if (!e.paymentTransactionId || !e.refundId) continue;
    try {
      const refund = await fetchCashfreeRefund(e.paymentTransactionId, e.refundId);
      if (refund.refund_status) {
        await db
          .updateTable("liveCourseEnrollments")
          .set({ refundStatus: refund.refund_status, updatedAt: new Date() })
          .where("id", "=", e.id)
          .execute();
      }
    } catch (error) {
      console.warn(`[liveCourseSweep] refund status for enrolment ${e.id}:`, error);
    }
  }
}

const SETTLE_PENDING_AFTER_MS = 30 * MIN_MS;
const EXPIRE_PENDING_AFTER_MS = 24 * HOUR_MS;
const EXPIRED_MESSAGE = "The payment was not completed within 24 hours.";

/**
 * A student who closes checkout leaves a pending Cashfree order that no return or webhook settles.
 * Re-read pending orders older than 30 minutes (each at most every 30 minutes), and stop the ones
 * still unpaid after 24 hours at Cashfree before marking them failed.
 */
async function settlePendingCashfreeOrders() {
  const env = cashfreeGatewayEnv();
  const cutoff = new Date(Date.now() - SETTLE_PENDING_AFTER_MS);
  const pending = await db
    .selectFrom("orders")
    .select(["id", "createdAt", "paymentTransactionId"])
    .where("paymentMethod", "=", "cashfree")
    .where("status", "=", "pending")
    .where("paymentTransactionId", "is not", null)
    .where("createdAt", "<", cutoff)
    .where((eb) => eb.or([eb("updatedAt", "is", null), eb("updatedAt", "<", cutoff)]))
    .where((eb) => eb.or([eb("gatewayEnv", "is", null), eb("gatewayEnv", "=", env)]))
    .orderBy("updatedAt", "asc")
    .limit(50)
    .execute();

  for (const o of pending) {
    try {
      await settleCashfreeOrder(o.id);
      const expired = o.createdAt && new Date(o.createdAt).getTime() < Date.now() - EXPIRE_PENDING_AFTER_MS;
      if (expired && o.paymentTransactionId) {
        const row = await db.selectFrom("orders").select("status").where("id", "=", o.id).executeTakeFirst();
        if (row?.status === "pending") {
          if (await terminateCashfreeOrder(o.paymentTransactionId)) {
            await db
              .updateTable("orders")
              .set({ status: "failed", paymentGatewayStatus: "TERMINATED", paymentErrorMessage: EXPIRED_MESSAGE, updatedAt: new Date() })
              .where("id", "=", o.id)
              .where("status", "=", "pending")
              .execute();
          } else {
            await settleCashfreeOrder(o.id);
          }
        }
      }
    } catch (error) {
      console.warn(`[liveCourseSweep] settling pending Cashfree order ${o.id}:`, error);
    }
    await db.updateTable("orders").set({ updatedAt: new Date() }).where("id", "=", o.id).where("status", "=", "pending").execute();
  }
}

async function closeFinishedCourses() {
  await sql`
    UPDATE live_courses lc SET status = 'completed', updated_at = now()
    WHERE lc.status = 'published'
      AND EXISTS (SELECT 1 FROM group_lessons g WHERE g.live_course_id = lc.id)
      AND NOT EXISTS (SELECT 1 FROM group_lessons g WHERE g.live_course_id = lc.id AND g.status = 'scheduled')
  `.execute(db);
}

export async function runLiveCourseSweep(part: (name: string, work: () => Promise<void>) => Promise<void>) {
  await part("course reminders", sendReminders);
  await part("course classes", closeFinishedClasses);
  await part("courses", closeFinishedCourses);
  await part("course refunds", syncRefundStatuses);
  await part("pending Cashfree orders", settlePendingCashfreeOrders);
}
