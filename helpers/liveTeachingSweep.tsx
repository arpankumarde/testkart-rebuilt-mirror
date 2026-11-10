import { sql } from "kysely";
import { db } from "./db";
import { AUTO_COMPLETE_AFTER_MINUTES } from "./liveLessonConfig";
import {
  abandonPendingPackage,
  failRenewal,
  raiseRenewalCharge,
  returnCredit,
  settleLivePackageCheckout,
  settleLiveRenewal,
  spendCredit,
  startLiveRenewal,
  stopLivePackage,
} from "./livePackages";
import { sendClassRefundedEmail, sendClassReminderEmails, sendTrialFollowUpEmail } from "./livePackageEmails";
import { sendClassReminderWhatsApp } from "./liveClassWhatsApp";

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

/** First checkouts whose return or webhook never arrived. Gives up after a day. */
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
      await db.transaction().execute((trx) => abandonPendingPackage(trx, row.id, "The checkout was not completed."));
    }
  }
}

async function startDueRenewals() {
  const due = await sql<{ id: string }>`
    SELECT p.id FROM live_packages p
    JOIN LATERAL (
      SELECT status, ends_at FROM live_package_cycles c WHERE c.package_id = p.id ORDER BY cycle_number DESC LIMIT 1
    ) last ON TRUE
    WHERE p.status = 'active' AND p.auto_renew AND last.status = 'paid' AND last.ends_at <= now() + interval '2 days'
    LIMIT 50
  `.execute(db);
  for (const row of due.rows) await startLiveRenewal(row.id);
}

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
        await failRenewal(c.id, "We could not set up the autopay debit.");
      } else {
        await raiseRenewalCharge(c.id);
      }
      continue;
    }
    await settleLiveRenewal(c.id).catch((error) => console.error(`[liveTeachingSweep] renewal ${c.id}:`, error));
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
      SELECT status, ends_at FROM live_package_cycles c WHERE c.package_id = p.id ORDER BY cycle_number DESC LIMIT 1
    ) last ON TRUE
    WHERE p.status = 'active' AND NOT p.auto_renew AND last.status = 'paid' AND last.ends_at < now()
    LIMIT 50
  `.execute(db);
  for (const row of finished.rows) {
    await stopLivePackage(row.id, { by: "system", reason: "The package period ended.", finalStatus: "ended" });
  }
}

/**
 * Closes out paid classes AUTO_COMPLETE_AFTER_MINUTES after they end. Teacher joined: held, the
 * credit is spent and the teacher earns. Teacher never joined: cancelled and the credit returned.
 * Whether the student joined does not matter: a student no-show is charged.
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
    .innerJoin("users", "users.id", "liveLessonAttendance.userId")
    .select("liveLessonAttendance.mentorshipBookingId")
    .where("liveLessonAttendance.mentorshipBookingId", "in", due.map((b) => b.id))
    .where("liveLessonAttendance.role", "=", "teacher")
    .where("users.role", "=", "teacher")
    .execute();
  const teacherCame = new Set(joined.map((j) => j.mentorshipBookingId));

  for (const b of due) {
    const creditId = b.creditId as string;
    if (teacherCame.has(b.id)) {
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable("mentorshipBookings")
          .set({ status: "completed", earningStatus: "earned", updatedAt: new Date() })
          .where("id", "=", b.id)
          .execute();
        await spendCredit(trx, creditId);
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
          cancellationReason: "The teacher did not join.",
          cancelledAt: new Date(),
          earningStatus: "void",
          updatedAt: new Date(),
        })
        .where("id", "=", b.id)
        .execute();
      return returnCredit(trx, creditId);
    });
    await sendClassRefundedEmail(b.id, outcome);
  }
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
  await part("renewals", startDueRenewals);
  await part("charges", raiseAndPollCharges);
  await part("lapsed", endLapsedPackages);
  await part("classes", settleFinishedClasses);
  await part("reminders", sendReminders);
}
