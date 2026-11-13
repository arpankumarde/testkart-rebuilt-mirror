import { sql, type Kysely } from "kysely";
import { nanoid } from "nanoid";
import { toZonedTime } from "date-fns-tz";
import { db } from "./db";
import type { DB } from "./schema";
import { isTeacherSlotBookable } from "./mentorshipSlots";
import { followTeacher } from "./ensureTeacherFollow";
import { getTeacherPlatformFee } from "./getTeacherPlatformFee";
import { cashfreeGatewayEnv, cashfreeModeCode, terminateCashfreeOrder } from "./cashfree";
import {
  authorizationOf,
  cancelCashfreeSubscription,
  cancelCashfreeSubscriptionPayment,
  DEAD_SUBSCRIPTION_STATUSES,
  FAILED_SUBSCRIPTION_PAYMENT_STATUSES,
  fetchCashfreeSubscription,
  fetchCashfreeSubscriptionPayment,
  fetchCashfreeSubscriptionPayments,
  paymentMethodLabel,
  raiseCashfreeSubscriptionCharge,
} from "./cashfreeSubscriptions";
import {
  CREDIT_SCHEDULE_MAX_DAYS,
  FREE_CANCELLATION_CUTOFF_HOURS,
  PACKAGE_CYCLE_DAYS,
  PACKAGE_GRACE_DAYS,
  PACKAGE_RENEW_LEAD_DAYS,
  PACKAGE_WEEKS,
} from "./liveLessonConfig";
import {
  sendPackageStartedEmails,
  sendRenewalFailedEmail,
  sendRenewalPaidEmail,
  type CycleSummary,
} from "./livePackageEmails";

/**
 * Live 1:1 packages: N classes a week for 4 weeks at the teacher's per-class price, paid by a
 * Cashfree mandate. Every paid class is a live_class_credits row. A credit is
 *   unscheduled -> booked (a mentorship_bookings row) -> spent (held, or charged for a late cancel)
 * or released, which moves its amount to the student's live class balance. The balance is
 * derived, never stored: released credits minus orders.live_balance_used on completed orders and
 * on pending orders still inside their live_hold_until window. It pays only for live classes and
 * is never withdrawn. Every read-then-spend of the balance runs under studentBalanceLock.
 */

type Exec = Kysely<DB>;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const LIVE_PACKAGE_STATUSES = ["active", "past_due"] as const;

/** A pending package checkout keeps its balance hold until it is settled or abandoned (the sweep gives up after a day). */
export const PACKAGE_CHECKOUT_HOLD_MS = 2 * DAY_MS;

export const teacherBookingLock = (teacherId: number) =>
  sql`select pg_advisory_xact_lock(hashtext(${"mentorship_booking_teacher_" + teacherId}))`;

/** Serialises balance use per student. Take it inside the transaction before getLiveBalance and the order insert. */
export const studentBalanceLock = (studentId: number) =>
  sql`select pg_advisory_xact_lock(hashtext(${"live_balance_student_" + studentId}))`;

export const roundMoney = (n: number) => Math.round(n * 100) / 100;

/** Cashfree order ids for "Pay now" orders carry their cycle id, so a paid order always finds its cycle. */
export const payNowRefPrefix = (cycleId: string) => `lpn-${cycleId.replace(/-/g, "")}-`;
export const payNowOrderRef = (cycleId: string) => `${payNowRefPrefix(cycleId)}${nanoid(6)}`;

function cycleIdFromPayNowRef(ref: string): string | null {
  const m = ref.match(/^lpn-([0-9a-f]{32})-/);
  if (!m) return null;
  const h = m[1];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function getLiveBalance(studentId: number, exec: Exec = db): Promise<number> {
  const result = await sql<{ balance: string | null }>`
    SELECT
      COALESCE((SELECT SUM(amount) FROM live_class_credits WHERE student_id = ${studentId} AND status = 'released'), 0)
      - COALESCE((
          SELECT SUM(live_balance_used) FROM orders
          WHERE user_id = ${studentId} AND live_balance_used > 0
            AND (status = 'completed' OR (status = 'pending' AND live_hold_until > now()))
        ), 0) AS balance
  `.execute(exec);
  return roundMoney(Number(result.rows[0]?.balance ?? 0));
}

export type TrialState = "eligible" | "booked" | "done";

/** A trial credit counts as held once spent, or once the teacher joined and the class is completed or its time is up. */
export function isTrialCreditHeld(
  c: {
    status: string;
    bookingStatus: string | null;
    scheduledAt: Date | string | null;
    durationMinutes: number | null;
    teacherJoined: boolean | number | null;
  },
  nowMs: number = Date.now()
): boolean {
  if (c.status === "spent") return true;
  if (c.status !== "booked" || !c.teacherJoined || c.scheduledAt === null || c.bookingStatus === "cancelled") return false;
  return c.bookingStatus === "completed" || new Date(c.scheduledAt).getTime() + (c.durationMinutes ?? 0) * 60000 <= nowMs;
}

/**
 * "done" once a trial was held or charged; a cancelled trial makes the student eligible again.
 * A trial the teacher joined counts as held as soon as it is marked completed or its time is up,
 * without waiting for the sweep to spend the credit hours later, so the student can pick a plan
 * straight from the classroom.
 */
export async function getTrialState(studentId: number, teacherId: number, exec: Exec = db): Promise<TrialState> {
  const credits = await exec
    .selectFrom("liveClassCredits")
    .leftJoin("mentorshipBookings", "mentorshipBookings.id", "liveClassCredits.bookingId")
    .select((eb) => [
      "liveClassCredits.status",
      "mentorshipBookings.status as bookingStatus",
      "mentorshipBookings.scheduledAt",
      "mentorshipBookings.durationMinutes",
      eb
        .exists(
          eb
            .selectFrom("liveLessonAttendance")
            .innerJoin("users", "users.id", "liveLessonAttendance.userId")
            .select("liveLessonAttendance.id")
            .whereRef("liveLessonAttendance.mentorshipBookingId", "=", "mentorshipBookings.id")
            .where("liveLessonAttendance.role", "=", "teacher")
            .where("users.role", "=", "teacher")
        )
        .as("teacherJoined"),
    ])
    .where("liveClassCredits.studentId", "=", studentId)
    .where("liveClassCredits.teacherId", "=", teacherId)
    .where("liveClassCredits.kind", "=", "trial")
    .where("liveClassCredits.status", "in", ["booked", "spent"])
    .execute();
  const nowMs = Date.now();
  if (credits.some((c) => isTrialCreditHeld(c, nowMs))) return "done";
  if (credits.length > 0) return "booked";

  const legacy = await exec
    .selectFrom("mentorshipBookings")
    .select(["status", "scheduledAt", "durationMinutes"])
    .where("studentId", "=", studentId)
    .where("teacherId", "=", teacherId)
    .where("creditId", "is", null)
    .where("status", "!=", "cancelled")
    .execute();
  const now = Date.now();
  if (legacy.some((b) => b.status !== "scheduled" || new Date(b.scheduledAt).getTime() + b.durationMinutes * 60000 < now)) {
    return "done";
  }
  return legacy.length > 0 ? "booked" : "eligible";
}

export async function getLivePackageFor(studentId: number, teacherId: number, exec: Exec = db) {
  return exec
    .selectFrom("livePackages")
    .select(["id", "status"])
    .where("studentId", "=", studentId)
    .where("teacherId", "=", teacherId)
    .where("status", "in", [...LIVE_PACKAGE_STATUSES])
    .executeTakeFirst();
}

/** True if the student has no other live 1:1 class overlapping [start, start + minutes). */
export async function isStudentFree(
  exec: Exec,
  studentId: number,
  start: Date,
  minutes: number,
  excludeBookingId?: string
): Promise<boolean> {
  const end = start.getTime() + minutes * 60000;
  let q = exec
    .selectFrom("mentorshipBookings")
    .select(["id", "scheduledAt", "durationMinutes"])
    .where("studentId", "=", studentId)
    .where("status", "!=", "cancelled")
    .where("scheduledAt", ">", new Date(start.getTime() - DAY_MS))
    .where("scheduledAt", "<", new Date(end + DAY_MS));
  if (excludeBookingId) q = q.where("id", "!=", excludeBookingId);
  const rows = await q.execute();
  return !rows.some((b) => {
    const bStart = new Date(b.scheduledAt).getTime();
    return start.getTime() < bStart + b.durationMinutes * 60000 && end > bStart;
  });
}

/** Books one credit into a class at startTime. Caller holds the teacher lock and has checked the slot. */
export async function bookCredit(
  trx: Exec,
  credit: {
    id: string;
    studentId: number;
    teacherId: number;
    kind: string;
    packageId: string | null;
    orderId: number | null;
    classMinutes: number;
    amount: string | number;
  },
  startTime: Date
): Promise<string> {
  const booking = await trx
    .insertInto("mentorshipBookings")
    .values({
      teacherId: credit.teacherId,
      studentId: credit.studentId,
      scheduledAt: startTime,
      durationMinutes: credit.classMinutes,
      amountPaid: String(credit.amount),
      orderId: credit.orderId,
      status: "scheduled",
      isTrial: credit.kind === "trial",
      creditId: credit.id,
      packageId: credit.packageId,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await trx
    .updateTable("liveClassCredits")
    .set({ status: "booked", bookingId: booking.id, updatedAt: new Date() })
    .where("id", "=", credit.id)
    .execute();
  return booking.id;
}

type CreditStatus = "unscheduled" | "booked" | "spent" | "released" | "void";

/**
 * Hands a credit back after its class was called off (teacher cancelled or did not come, the
 * student cancelled in time, or an admin upheld a report). A trial goes to the balance; a
 * package class waits to be scheduled again, or goes to the balance once the package stopped.
 * Only a credit in one of `from` (default: booked) moves; returns null when nothing changed.
 * An admin refund of a class already settled passes ["booked", "spent"].
 */
export async function returnCredit(
  trx: Exec,
  creditId: string,
  from: CreditStatus[] = ["booked"]
): Promise<"unscheduled" | "released" | null> {
  const credit = await trx
    .selectFrom("liveClassCredits")
    .leftJoin("livePackages", "livePackages.id", "liveClassCredits.packageId")
    .select(["liveClassCredits.kind", "livePackages.status as packageStatus"])
    .where("liveClassCredits.id", "=", creditId)
    .executeTakeFirstOrThrow();
  const packageLive = credit.kind === "package" && (LIVE_PACKAGE_STATUSES as readonly string[]).includes(credit.packageStatus ?? "");
  const next = packageLive ? "unscheduled" : "released";
  const moved = await trx
    .updateTable("liveClassCredits")
    .set({ status: next, bookingId: null, releasedAt: next === "released" ? new Date() : null, spentAt: null, updatedAt: new Date() })
    .where("id", "=", creditId)
    .where("status", "in", from)
    .returning("id")
    .executeTakeFirst();
  return moved ? next : null;
}

/** Spends a booked credit; false when it was not booked (already spent, returned or released). */
export async function spendCredit(trx: Exec, creditId: string): Promise<boolean> {
  const moved = await trx
    .updateTable("liveClassCredits")
    .set({ status: "spent", spentAt: new Date(), updatedAt: new Date() })
    .where("id", "=", creditId)
    .where("status", "=", "booked")
    .returning("id")
    .executeTakeFirst();
  return !!moved;
}

export const isLateForStudent = (scheduledAt: Date) =>
  new Date(scheduledAt).getTime() - Date.now() < FREE_CANCELLATION_CUTOFF_HOURS * HOUR_MS;

export type ScheduleCreditsResult = {
  booked: Date[];
  skipped: { startTime: Date; reason: string }[];
  waiting: number;
};

/**
 * Books a package's classes that are waiting for a time into the given start times, oldest cycle
 * first. A time that is taken (another booking, a live course or group class, a held slot), clashes
 * with the student's own classes or falls on a day that already has a class with this teacher is
 * skipped and reported; its credit keeps waiting. Run inside a transaction.
 */
export async function schedulePackageCredits(
  trx: Exec,
  studentId: number,
  packageId: string,
  startTimes: Date[]
): Promise<ScheduleCreditsResult> {
  const times = [...new Map(startTimes.map((t) => [t.getTime(), t])).values()].sort((a, b) => a.getTime() - b.getTime());
  const latest = Date.now() + CREDIT_SCHEDULE_MAX_DAYS * DAY_MS;

  const pkg = await trx
    .selectFrom("livePackages")
    .select(["id", "studentId", "teacherId", "status"])
    .where("id", "=", packageId)
    .forUpdate()
    .executeTakeFirst();
  if (!pkg || pkg.studentId !== studentId) throw new Error("Package not found.");
  if (!(LIVE_PACKAGE_STATUSES as readonly string[]).includes(pkg.status)) throw new Error("This package has stopped.");
  const teacher = await trx.selectFrom("users").select("timezone").where("id", "=", pkg.teacherId).executeTakeFirstOrThrow();

  const credits = await trx
    .selectFrom("liveClassCredits")
    .innerJoin("livePackageCycles", "livePackageCycles.id", "liveClassCredits.cycleId")
    .select([
      "liveClassCredits.id",
      "liveClassCredits.studentId",
      "liveClassCredits.teacherId",
      "liveClassCredits.kind",
      "liveClassCredits.packageId",
      "liveClassCredits.orderId",
      "liveClassCredits.classMinutes",
      "liveClassCredits.amount",
    ])
    .where("liveClassCredits.packageId", "=", pkg.id)
    .where("liveClassCredits.studentId", "=", studentId)
    .where("liveClassCredits.status", "=", "unscheduled")
    .orderBy("livePackageCycles.cycleNumber", "asc")
    .orderBy("liveClassCredits.createdAt", "asc")
    .forUpdate()
    .execute();
  if (credits.length === 0) throw new Error("All classes in this package already have a time.");

  await teacherBookingLock(pkg.teacherId).execute(trx);
  const dayKey = (d: Date) => {
    const z = toZonedTime(d, teacher.timezone);
    return `${z.getFullYear()}-${z.getMonth()}-${z.getDate()}`;
  };
  const withTeacher = await trx
    .selectFrom("mentorshipBookings")
    .select("scheduledAt")
    .where("studentId", "=", studentId)
    .where("teacherId", "=", pkg.teacherId)
    .where("status", "!=", "cancelled")
    .where("scheduledAt", ">", new Date(Date.now() - DAY_MS))
    .execute();
  const takenDays = new Set(withTeacher.map((b) => dayKey(new Date(b.scheduledAt))));

  const booked: Date[] = [];
  const skipped: ScheduleCreditsResult["skipped"] = [];
  let next = 0;
  for (const t of times) {
    const credit = credits[next];
    if (!credit) {
      skipped.push({ startTime: t, reason: "No paid classes left to book." });
      continue;
    }
    if (t.getTime() > latest) {
      skipped.push({ startTime: t, reason: `More than ${CREDIT_SCHEDULE_MAX_DAYS} days away.` });
      continue;
    }
    const key = dayKey(t);
    if (takenDays.has(key)) {
      skipped.push({ startTime: t, reason: "You already have a class with this teacher that day." });
      continue;
    }
    const slot = await isTeacherSlotBookable(pkg.teacherId, t, credit.classMinutes, trx);
    if (!slot.ok) {
      skipped.push({ startTime: t, reason: slot.reason });
      continue;
    }
    if (!(await isStudentFree(trx, studentId, t, credit.classMinutes))) {
      skipped.push({ startTime: t, reason: "You already have a class at this time." });
      continue;
    }
    await bookCredit(trx, credit, t);
    takenDays.add(key);
    booked.push(t);
    next++;
  }
  return { booked, skipped, waiting: credits.length - next };
}

/** Marks this cycle's other unpaid "Pay now" orders cancelled; returns their Cashfree ids to terminate after commit. */
async function cancelPendingPayNowOrders(trx: Exec, cycleId: string, exceptOrderId: number | null = null): Promise<string[]> {
  let q = trx
    .updateTable("orders")
    .set({ status: "cancelled", updatedAt: new Date() })
    .where("status", "=", "pending")
    .where("paymentMethod", "=", "cashfree")
    .where("paymentTransactionId", "like", `${payNowRefPrefix(cycleId)}%`);
  if (exceptOrderId !== null) q = q.where("id", "!=", exceptOrderId);
  const rows = await q.returning("paymentTransactionId").execute();
  return rows.map((r) => r.paymentTransactionId).filter((r): r is string => !!r);
}

/** Best effort: if Cashfree refuses, a later payment still settles and becomes balance. */
async function terminatePayNowOrders(refs: string[]): Promise<void> {
  for (const ref of refs) {
    await terminateCashfreeOrder(ref).catch((error) => console.error(`[livePackages] Could not terminate ${ref}:`, error));
  }
}

/**
 * A second payment for a cycle that is already paid (a late autopay debit after "Pay now", or a
 * stale checkout paid anyway). The order stays completed and its whole value, cash plus any
 * balance it used, goes to the live class balance as one released credit. Idempotent per order.
 */
async function releaseSurplusPayment(trx: Exec, cycleId: string, orderId: number): Promise<number> {
  const existing = await trx.selectFrom("liveClassCredits").select("id").where("orderId", "=", orderId).executeTakeFirst();
  if (existing) return 0;
  const order = await trx
    .selectFrom("orders")
    .select(["status", "totalAmount", "liveBalanceUsed"])
    .where("id", "=", orderId)
    .executeTakeFirstOrThrow();
  if (order.status === "refunded") return 0;
  const cycle = await trx
    .selectFrom("livePackageCycles")
    .innerJoin("livePackages", "livePackages.id", "livePackageCycles.packageId")
    .select([
      "livePackageCycles.platformFeePercentage",
      "livePackages.id as packageId",
      "livePackages.studentId",
      "livePackages.teacherId",
      "livePackages.classMinutes",
    ])
    .where("livePackageCycles.id", "=", cycleId)
    .executeTakeFirstOrThrow();
  const now = new Date();
  await trx
    .updateTable("orders")
    .set({ status: "completed", paidAt: now, paymentGatewayStatus: "SUCCESS", updatedAt: now })
    .where("id", "=", orderId)
    .where("status", "in", ["pending", "failed", "cancelled"])
    .execute();
  const amount = roundMoney(Number(order.totalAmount) + Number(order.liveBalanceUsed ?? 0));
  if (amount <= 0) return 0;
  await trx
    .insertInto("liveClassCredits")
    .values({
      studentId: cycle.studentId,
      teacherId: cycle.teacherId,
      kind: "package",
      packageId: cycle.packageId,
      cycleId,
      orderId,
      classMinutes: cycle.classMinutes,
      amount: amount.toFixed(2),
      platformFeePercentage: cycle.platformFeePercentage,
      status: "released",
      releasedAt: now,
    })
    .execute();
  console.warn(`[livePackages] Cycle ${cycleId} was already paid; order ${orderId} (${amount}) went to the live class balance.`);
  return amount;
}

/**
 * Marks a paid cycle done: order completed, cycle paid, package active, one credit per class, and
 * a booking for each held slot that is still free. Credits without a slot wait to be scheduled.
 * A payment that lands after the package stopped turns into released balance instead.
 * paidOrderId is the order that actually paid (a "Pay now" order, or the renewal order); it
 * becomes the cycle's order. If the cycle was already paid by another order, that payment
 * becomes balance. Idempotent; returns null when nothing new was completed.
 */
export async function completeLiveCycle(
  trx: Exec,
  cycleId: string,
  paymentMode: string | null = null,
  paidOrderId: number | null = null
): Promise<CycleSummary | null> {
  const cycle = await trx
    .selectFrom("livePackageCycles")
    .innerJoin("livePackages", "livePackages.id", "livePackageCycles.packageId")
    .select([
      "livePackageCycles.id",
      "livePackageCycles.status",
      "livePackageCycles.cycleNumber",
      "livePackageCycles.classesPerWeek",
      "livePackageCycles.classCount",
      "livePackageCycles.pricePerClass",
      "livePackageCycles.platformFeePercentage",
      "livePackageCycles.amount",
      "livePackageCycles.orderId",
      "livePackageCycles.endsAt",
      "livePackages.id as packageId",
      "livePackages.status as packageStatus",
      "livePackages.studentId",
      "livePackages.teacherId",
      "livePackages.classMinutes",
      "livePackages.nextClassesPerWeek",
    ])
    .where("livePackageCycles.id", "=", cycleId)
    .forUpdate()
    .executeTakeFirst();
  if (!cycle) return null;
  if (cycle.status === "paid") {
    if (paidOrderId !== null && cycle.orderId !== paidOrderId) await releaseSurplusPayment(trx, cycleId, paidOrderId);
    return null;
  }

  const now = new Date();
  const orderId = paidOrderId ?? cycle.orderId;
  if (orderId !== null) {
    await trx
      .updateTable("orders")
      .set({
        status: "completed",
        paidAt: now,
        updatedAt: now,
        paymentGatewayStatus: "SUCCESS",
        paymentErrorCode: null,
        paymentErrorMessage: null,
        ...(paymentMode ? { paymentMode } : {}),
      })
      .where("id", "=", orderId)
      .where("status", "in", ["pending", "failed", "cancelled"])
      .execute();
  }
  if (paidOrderId !== null && cycle.orderId !== null && cycle.orderId !== paidOrderId) {
    await trx
      .updateTable("orders")
      .set({ status: "cancelled", updatedAt: now })
      .where("id", "=", cycle.orderId)
      .where("status", "=", "pending")
      .execute();
  }
  await cancelPendingPayNowOrders(trx, cycleId, orderId);
  await trx
    .updateTable("livePackageCycles")
    .set({ status: "paid", paidAt: now, failureReason: null, graceUntil: null, orderId, updatedAt: now })
    .where("id", "=", cycleId)
    .execute();

  const live = ["pending", "active", "past_due"].includes(cycle.packageStatus);
  if (live) {
    await trx
      .updateTable("livePackages")
      .set({
        status: "active",
        activatedAt: sql`COALESCE(activated_at, now())`,
        classesPerWeek: cycle.classesPerWeek,
        nextClassesPerWeek: cycle.nextClassesPerWeek === cycle.classesPerWeek ? null : cycle.nextClassesPerWeek,
        updatedAt: now,
      })
      .where("id", "=", cycle.packageId)
      .execute();
  }

  await teacherBookingLock(cycle.teacherId).execute(trx);
  const holds = await trx
    .selectFrom("liveSlotHolds")
    .select(["startsAt"])
    .where("cycleId", "=", cycleId)
    .orderBy("startsAt", "asc")
    .execute();

  let booked = 0;
  for (let i = 0; i < cycle.classCount; i++) {
    const credit = await trx
      .insertInto("liveClassCredits")
      .values({
        studentId: cycle.studentId,
        teacherId: cycle.teacherId,
        kind: "package",
        packageId: cycle.packageId,
        cycleId,
        orderId,
        classMinutes: cycle.classMinutes,
        amount: cycle.pricePerClass,
        platformFeePercentage: cycle.platformFeePercentage,
        status: live ? "unscheduled" : "released",
        releasedAt: live ? null : now,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    const hold = holds[i];
    if (!live || !hold) continue;
    const start = new Date(hold.startsAt);
    const slot = await isTeacherSlotBookable(cycle.teacherId, start, cycle.classMinutes, trx, { ignoreHoldCycleId: cycleId });
    if (!slot.ok || !(await isStudentFree(trx, cycle.studentId, start, cycle.classMinutes))) continue;
    await bookCredit(
      trx,
      {
        id: credit.id,
        studentId: cycle.studentId,
        teacherId: cycle.teacherId,
        kind: "package",
        packageId: cycle.packageId,
        orderId,
        classMinutes: cycle.classMinutes,
        amount: cycle.pricePerClass,
      },
      start
    );
    booked++;
  }

  await trx.deleteFrom("liveSlotHolds").where("cycleId", "=", cycleId).execute();
  await followTeacher(trx, cycle.studentId, cycle.teacherId);

  return {
    packageId: cycle.packageId,
    studentId: cycle.studentId,
    teacherId: cycle.teacherId,
    cycleNumber: cycle.cycleNumber,
    classesPerWeek: cycle.classesPerWeek,
    classCount: cycle.classCount,
    classMinutes: cycle.classMinutes,
    booked,
    amount: Number(cycle.amount),
    endsAt: new Date(cycle.endsAt),
    live,
  };
}

/**
 * A first checkout that will never be paid: nothing is kept, slots and balance free up. Returns
 * the subscription ids it failed; pass them to cancelAbandonedMandates after the transaction commits.
 */
export async function abandonPendingPackage(trx: Exec, packageId: string, reason: string): Promise<string[]> {
  const now = new Date();
  const cycles = await trx
    .selectFrom("livePackageCycles")
    .select(["id", "orderId"])
    .where("packageId", "=", packageId)
    .where("status", "=", "pending")
    .execute();
  for (const c of cycles) {
    await trx.deleteFrom("liveSlotHolds").where("cycleId", "=", c.id).execute();
    if (c.orderId !== null) {
      await trx
        .updateTable("orders")
        .set({ status: "failed", paymentErrorMessage: reason.slice(0, 300), updatedAt: now })
        .where("id", "=", c.orderId)
        .where("status", "=", "pending")
        .execute();
    }
  }
  await trx
    .updateTable("livePackageCycles")
    .set({ status: "cancelled", failureReason: reason.slice(0, 300), updatedAt: now })
    .where("packageId", "=", packageId)
    .where("status", "=", "pending")
    .execute();
  const mandates = await trx
    .updateTable("liveMandates")
    .set({ status: "failed", updatedAt: now })
    .where("packageId", "=", packageId)
    .where("status", "=", "initialized")
    .returning("subscriptionId")
    .execute();
  await trx
    .updateTable("livePackages")
    .set({ status: "failed", updatedAt: now })
    .where("id", "=", packageId)
    .where("status", "=", "pending")
    .execute();
  return mandates.map((m) => m.subscriptionId);
}

/**
 * A mandate whose checkout was abandoned or replaced. Cancels it at Cashfree; if the student
 * authorised it anyway and the first cycle was taken as the authorisation payment, that cycle
 * completes on the stopped package, so its money becomes live class balance. Safe to repeat;
 * returns the cash amount released.
 */
export async function reconcileAbandonedMandate(subscriptionId: string): Promise<number> {
  const mandate = await db
    .selectFrom("liveMandates")
    .innerJoin("livePackages", "livePackages.id", "liveMandates.packageId")
    .select(["liveMandates.id", "liveMandates.packageId", "liveMandates.status", "livePackages.status as packageStatus"])
    .where("liveMandates.subscriptionId", "=", subscriptionId)
    .executeTakeFirst();
  if (!mandate || mandate.status !== "failed" || mandate.packageStatus !== "failed") return 0;

  let sub;
  try {
    sub = await fetchCashfreeSubscription(subscriptionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not found|does not exist/i.test(message)) {
      await db.updateTable("liveMandates").set({ gatewayStatus: "NOT_FOUND", updatedAt: new Date() }).where("id", "=", mandate.id).execute();
      return 0;
    }
    throw error;
  }
  const payments = await fetchCashfreeSubscriptionPayments(subscriptionId).catch(() => []);
  let gatewayStatus = sub.subscription_status;
  if (!DEAD_SUBSCRIPTION_STATUSES.includes(gatewayStatus)) {
    try {
      await cancelCashfreeSubscription(subscriptionId);
      gatewayStatus = "CANCELLED";
    } catch (error) {
      console.error(`[livePackages] Could not cancel abandoned mandate ${subscriptionId}:`, error);
    }
  }

  let released = 0;
  const auth = payments.find((p) => (p.payment_type ?? "").toUpperCase() === "AUTH");
  if (auth?.payment_status === "SUCCESS") {
    const first = await db
      .selectFrom("livePackageCycles")
      .innerJoin("orders", "orders.id", "livePackageCycles.orderId")
      .select(["livePackageCycles.id", "orders.totalAmount"])
      .where("livePackageCycles.packageId", "=", mandate.packageId)
      .where("livePackageCycles.cycleNumber", "=", 1)
      .executeTakeFirst();
    const toPay = Number(first?.totalAmount ?? 0);
    // With nothing to pay the authorisation was a refundable rupee, which Cashfree returns itself.
    if (first && toPay > 0) {
      if (auth.payment_amount != null && Math.abs(Number(auth.payment_amount) - toPay) > 0.009) {
        console.error(`[livePackages] Abandoned mandate ${subscriptionId} authorised ${auth.payment_amount}, expected ${toPay}. Settle by hand.`);
      } else {
        const method = paymentMethodLabel(auth.authorization_details ?? authorizationOf(sub));
        const summary = await db.transaction().execute((trx) => completeLiveCycle(trx, first.id, cashfreeModeCode(method)));
        if (summary) {
          released = toPay;
          console.warn(`[livePackages] Abandoned mandate ${subscriptionId} was paid; ${toPay} went to the live class balance.`);
        }
      }
    }
  }
  await db
    .updateTable("liveMandates")
    .set({
      gatewayStatus,
      ...(DEAD_SUBSCRIPTION_STATUSES.includes(gatewayStatus) ? { cancelledAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where("id", "=", mandate.id)
    .execute();
  return released;
}

/** Run after an abandon commits, so an old checkout can no longer be authorised and any payment it took is kept as balance. */
export async function cancelAbandonedMandates(subscriptionIds: string[]): Promise<void> {
  for (const id of subscriptionIds) {
    await reconcileAbandonedMandate(id).catch((error) => console.error(`[livePackages] Abandoned mandate ${id}:`, error));
  }
}

async function latestMandate(exec: Exec, packageId: string) {
  return exec
    .selectFrom("liveMandates")
    .selectAll()
    .where("packageId", "=", packageId)
    .orderBy("createdAt", "desc")
    .executeTakeFirst();
}

export type SettleOutcome = { status: "active" | "pending" | "failed"; message: string };

/** Brings a first checkout (mandate + first cycle) in line with Cashfree. Safe to call repeatedly. */
export async function settleLivePackageCheckout(packageId: string): Promise<SettleOutcome> {
  const pkg = await db.selectFrom("livePackages").select(["id", "status"]).where("id", "=", packageId).executeTakeFirst();
  if (!pkg) throw new Error("Package not found.");
  if (pkg.status !== "pending") {
    if (pkg.status !== "failed") return { status: "active", message: "Your package is active." };
    const old = await latestMandate(db, packageId);
    const released = old ? await reconcileAbandonedMandate(old.subscriptionId).catch(() => 0) : 0;
    return {
      status: "failed",
      message:
        released > 0
          ? `This checkout was replaced, so Rs ${released.toFixed(2)} went to your live class balance.`
          : "This checkout did not go through.",
    };
  }
  const mandate = await latestMandate(db, packageId);
  if (!mandate) return { status: "failed", message: "This checkout did not go through." };

  let sub;
  try {
    sub = await fetchCashfreeSubscription(mandate.subscriptionId);
  } catch (error) {
    console.error(`[livePackages] Could not read mandate ${mandate.subscriptionId}:`, error);
    return { status: "pending", message: "We are still confirming your payment." };
  }
  const payments = await fetchCashfreeSubscriptionPayments(mandate.subscriptionId).catch(() => []);
  const auth = payments.find((p) => (p.payment_type ?? "").toUpperCase() === "AUTH");
  const authInfo = authorizationOf(sub);
  const authStatus = (authInfo?.authorization_status ?? "").toUpperCase();
  const authOk = auth?.payment_status === "SUCCESS" || authStatus === "SUCCESS" || authStatus === "ACTIVE";

  if (sub.subscription_status === "ACTIVE" && authOk) {
    if (auth?.payment_amount != null && Math.abs(Number(auth.payment_amount) - Number(mandate.authAmount)) > 0.009) {
      console.error(
        `[livePackages] Mandate ${mandate.subscriptionId} authorised ${auth.payment_amount}, expected ${mandate.authAmount}. Not activating.`
      );
      return { status: "pending", message: "The paid amount does not match. Please contact support." };
    }
    const method = paymentMethodLabel(auth?.authorization_details ?? authInfo);
    const summary = await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("liveMandates")
        .set({
          status: "active",
          gatewayStatus: sub.subscription_status,
          paymentMethod: method,
          cfSubscriptionId: sub.cf_subscription_id != null ? String(sub.cf_subscription_id) : mandate.cfSubscriptionId,
          activatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where("id", "=", mandate.id)
        .execute();
      const first = await trx
        .selectFrom("livePackageCycles")
        .select("id")
        .where("packageId", "=", packageId)
        .where("cycleNumber", "=", 1)
        .executeTakeFirst();
      return first ? completeLiveCycle(trx, first.id, cashfreeModeCode(method)) : null;
    });
    if (summary) await sendPackageStartedEmails(summary);
    return { status: "active", message: "Your package is active." };
  }

  const authFailed = (auth && FAILED_SUBSCRIPTION_PAYMENT_STATUSES.includes(auth.payment_status)) || authStatus === "FAILED";
  if (DEAD_SUBSCRIPTION_STATUSES.includes(sub.subscription_status) || authFailed) {
    const reason = auth?.failure_details?.failure_reason || "The autopay setup was not completed.";
    const abandoned = await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("liveMandates")
        .set({ gatewayStatus: sub.subscription_status, updatedAt: new Date() })
        .where("id", "=", mandate.id)
        .execute();
      return abandonPendingPackage(trx, packageId, reason);
    });
    if (!DEAD_SUBSCRIPTION_STATUSES.includes(sub.subscription_status)) await cancelAbandonedMandates(abandoned);
    return { status: "failed", message: reason };
  }
  return { status: "pending", message: "We are still confirming your payment." };
}

/** A renewal debit failed: the package waits PACKAGE_GRACE_DAYS for the student to pay. */
async function markCycleFailed(trx: Exec, cycleId: string, reason: string): Promise<void> {
  const cycle = await trx
    .selectFrom("livePackageCycles")
    .select(["id", "packageId", "orderId", "startsAt", "status"])
    .where("id", "=", cycleId)
    .executeTakeFirstOrThrow();
  if (cycle.status !== "pending") return;
  const now = new Date();
  const graceUntil = new Date(new Date(cycle.startsAt).getTime() + PACKAGE_GRACE_DAYS * DAY_MS);
  await trx
    .updateTable("livePackageCycles")
    .set({ status: "failed", failureReason: reason.slice(0, 300), graceUntil, updatedAt: now })
    .where("id", "=", cycleId)
    .execute();
  if (cycle.orderId !== null) {
    await trx
      .updateTable("orders")
      .set({ status: "failed", paymentErrorMessage: reason.slice(0, 300), updatedAt: now })
      .where("id", "=", cycle.orderId)
      .where("status", "=", "pending")
      .execute();
  }
  await trx.updateTable("liveSlotHolds").set({ expiresAt: graceUntil }).where("cycleId", "=", cycleId).execute();
  await trx
    .updateTable("livePackages")
    .set({ status: "past_due", updatedAt: now })
    .where("id", "=", cycle.packageId)
    .where("status", "=", "active")
    .execute();
}

/** IST calendar date (YYYY-MM-DD) for a Cashfree schedule date. */
const istDate = (d: Date) => new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);

/**
 * Sets up the next cycle: holds last cycle's times 4 weeks on, uses balance first, raises the debit.
 * A teacher who no longer teaches 1:1 (not approved, 1:1 off, or account inactive) ends the package instead.
 */
export async function startLiveRenewal(packageId: string): Promise<void> {
  const prep = await db.transaction().execute(async (trx) => {
    const pkg = await trx
      .selectFrom("livePackages")
      .selectAll()
      .where("id", "=", packageId)
      .where("status", "=", "active")
      .where("autoRenew", "=", true)
      .forUpdate()
      .executeTakeFirst();
    if (!pkg) return null;
    const prev = await trx
      .selectFrom("livePackageCycles")
      .selectAll()
      .where("packageId", "=", packageId)
      .where("status", "!=", "cancelled")
      .orderBy("cycleNumber", "desc")
      .executeTakeFirst();
    if (!prev || prev.status !== "paid") return null;
    const prevEnd = new Date(prev.endsAt);
    if (prevEnd.getTime() - Date.now() > PACKAGE_RENEW_LEAD_DAYS * DAY_MS) return null;

    const teacher = await trx
      .selectFrom("users")
      .select(["role", "mentorshipEnabled", "liveTeachingStatus", "isActive"])
      .where("id", "=", pkg.teacherId)
      .executeTakeFirst();
    if (!teacher || teacher.role !== "teacher" || !teacher.mentorshipEnabled || teacher.liveTeachingStatus !== "approved" || !teacher.isActive) {
      return { kind: "teacher_gone" as const };
    }

    const last = await trx
      .selectFrom("livePackageCycles")
      .select("cycleNumber")
      .where("packageId", "=", packageId)
      .orderBy("cycleNumber", "desc")
      .executeTakeFirstOrThrow();

    const perWeek = pkg.nextClassesPerWeek ?? pkg.classesPerWeek;
    const classCount = perWeek * PACKAGE_WEEKS;
    const price = Number(pkg.pricePerClass);
    const amount = roundMoney(price * classCount);
    const fee = await getTeacherPlatformFee(pkg.teacherId, trx);
    await studentBalanceLock(pkg.studentId).execute(trx);
    const balance = await getLiveBalance(pkg.studentId, trx);
    const balanceUsed = roundMoney(Math.max(0, Math.min(balance, amount)));
    const charge = roundMoney(amount - balanceUsed);
    const startsAt = prevEnd;
    const endsAt = new Date(prevEnd.getTime() + PACKAGE_CYCLE_DAYS * DAY_MS);
    const holdUntil = new Date(startsAt.getTime() + PACKAGE_GRACE_DAYS * DAY_MS);
    const paymentId = `lpc_${nanoid(18)}`;

    const order = await trx
      .insertInto("orders")
      .values({
        userId: pkg.studentId,
        totalAmount: charge.toFixed(2),
        status: "pending",
        paymentMethod: "cashfree_mandate",
        paymentTransactionId: paymentId,
        liveBalanceUsed: balanceUsed.toFixed(2),
        liveHoldUntil: holdUntil,
        emailsSentAt: new Date(),
        ...(charge > 0 ? { gatewayEnv: cashfreeGatewayEnv() } : {}),
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const cycle = await trx
      .insertInto("livePackageCycles")
      .values({
        packageId,
        cycleNumber: last.cycleNumber + 1,
        classesPerWeek: perWeek,
        classCount,
        pricePerClass: price.toFixed(2),
        platformFeePercentage: fee.toFixed(2),
        amount: amount.toFixed(2),
        startsAt,
        endsAt,
        status: "pending",
        orderId: order.id,
        paymentId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    await teacherBookingLock(pkg.teacherId).execute(trx);
    const lastTimes = await trx
      .selectFrom("liveClassCredits")
      .innerJoin("mentorshipBookings", "mentorshipBookings.id", "liveClassCredits.bookingId")
      .select("mentorshipBookings.scheduledAt")
      .where("liveClassCredits.cycleId", "=", prev.id)
      .orderBy("mentorshipBookings.scheduledAt", "asc")
      .execute();
    const taken: number[] = [];
    for (const row of lastTimes) {
      if (taken.length >= classCount) break;
      const start = new Date(new Date(row.scheduledAt).getTime() + PACKAGE_CYCLE_DAYS * DAY_MS);
      if (taken.some((t) => Math.abs(t - start.getTime()) < pkg.classMinutes * 60000)) continue;
      const slot = await isTeacherSlotBookable(pkg.teacherId, start, pkg.classMinutes, trx);
      if (!slot.ok || !(await isStudentFree(trx, pkg.studentId, start, pkg.classMinutes))) continue;
      await trx
        .insertInto("liveSlotHolds")
        .values({
          cycleId: cycle.id,
          teacherId: pkg.teacherId,
          studentId: pkg.studentId,
          startsAt: start,
          durationMinutes: pkg.classMinutes,
          expiresAt: holdUntil,
        })
        .execute();
      taken.push(start.getTime());
    }
    return { kind: "renew" as const, cycleId: cycle.id, charge };
  });
  if (!prep) return;
  if (prep.kind === "teacher_gone") {
    await stopLivePackage(packageId, { by: "system", reason: "The teacher no longer offers 1:1 classes.", finalStatus: "ended" });
    return;
  }

  if (prep.charge <= 0) {
    const summary = await db.transaction().execute((trx) => completeLiveCycle(trx, prep.cycleId));
    if (summary) await sendRenewalPaidEmail(summary);
    return;
  }
  await raiseRenewalCharge(prep.cycleId);
}

/** Records that Cashfree holds the debit; a cycle cancelled meanwhile gets the debit cancelled at once. */
async function markChargeRaised(cycleId: string, subscriptionId: string, paymentId: string): Promise<void> {
  const row = await db
    .updateTable("livePackageCycles")
    .set({ chargeRequestedAt: new Date(), failureReason: null, updatedAt: new Date() })
    .where("id", "=", cycleId)
    .returning("status")
    .executeTakeFirst();
  if (row?.status === "cancelled") {
    await cancelCashfreeSubscriptionPayment(subscriptionId, paymentId).catch((error) =>
      console.error(`[livePackages] Could not cancel debit ${paymentId} of cancelled cycle ${cycleId}:`, error)
    );
  }
}

async function chargeExistsAtCashfree(subscriptionId: string, paymentId: string): Promise<boolean> {
  try {
    const payment = await fetchCashfreeSubscriptionPayment(subscriptionId, paymentId);
    return !!payment?.payment_status;
  } catch {
    return false;
  }
}

/** Asks Cashfree to debit a pending renewal. Retried by the sweep until the cycle starts. */
export async function raiseRenewalCharge(cycleId: string): Promise<void> {
  const cycle = await db
    .selectFrom("livePackageCycles")
    .innerJoin("orders", "orders.id", "livePackageCycles.orderId")
    .select([
      "livePackageCycles.id",
      "livePackageCycles.packageId",
      "livePackageCycles.paymentId",
      "livePackageCycles.startsAt",
      "livePackageCycles.status",
      "livePackageCycles.chargeRequestedAt",
      "livePackageCycles.cycleNumber",
      "orders.totalAmount",
    ])
    .where("livePackageCycles.id", "=", cycleId)
    .executeTakeFirst();
  if (!cycle || cycle.status !== "pending" || cycle.chargeRequestedAt || !cycle.paymentId) return;

  const mandate = await db
    .selectFrom("liveMandates")
    .select(["subscriptionId"])
    .where("packageId", "=", cycle.packageId)
    .where("status", "=", "active")
    .orderBy("createdAt", "desc")
    .executeTakeFirst();
  if (!mandate) {
    await failRenewal(cycleId, "Autopay is not active for this package.");
    return;
  }

  const earliest = Date.now() + 26 * HOUR_MS;
  const scheduleDate = istDate(new Date(Math.max(new Date(cycle.startsAt).getTime(), earliest)));
  try {
    await raiseCashfreeSubscriptionCharge({
      subscriptionId: mandate.subscriptionId,
      paymentId: cycle.paymentId,
      amount: Number(cycle.totalAmount),
      scheduleDate,
      remarks: `Live classes, cycle ${cycle.cycleNumber}`,
    });
    await markChargeRaised(cycleId, mandate.subscriptionId, cycle.paymentId);
  } catch (error) {
    // A timeout or a retry of an id Cashfree already has: if it holds the debit, treat it as raised.
    if (await chargeExistsAtCashfree(mandate.subscriptionId, cycle.paymentId)) {
      await markChargeRaised(cycleId, mandate.subscriptionId, cycle.paymentId);
      return;
    }
    const message = error instanceof Error ? error.message : "Could not raise the renewal debit.";
    console.error(`[livePackages] Renewal charge for cycle ${cycleId} failed:`, message);
    await db
      .updateTable("livePackageCycles")
      .set({ failureReason: message.slice(0, 300), updatedAt: new Date() })
      .where("id", "=", cycleId)
      .execute();
  }
}

/** True (and recorded) when Cashfree already holds this cycle's debit although we never saw the reply. */
export async function confirmRaisedCharge(cycleId: string): Promise<boolean> {
  const cycle = await db.selectFrom("livePackageCycles").select(["packageId", "paymentId"]).where("id", "=", cycleId).executeTakeFirst();
  if (!cycle?.paymentId) return false;
  const mandate = await latestMandate(db, cycle.packageId);
  if (!mandate || !(await chargeExistsAtCashfree(mandate.subscriptionId, cycle.paymentId))) return false;
  await markChargeRaised(cycleId, mandate.subscriptionId, cycle.paymentId);
  return true;
}

export async function failRenewal(cycleId: string, reason: string): Promise<void> {
  const packageId = await db.transaction().execute(async (trx) => {
    await markCycleFailed(trx, cycleId, reason);
    const row = await trx.selectFrom("livePackageCycles").select("packageId").where("id", "=", cycleId).executeTakeFirst();
    return row?.packageId ?? null;
  });
  if (packageId) await sendRenewalFailedEmail(packageId, reason);
}

/**
 * Brings a renewal debit in line with Cashfree. A SUCCESS always counts: it completes the cycle
 * even if it was marked failed or cancelled meanwhile (on a stopped package the classes become
 * balance), and on a cycle already paid another way it becomes balance.
 */
export async function settleLiveRenewal(cycleId: string): Promise<"paid" | "pending" | "failed"> {
  const cycle = await db
    .selectFrom("livePackageCycles")
    .select(["id", "packageId", "paymentId", "status", "chargeRequestedAt"])
    .where("id", "=", cycleId)
    .executeTakeFirst();
  if (!cycle) return "failed";
  const idle = cycle.status === "paid" ? "paid" : cycle.status === "pending" ? "pending" : "failed";
  if (!cycle.paymentId || (cycle.status === "pending" && !cycle.chargeRequestedAt)) return idle;

  const renewalOrder = await db
    .selectFrom("orders")
    .select(["id", "status", "totalAmount"])
    .where("paymentTransactionId", "=", cycle.paymentId)
    .where("paymentMethod", "=", "cashfree_mandate")
    .executeTakeFirst();
  if (!renewalOrder || renewalOrder.status === "completed" || renewalOrder.status === "refunded") return idle;

  const mandate = await latestMandate(db, cycle.packageId);
  if (!mandate) return idle;
  let payment;
  try {
    payment = await fetchCashfreeSubscriptionPayment(mandate.subscriptionId, cycle.paymentId);
  } catch (error) {
    if (cycle.status === "pending") throw error;
    return idle;
  }

  if (payment.payment_status === "SUCCESS") {
    if (payment.payment_amount != null && Math.abs(Number(payment.payment_amount) - Number(renewalOrder.totalAmount)) > 0.009) {
      console.error(`[livePackages] Renewal ${cycleId} paid ${payment.payment_amount}, expected ${renewalOrder.totalAmount}. Not completing.`);
      return idle;
    }
    const result = await db.transaction().execute(async (trx) => {
      const refs = await cancelPendingPayNowOrders(trx, cycleId, renewalOrder.id);
      const summary = await completeLiveCycle(trx, cycleId, null, renewalOrder.id);
      return { refs, summary };
    });
    await terminatePayNowOrders(result.refs);
    if (result.summary) await sendRenewalPaidEmail(result.summary);
    return "paid";
  }
  if (cycle.status === "pending" && FAILED_SUBSCRIPTION_PAYMENT_STATUSES.includes(payment.payment_status)) {
    await failRenewal(cycleId, payment.failure_details?.failure_reason || "The autopay debit failed.");
    return "failed";
  }
  return idle;
}

export type RaisedCharge = { cycleId: string; paymentId: string };

/** Cancels this package's renewal cycles that are still pending (autopay turned off). Cashfree is told after commit. */
export async function cancelUpcomingRenewals(trx: Exec, packageId: string, reason: string): Promise<RaisedCharge[]> {
  const now = new Date();
  const cycles = await trx
    .updateTable("livePackageCycles")
    .set({ status: "cancelled", failureReason: reason.slice(0, 300), updatedAt: now })
    .where("packageId", "=", packageId)
    .where("status", "=", "pending")
    .returning(["id", "orderId", "paymentId"])
    .execute();
  for (const c of cycles) {
    await trx.deleteFrom("liveSlotHolds").where("cycleId", "=", c.id).execute();
    if (c.orderId !== null) {
      await trx
        .updateTable("orders")
        .set({ status: "cancelled", updatedAt: now })
        .where("id", "=", c.orderId)
        .where("status", "=", "pending")
        .execute();
    }
  }
  return cycles.filter((c) => c.paymentId).map((c) => ({ cycleId: c.id, paymentId: c.paymentId as string }));
}

/**
 * Cancels renewal debits at Cashfree, raised or possibly raised. One Cashfree refuses to cancel
 * (already debited) is settled, so money taken becomes classes or balance.
 */
export async function cancelRenewalCharges(packageId: string, charges: RaisedCharge[]): Promise<void> {
  if (charges.length === 0) return;
  const mandates = await db.selectFrom("liveMandates").select("subscriptionId").where("packageId", "=", packageId).execute();
  for (const charge of charges) {
    let cancelled = false;
    for (const m of mandates) {
      try {
        await cancelCashfreeSubscriptionPayment(m.subscriptionId, charge.paymentId);
        cancelled = true;
      } catch (error) {
        console.error(`[livePackages] Could not cancel debit ${charge.paymentId}:`, error);
      }
    }
    if (!cancelled) {
      await settleLiveRenewal(charge.cycleId).catch((error) => console.error(`[livePackages] Settle of ${charge.cycleId} failed:`, error));
    }
  }
}

/**
 * Stops a package. Cancelling: classes at least FREE_CANCELLATION_CUTOFF_HOURS away are cancelled
 * and their money goes to the balance; nearer classes stay on (they are charged either way).
 * Ending (the period ran out, a failed renewal was never paid, or the teacher stopped teaching
 * 1:1): every booked class stays on. Either way classes waiting to be scheduled go to the
 * balance, unpaid orders are cancelled, and the mandate and every renewal debit are cancelled.
 */
export async function stopLivePackage(
  packageId: string,
  args: { by: "student" | "admin" | "system"; reason: string; finalStatus: "cancelled" | "ended" }
): Promise<{ released: number }> {
  const result = await db.transaction().execute(async (trx) => {
    const pkg = await trx.selectFrom("livePackages").selectAll().where("id", "=", packageId).forUpdate().executeTakeFirst();
    if (!pkg) throw new Error("Package not found.");
    if (!["active", "past_due", "pending"].includes(pkg.status)) throw new Error("This package has already stopped.");
    const now = new Date();
    let released = 0;

    const bookings = await trx
      .selectFrom("mentorshipBookings")
      .select(["id", "scheduledAt", "creditId"])
      .where("packageId", "=", packageId)
      .where("status", "=", "scheduled")
      .execute();
    for (const b of bookings) {
      if (args.finalStatus === "ended" || isLateForStudent(new Date(b.scheduledAt))) continue;
      await trx
        .updateTable("mentorshipBookings")
        .set({
          status: "cancelled",
          cancelledBy: args.by,
          cancellationReason: args.reason,
          cancelledAt: now,
          earningStatus: "void",
          updatedAt: now,
        })
        .where("id", "=", b.id)
        .execute();
    }
    const freed = await trx
      .updateTable("liveClassCredits")
      .set({ status: "released", bookingId: null, releasedAt: now, updatedAt: now })
      .where("packageId", "=", packageId)
      .where((eb) =>
        eb.or([
          eb("status", "=", "unscheduled"),
          eb.and([
            eb("status", "=", "booked"),
            eb(
              "bookingId",
              "in",
              trx.selectFrom("mentorshipBookings").select("id").where("packageId", "=", packageId).where("status", "=", "cancelled")
            ),
          ]),
        ])
      )
      .returning("amount")
      .execute();
    released = roundMoney(freed.reduce((s, c) => s + Number(c.amount), 0));

    const openCycles = await trx
      .selectFrom("livePackageCycles")
      .select(["id", "orderId", "paymentId"])
      .where("packageId", "=", packageId)
      .where("status", "in", ["pending", "failed"])
      .execute();
    const payNowRefs: string[] = [];
    for (const c of openCycles) {
      await trx.deleteFrom("liveSlotHolds").where("cycleId", "=", c.id).execute();
      if (c.orderId !== null) {
        await trx
          .updateTable("orders")
          .set({ status: "cancelled", updatedAt: now })
          .where("id", "=", c.orderId)
          .where("status", "=", "pending")
          .execute();
      }
      payNowRefs.push(...(await cancelPendingPayNowOrders(trx, c.id)));
    }
    await trx
      .updateTable("livePackageCycles")
      .set({ status: "cancelled", updatedAt: now })
      .where("packageId", "=", packageId)
      .where("status", "in", ["pending", "failed"])
      .execute();

    await trx
      .updateTable("livePackages")
      .set({
        status: pkg.status === "pending" ? "failed" : args.finalStatus,
        autoRenew: false,
        cancelledAt: now,
        cancelledBy: args.by,
        cancelReason: args.reason,
        updatedAt: now,
      })
      .where("id", "=", packageId)
      .execute();

    const mandates = await trx
      .updateTable("liveMandates")
      .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
      .where("packageId", "=", packageId)
      .where("status", "in", ["initialized", "active"])
      .returning(["subscriptionId"])
      .execute();

    const charges: RaisedCharge[] = openCycles
      .filter((c) => c.paymentId)
      .map((c) => ({ cycleId: c.id, paymentId: c.paymentId as string }));
    return { released, subscriptionIds: mandates.map((m) => m.subscriptionId), charges, payNowRefs };
  });

  await terminatePayNowOrders(result.payNowRefs);
  await cancelRenewalCharges(packageId, result.charges);
  for (const subscriptionId of result.subscriptionIds) {
    await cancelCashfreeSubscription(subscriptionId).catch((error) =>
      console.error(`[livePackages] Could not cancel mandate ${subscriptionId}:`, error)
    );
  }
  return { released: result.released };
}

/**
 * The cycle an order pays for: the cycle's own order, a "Pay now" order (its Cashfree id carries
 * the cycle id), or a renewal order (its id is the cycle's payment id).
 */
export async function cycleForOrder(exec: Exec, orderId: number) {
  const direct = await exec
    .selectFrom("livePackageCycles")
    .select(["id", "status"])
    .where("orderId", "=", orderId)
    .executeTakeFirst();
  if (direct) return direct;
  const order = await exec
    .selectFrom("orders")
    .select(["paymentTransactionId", "paymentMethod"])
    .where("id", "=", orderId)
    .executeTakeFirst();
  const ref = order?.paymentTransactionId;
  if (!order || !ref) return undefined;
  const cycleId = order.paymentMethod === "cashfree" ? cycleIdFromPayNowRef(ref) : null;
  if (cycleId) {
    return exec.selectFrom("livePackageCycles").select(["id", "status"]).where("id", "=", cycleId).executeTakeFirst();
  }
  if (order.paymentMethod === "cashfree_mandate") {
    return exec.selectFrom("livePackageCycles").select(["id", "status"]).where("paymentId", "=", ref).executeTakeFirst();
  }
  return undefined;
}
