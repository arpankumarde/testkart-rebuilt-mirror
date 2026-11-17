import { sql } from "kysely";
import { db } from "./db";
import { AUTO_COMPLETE_AFTER_MINUTES, COMPLETION_OVERDUE_HOURS, COMPLETION_REMINDER_MAX_AGE_DAYS } from "./liveLessonConfig";
import {
  abandonPendingPackage,
  cancelAbandonedMandates,
  confirmRaisedCharge,
  failRenewal,
  raiseRenewalCharge,
  reconcileAbandonedMandate,
  returnCredit,
  settleLivePackageCheckout,
  settleLiveRenewal,
  spendCredit,
  startLiveRenewal,
  stopLivePackage,
} from "./livePackages";
import { DEAD_SUBSCRIPTION_STATUSES } from "./cashfreeSubscriptions";
import { sendClassRefundedEmail, sendClassReminderEmails, sendCompletionOverdueEmail, sendTrialFollowUpEmail } from "./livePackageEmails";
import { sendClassReminderWhatsApp } from "./liveClassWhatsApp";
import { recordSessionEvent, sessionStatusOf } from "./liveSessionLifecycle";
import { SWEEP_TEACHER_ABSENT_REASON } from "./adminLiveLessonsSql";
import { runLiveCourseSweep } from "./liveCourseSweep";

/**
 * Live 1:1 upkeep, run every 15 minutes from the autopilot job (the project is at Floot's
 * 10-job limit). Each part is caught on its own so one failure does not stop the rest.
 */

const MIN_MS = 60000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

async function part(name: string, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    console.error(`[liveTeachingSweep] ${name} failed:`, error);
  }
}

/** First checkouts whose return or webhook never arrived. Gives up after a day and cancels the mandate. */
async function settleStaleCheckouts() {
  const rows = await db
    .selectFrom("livePackages")
    .select(["id", "createdAt"])
    .where("status", "=", "pending")
    .where("createdAt", "<", new Date(Date.now() - 5 * MIN_MS))
    .limit(50)
    .execute();
  for (const row of rows) {
    const outcome = await settleLivePackageCheckout(row.id).catch(() => ({ status: "pending" as const }));
    if (outcome.status === "pending" && new Date(row.createdAt).getTime() < Date.now() - DAY_MS) {
      const abandoned = await db.transaction().execute((trx) => abandonPendingPackage(trx, row.id, "The checkout was not completed."));
      await cancelAbandonedMandates(abandoned);
    }
  }
}

/**
 * Mandates of abandoned or replaced checkouts that Cashfree may still treat as live: cancelled
 * there, and an authorisation that was paid anyway becomes live class balance.
 */
async function settleAbandonedMandates() {
  const rows = await db
    .selectFrom("liveMandates")
    .innerJoin("livePackages", "livePackages.id", "liveMandates.packageId")
    .select("liveMandates.subscriptionId")
    .where("liveMandates.status", "=", "failed")
    .where("livePackages.status", "=", "failed")
    .where("liveMandates.createdAt", ">", new Date(Date.now() - 2 * DAY_MS))
    .where((eb) =>
      eb.or([
        eb("liveMandates.gatewayStatus", "is", null),
        eb("liveMandates.gatewayStatus", "not in", [...DEAD_SUBSCRIPTION_STATUSES, "NOT_FOUND"]),
      ])
    )
    .limit(20)
    .execute();
  for (const row of rows) {
    await reconcileAbandonedMandate(row.subscriptionId).catch((error) =>
      console.error(`[liveTeachingSweep] abandoned mandate ${row.subscriptionId}:`, error)
    );
  }
}

async function startDueRenewals() {
  const due = await sql<{ id: string }>`
    SELECT p.id FROM live_packages p
    JOIN LATERAL (
      SELECT status, ends_at FROM live_package_cycles c
      WHERE c.package_id = p.id AND c.status <> 'cancelled'
      ORDER BY cycle_number DESC LIMIT 1
    ) last ON TRUE
    WHERE p.status = 'active' AND p.auto_renew AND last.status = 'paid' AND last.ends_at <= now() + interval '2 days'
    LIMIT 50
  `.execute(db);
  for (const row of due.rows) await startLiveRenewal(row.id);
}

/**
 * Raises and polls renewal debits. A debit that could not be raised by a day after the cycle
 * starts fails, unless Cashfree turns out to hold it. Cycles failed or cancelled in the last
 * three days with a raised debit are polled too, so a late debit still completes them.
 */
async function raiseAndPollCharges() {
  const cycles = await db
    .selectFrom("livePackageCycles")
    .select(["id", "startsAt", "chargeRequestedAt"])
    .where("status", "=", "pending")
    .where("paymentId", "is not", null)
    .limit(100)
    .execute();
  for (const c of cycles) {
    if (!c.chargeRequestedAt) {
      if (new Date(c.startsAt).getTime() + DAY_MS < Date.now()) {
        if (!(await confirmRaisedCharge(c.id))) await failRenewal(c.id, "We could not set up the autopay debit.");
      } else {
        await raiseRenewalCharge(c.id);
      }
      continue;
    }
    await settleLiveRenewal(c.id).catch((error) => console.error(`[liveTeachingSweep] renewal ${c.id}:`, error));
  }

  const late = await db
    .selectFrom("livePackageCycles")
    .select("id")
    .where("status", "in", ["failed", "cancelled"])
    .where("paymentId", "is not", null)
    .where("chargeRequestedAt", "is not", null)
    .where("updatedAt", ">", new Date(Date.now() - 3 * DAY_MS))
    .limit(50)
    .execute();
  for (const c of late) {
    await settleLiveRenewal(c.id).catch((error) => console.error(`[liveTeachingSweep] late renewal ${c.id}:`, error));
  }
}

async function endLapsedPackages() {
  const lapsed = await db
    .selectFrom("livePackageCycles")
    .innerJoin("livePackages", "livePackages.id", "livePackageCycles.packageId")
    .select("livePackages.id")
    .where("livePackageCycles.status", "=", "failed")
    .where("livePackageCycles.graceUntil", "<", new Date())
    .where("livePackages.status", "=", "past_due")
    .limit(50)
    .execute();
  for (const row of lapsed) {
    await stopLivePackage(row.id, { by: "system", reason: "The renewal was not paid.", finalStatus: "ended" });
  }

  const finished = await sql<{ id: string }>`
    SELECT p.id FROM live_packages p
    JOIN LATERAL (
      SELECT status, ends_at FROM live_package_cycles c
      WHERE c.package_id = p.id AND c.status <> 'cancelled'
      ORDER BY cycle_number DESC LIMIT 1
    ) last ON TRUE
    WHERE p.status = 'active' AND NOT p.auto_renew AND last.status = 'paid' AND last.ends_at < now()
    LIMIT 50
  `.execute(db);
  for (const row of finished.rows) {
    await stopLivePackage(row.id, { by: "system", reason: "The package period ended.", finalStatus: "ended" });
  }
}

/**
 * Settles credit-paid classes AUTO_COMPLETE_AFTER_MINUTES after they end. Teacher joined: the
 * credit is spent and the teacher earns; the class becomes completed unless the teacher already
 * marked the learner a no-show, which is charged the same way. Teacher never joined: stored
 * cancelled with SWEEP_TEACHER_ABSENT_REASON, which admins see as missed, and the credit is
 * returned. Only a credit still "booked" is touched, so a class an admin already settled is skipped.
 */
async function settleFinishedClasses() {
  const rows = await db
    .selectFrom("mentorshipBookings")
    .innerJoin("liveClassCredits", "liveClassCredits.id", "mentorshipBookings.creditId")
    .select([
      "mentorshipBookings.id",
      "mentorshipBookings.status",
      "mentorshipBookings.scheduledAt",
      "mentorshipBookings.durationMinutes",
      "mentorshipBookings.creditId",
      "mentorshipBookings.noShowParty",
      "liveClassCredits.kind",
    ])
    .where("liveClassCredits.status", "=", "booked")
    .where("mentorshipBookings.status", "in", ["scheduled", "completed", "no_show"])
    .where("mentorshipBookings.scheduledAt", "<", new Date(Date.now() - AUTO_COMPLETE_AFTER_MINUTES * MIN_MS))
    .limit(200)
    .execute();
  const due = rows.filter(
    (b) => new Date(b.scheduledAt).getTime() + (b.durationMinutes + AUTO_COMPLETE_AFTER_MINUTES) * MIN_MS <= Date.now()
  );
  if (due.length === 0) return;

  const joined = await db
    .selectFrom("liveLessonAttendance")
    .innerJoin("teachers", "teachers.id", "liveLessonAttendance.userId")
    .select("liveLessonAttendance.mentorshipBookingId")
    .where("liveLessonAttendance.mentorshipBookingId", "in", due.map((b) => b.id))
    .where("liveLessonAttendance.role", "=", "teacher")
    .execute();
  const teacherCame = new Set(joined.map((j) => j.mentorshipBookingId));

  for (const b of due) {
    const creditId = b.creditId as string;
    const from = sessionStatusOf(b.status, b.noShowParty);
    if (teacherCame.has(b.id)) {
      const keep = b.status === "completed" || b.status === "no_show";
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable("mentorshipBookings")
          .set({
            ...(keep ? {} : { status: "completed" as const, completedAt: new Date(), completedBy: "system" }),
            earningStatus: "earned",
            updatedAt: new Date(),
          })
          .where("id", "=", b.id)
          .execute();
        await spendCredit(trx, creditId);
        if (!keep) {
          await recordSessionEvent(trx, {
            kind: "booking",
            id: b.id,
            from,
            to: "completed",
            actor: { type: "system" },
            reason: "The teacher joined the classroom.",
          });
        }
      });
      if (b.kind === "trial") await sendTrialFollowUpEmail(b.id);
      continue;
    }
    const outcome = await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("mentorshipBookings")
        .set({
          status: "cancelled",
          cancelledBy: "system",
          cancellationReason: SWEEP_TEACHER_ABSENT_REASON,
          cancelledAt: new Date(),
          earningStatus: "void",
          updatedAt: new Date(),
        })
        .where("id", "=", b.id)
        .execute();
      await recordSessionEvent(trx, {
        kind: "booking",
        id: b.id,
        from,
        to: "missed",
        actor: { type: "system" },
        reason: SWEEP_TEACHER_ABSENT_REASON,
      });
      return returnCredit(trx, creditId);
    });
    if (outcome) await sendClassRefundedEmail(b.id, outcome);
  }
}

/**
 * Sessions whose end time passed with nobody marking them: stamped once when they end, then
 * COMPLETION_OVERDUE_HOURS later the teacher is emailed (only for sessions that ended within
 * COMPLETION_REMINDER_MAX_AGE_DAYS). Nothing here changes a session's status.
 */
async function flagUnresolvedSessions() {
  await sql`
    UPDATE mentorship_bookings SET awaiting_completion_at = now()
    WHERE status = 'scheduled' AND awaiting_completion_at IS NULL
      AND (scheduled_at AT TIME ZONE 'UTC') + make_interval(mins => duration_minutes) <= now()
  `.execute(db);
  await sql`
    UPDATE group_lessons SET awaiting_completion_at = now()
    WHERE status = 'scheduled' AND awaiting_completion_at IS NULL AND live_course_id IS NULL
      AND start_time + make_interval(mins => duration_minutes) <= now()
  `.execute(db);

  const overdueHours = sql.lit(COMPLETION_OVERDUE_HOURS);
  const maxAgeDays = sql.lit(COMPLETION_REMINDER_MAX_AGE_DAYS);
  const overdueBookings = await sql<{ id: string; recent: boolean }>`
    UPDATE mentorship_bookings SET completion_overdue_at = now()
    WHERE status = 'scheduled' AND completion_overdue_at IS NULL
      AND (scheduled_at AT TIME ZONE 'UTC') + make_interval(mins => duration_minutes) + make_interval(hours => ${overdueHours}) <= now()
    RETURNING id,
      (scheduled_at AT TIME ZONE 'UTC') + make_interval(mins => duration_minutes) >= now() - make_interval(days => ${maxAgeDays}) AS recent
  `.execute(db);
  const overdueLessons = await sql<{ id: string; recent: boolean }>`
    UPDATE group_lessons SET completion_overdue_at = now()
    WHERE status = 'scheduled' AND completion_overdue_at IS NULL AND live_course_id IS NULL
      AND start_time + make_interval(mins => duration_minutes) + make_interval(hours => ${overdueHours}) <= now()
    RETURNING id, start_time + make_interval(mins => duration_minutes) >= now() - make_interval(days => ${maxAgeDays}) AS recent
  `.execute(db);
  for (const r of overdueBookings.rows) if (r.recent) await sendCompletionOverdueEmail("booking", r.id);
  for (const r of overdueLessons.rows) if (r.recent) await sendCompletionOverdueEmail("group", r.id);
}

async function sendReminders() {
  const now = Date.now();
  const dayAhead = await db
    .updateTable("mentorshipBookings")
    .set({ reminder24hSentAt: new Date() })
    .where("status", "=", "scheduled")
    .where("reminder24hSentAt", "is", null)
    .where("scheduledAt", ">", new Date(now + 3 * HOUR_MS))
    .where("scheduledAt", "<=", new Date(now + DAY_MS))
    .returning("id")
    .execute();
  for (const b of dayAhead) {
    await sendClassReminderEmails(b.id, "24h");
    await sendClassReminderWhatsApp(b.id);
  }

  const hourAhead = await db
    .updateTable("mentorshipBookings")
    .set({ reminder1hSentAt: new Date() })
    .where("status", "=", "scheduled")
    .where("reminder1hSentAt", "is", null)
    .where("scheduledAt", ">", new Date(now))
    .where("scheduledAt", "<=", new Date(now + 75 * MIN_MS))
    .returning("id")
    .execute();
  for (const b of hourAhead) {
    await sendClassReminderEmails(b.id, "1h");
    await sendClassReminderWhatsApp(b.id);
  }
}

export async function runLiveTeachingSweep(): Promise<void> {
  await part("checkouts", settleStaleCheckouts);
  await part("abandoned mandates", settleAbandonedMandates);
  await part("renewals", startDueRenewals);
  await part("charges", raiseAndPollCharges);
  await part("lapsed", endLapsedPackages);
  await part("classes", settleFinishedClasses);
  await part("unresolved", flagUnresolvedSessions);
  await part("reminders", sendReminders);
  await runLiveCourseSweep(part);
}
