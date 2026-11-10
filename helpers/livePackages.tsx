import { sql, type Kysely } from "kysely";
import { nanoid } from "nanoid";
import { db } from "./db";
import type { DB } from "./schema";
import { isTeacherSlotBookable } from "./mentorshipSlots";
import { followTeacher } from "./ensureTeacherFollow";
import { getTeacherPlatformFee } from "./getTeacherPlatformFee";
import { cashfreeModeCode } from "./cashfree";
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
 * is never withdrawn.
 */

type Exec = Kysely<DB>;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const LIVE_PACKAGE_STATUSES = ["active", "past_due"] as const;

export const teacherBookingLock = (teacherId: number) =>
  sql`select pg_advisory_xact_lock(hashtext(${"mentorship_booking_teacher_" + teacherId}))`;

export const roundMoney = (n: number) => Math.round(n * 100) / 100;

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

/** "done" once a trial was held or charged; a cancelled trial makes the student eligible again. */
export async function getTrialState(studentId: number, teacherId: number, exec: Exec = db): Promise<TrialState> {
  const credits = await exec
    .selectFrom("liveClassCredits")
    .select("status")
    .where("studentId", "=", studentId)
    .where("teacherId", "=", teacherId)
    .where("kind", "=", "trial")
    .where("status", "in", ["booked", "spent"])
    .execute();
  if (credits.some((c) => c.status === "spent")) return "done";
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

/**
 * Hands a credit back after its class was called off (teacher cancelled or did not come, the
 * student cancelled in time, or an admin upheld a report). A trial goes to the balance; a
 * package class waits to be scheduled again, or goes to the balance once the package stopped.
 */
export async function returnCredit(trx: Exec, creditId: string): Promise<"unscheduled" | "released"> {
  const credit = await trx
    .selectFrom("liveClassCredits")
    .leftJoin("livePackages", "livePackages.id", "liveClassCredits.packageId")
    .select(["liveClassCredits.kind", "livePackages.status as packageStatus"])
    .where("liveClassCredits.id", "=", creditId)
    .executeTakeFirstOrThrow();
  const packageLive = credit.kind === "package" && (LIVE_PACKAGE_STATUSES as readonly string[]).includes(credit.packageStatus ?? "");
  const next = packageLive ? "unscheduled" : "released";
  await trx
    .updateTable("liveClassCredits")
    .set({ status: next, bookingId: null, releasedAt: next === "released" ? new Date() : null, spentAt: null, updatedAt: new Date() })
    .where("id", "=", creditId)
    .execute();
  return next;
}

export async function spendCredit(trx: Exec, creditId: string): Promise<void> {
  await trx
    .updateTable("liveClassCredits")
    .set({ status: "spent", spentAt: new Date(), updatedAt: new Date() })
    .where("id", "=", creditId)
    .execute();
}

export const isLateForStudent = (scheduledAt: Date) =>
  new Date(scheduledAt).getTime() - Date.now() < FREE_CANCELLATION_CUTOFF_HOURS * HOUR_MS;

/**
 * Marks a paid cycle done: order completed, cycle paid, package active, one credit per class, and
 * a booking for each held slot that is still free. Credits without a slot wait to be scheduled.
 * A payment that lands after the package stopped turns into released balance instead.
 * Idempotent; returns null when the cycle was already paid.
 */
export async function completeLiveCycle(trx: Exec, cycleId: string, paymentMode: string | null = null): Promise<CycleSummary | null> {
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
  if (!cycle || cycle.status === "paid") return null;

  const now = new Date();
  if (cycle.orderId !== null) {
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
      .where("id", "=", cycle.orderId)
      .where("status", "in", ["pending", "failed", "cancelled"])
      .execute();
  }
  await trx
    .updateTable("livePackageCycles")
    .set({ status: "paid", paidAt: now, failureReason: null, graceUntil: null, updatedAt: now })
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
        orderId: cycle.orderId,
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
        orderId: cycle.orderId,
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

/** A first checkout that will never be paid: nothing is kept, slots and balance free up. */
export async function abandonPendingPackage(trx: Exec, packageId: string, reason: string): Promise<void> {
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
  await trx
    .updateTable("liveMandates")
    .set({ status: "failed", updatedAt: now })
    .where("packageId", "=", packageId)
    .where("status", "=", "initialized")
    .execute();
  await trx
    .updateTable("livePackages")
    .set({ status: "failed", updatedAt: now })
    .where("id", "=", packageId)
    .where("status", "=", "pending")
    .execute();
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
    return pkg.status === "failed"
      ? { status: "failed", message: "This checkout did not go through." }
      : { status: "active", message: "Your package is active." };
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
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("liveMandates")
        .set({ gatewayStatus: sub.subscription_status, updatedAt: new Date() })
        .where("id", "=", mandate.id)
        .execute();
      await abandonPendingPackage(trx, packageId, reason);
    });
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

/** Sets up the next cycle: holds last cycle's times 4 weeks on, uses balance first, raises the debit. */
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
      .orderBy("cycleNumber", "desc")
      .executeTakeFirst();
    if (!prev || prev.status !== "paid") return null;
    const prevEnd = new Date(prev.endsAt);
    if (prevEnd.getTime() - Date.now() > PACKAGE_RENEW_LEAD_DAYS * DAY_MS) return null;

    const perWeek = pkg.nextClassesPerWeek ?? pkg.classesPerWeek;
    const classCount = perWeek * PACKAGE_WEEKS;
    const price = Number(pkg.pricePerClass);
    const amount = roundMoney(price * classCount);
    const fee = await getTeacherPlatformFee(pkg.teacherId, trx);
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
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const cycle = await trx
      .insertInto("livePackageCycles")
      .values({
        packageId,
        cycleNumber: prev.cycleNumber + 1,
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
    return { cycleId: cycle.id, charge };
  });
  if (!prep) return;

  if (prep.charge <= 0) {
    const summary = await db.transaction().execute((trx) => completeLiveCycle(trx, prep.cycleId));
    if (summary) await sendRenewalPaidEmail(summary);
    return;
  }
  await raiseRenewalCharge(prep.cycleId);
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
    await db
      .updateTable("livePackageCycles")
      .set({ chargeRequestedAt: new Date(), failureReason: null, updatedAt: new Date() })
      .where("id", "=", cycleId)
      .execute();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not raise the renewal debit.";
    console.error(`[livePackages] Renewal charge for cycle ${cycleId} failed:`, message);
    await db
      .updateTable("livePackageCycles")
      .set({ failureReason: message.slice(0, 300), updatedAt: new Date() })
      .where("id", "=", cycleId)
      .execute();
  }
}

export async function failRenewal(cycleId: string, reason: string): Promise<void> {
  const packageId = await db.transaction().execute(async (trx) => {
    await markCycleFailed(trx, cycleId, reason);
    const row = await trx.selectFrom("livePackageCycles").select("packageId").where("id", "=", cycleId).executeTakeFirst();
    return row?.packageId ?? null;
  });
  if (packageId) await sendRenewalFailedEmail(packageId, reason);
}

/** Brings a raised renewal debit in line with Cashfree. */
export async function settleLiveRenewal(cycleId: string): Promise<"paid" | "pending" | "failed"> {
  const cycle = await db
    .selectFrom("livePackageCycles")
    .innerJoin("orders", "orders.id", "livePackageCycles.orderId")
    .select([
      "livePackageCycles.packageId",
      "livePackageCycles.paymentId",
      "livePackageCycles.status",
      "livePackageCycles.chargeRequestedAt",
      "orders.totalAmount",
    ])
    .where("livePackageCycles.id", "=", cycleId)
    .executeTakeFirst();
  if (!cycle) return "failed";
  if (cycle.status === "paid") return "paid";
  if (cycle.status !== "pending" || !cycle.paymentId || !cycle.chargeRequestedAt) return "pending";

  const mandate = await latestMandate(db, cycle.packageId);
  if (!mandate) return "pending";
  const payment = await fetchCashfreeSubscriptionPayment(mandate.subscriptionId, cycle.paymentId);

  if (payment.payment_status === "SUCCESS") {
    if (payment.payment_amount != null && Math.abs(Number(payment.payment_amount) - Number(cycle.totalAmount)) > 0.009) {
      console.error(`[livePackages] Renewal ${cycleId} paid ${payment.payment_amount}, expected ${cycle.totalAmount}. Not completing.`);
      return "pending";
    }
    const summary = await db.transaction().execute((trx) => completeLiveCycle(trx, cycleId));
    if (summary) await sendRenewalPaidEmail(summary);
    return "paid";
  }
  if (FAILED_SUBSCRIPTION_PAYMENT_STATUSES.includes(payment.payment_status)) {
    await failRenewal(cycleId, payment.failure_details?.failure_reason || "The autopay debit failed.");
    return "failed";
  }
  return "pending";
}

/**
 * Stops a package. Cancelling: classes at least FREE_CANCELLATION_CUTOFF_HOURS away are cancelled
 * and their money goes to the balance; nearer classes stay on (they are charged either way).
 * Ending (the period ran out or a failed renewal was never paid): every booked class stays on.
 * Either way classes waiting to be scheduled go to the balance, and the mandate and any pending
 * debit are cancelled.
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
      .select(["id", "orderId", "paymentId", "chargeRequestedAt"])
      .where("packageId", "=", packageId)
      .where("status", "in", ["pending", "failed"])
      .execute();
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
      .returning(["subscriptionId", "status"])
      .execute();

    const pendingCharges = openCycles.filter((c) => c.paymentId && c.chargeRequestedAt).map((c) => c.paymentId as string);
    return { released, subscriptionIds: mandates.map((m) => m.subscriptionId), pendingCharges };
  });

  for (const subscriptionId of result.subscriptionIds) {
    for (const paymentId of result.pendingCharges) {
      await cancelCashfreeSubscriptionPayment(subscriptionId, paymentId).catch((error) =>
        console.error(`[livePackages] Could not cancel debit ${paymentId}:`, error)
      );
    }
    await cancelCashfreeSubscription(subscriptionId).catch((error) =>
      console.error(`[livePackages] Could not cancel mandate ${subscriptionId}:`, error)
    );
  }
  return { released: result.released };
}

/** The package that a paid order belongs to, for the one-time "Pay now" path after a failed debit. */
export async function cycleForOrder(exec: Exec, orderId: number) {
  return exec
    .selectFrom("livePackageCycles")
    .select(["id", "status"])
    .where("orderId", "=", orderId)
    .executeTakeFirst();
}
