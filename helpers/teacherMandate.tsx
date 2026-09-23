import { randomUUID } from "crypto";
import { db } from "./db";
import { checkMandateStatus, revokeMandate } from "./payuSIApi";

/**
 * Autopay rules in one place. A PayU mandate stays live only on an active
 * subscription that renews automatically; anything else is revoked at PayU.
 * Cancelling never cuts a paid plan short: it runs to its end date, and the
 * daily job then moves the teacher to the Free plan unless a new mandate
 * renewed it.
 *
 * mandateStatus: "active"; "paused" (the payer paused it at PayU);
 * "cancel_pending" (stopped here, PayU has not confirmed the revoke yet, so
 * the daily job retries it); "cancelled" (revoked, or ended by the payer).
 */

// PayU refuses autopay txnids longer than 50 characters; these are 43 and 42.
// Rows from before 25-09-2026 carry the longer testkart- prefixes.
export const newMandateTxnid = () => `tk-mandate-${randomUUID().replace(/-/g, "")}`;
export const newChargeTxnid = () => `tk-charge-${randomUUID().replace(/-/g, "")}`;
export const CHARGE_TXNID_PATTERNS = ["tk-charge-%", "testkart-charge-%"];

export function isMandateTxnid(txnid: string): boolean {
  return txnid.startsWith("tk-mandate-") || txnid.startsWith("testkart-mandate-");
}

const LIVE_MANDATE_STATUSES = ["active", "paused", "cancel_pending"];
const ENDED_AT_PAYU = /cancel|discard|delet|fail|expir|revok/;

// PayU mandate ids are mihpayids. The first autopay rows stored a txnid
// instead, which PayU never knew as a mandate.
const isPayUMandateId = (id: string) => /^\d+$/.test(id);

// A mandate recorded without its payment mode is tried as a card, then as UPI.
const modesToTry = (paymentMode: string | null) => (paymentMode ? [paymentMode] : [null, "UPI"]);

/** PayU's view of a mandate, or null when PayU gave no clear answer. */
export async function mandateStateAtPayU(
  mandateId: string,
  paymentMode: string | null
): Promise<"active" | "paused" | "ended" | null> {
  if (!isPayUMandateId(mandateId)) return "ended";
  let notFound = 0;
  const modes = modesToTry(paymentMode);
  for (const mode of modes) {
    const check = await checkMandateStatus(mandateId, mode);
    if (!check.success) {
      // UPI answers "Mandate entry not found", cards "Consent is Not Mandated".
      if (/not found|not mandated/i.test(check.message)) notFound++;
      continue;
    }
    if (check.mandateStatus === "active") return "active";
    if (check.mandateStatus === "paused") return "paused";
    return ENDED_AT_PAYU.test(check.mandateStatus) ? "ended" : null;
  }
  return notFound === modes.length ? "ended" : null;
}

/**
 * Turns off auto-renewal and revokes the subscription's mandate at PayU. The
 * plan and its end date are left alone. Returns the mandate's new status, or
 * null when there was no live mandate.
 */
export async function revokeSubscriptionMandate(
  subscriptionId: number
): Promise<"cancelled" | "cancel_pending" | null> {
  const sub = await db
    .selectFrom("teacherSubscriptions")
    .select(["id", "mandateId", "mandateStatus", "mandatePaymentMode"])
    .where("id", "=", subscriptionId)
    .executeTakeFirst();
  if (!sub?.mandateId || !LIVE_MANDATE_STATUSES.includes(sub.mandateStatus ?? "")) {
    return null;
  }

  // Marked first, so no renewal charges this mandate while PayU is asked.
  await db
    .updateTable("teacherSubscriptions")
    .set({ mandateStatus: "cancel_pending", autoRenew: false, updatedAt: new Date() })
    .where("id", "=", sub.id)
    .execute();

  let revoked = !isPayUMandateId(sub.mandateId);
  for (const mode of revoked ? [] : modesToTry(sub.mandatePaymentMode)) {
    if ((await revokeMandate(sub.mandateId, mode)).success) {
      revoked = true;
      break;
    }
  }
  // PayU refuses to revoke a mandate that already ended, e.g. one the payer
  // revoked in their UPI or bank app.
  if (!revoked) {
    revoked = (await mandateStateAtPayU(sub.mandateId, sub.mandatePaymentMode)) === "ended";
  }

  if (!revoked) {
    console.error(
      `[teacherMandate] PayU did not confirm revoking mandate ${sub.mandateId} (subscription ${sub.id}); the daily job retries it`
    );
    return "cancel_pending";
  }
  await db
    .updateTable("teacherSubscriptions")
    .set({ mandateStatus: "cancelled", updatedAt: new Date() })
    .where("id", "=", sub.id)
    .execute();
  console.log(`[teacherMandate] Mandate ${sub.mandateId} revoked (subscription ${sub.id})`);
  return "cancelled";
}

/**
 * The teacher's cancel: stops renewal of their active paid plan and revokes
 * its mandate. The plan stays active until its end date. Null when the teacher
 * has no active paid plan.
 */
export async function stopTeacherRenewal(teacherId: number, subscriptionId?: number) {
  let query = db
    .selectFrom("teacherSubscriptions")
    .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
    .select([
      "teacherSubscriptions.id",
      "teacherSubscriptions.endDate",
      "subscriptionPlans.name as planName",
      "subscriptionPlans.price",
    ])
    .where("teacherSubscriptions.teacherId", "=", teacherId)
    .where("teacherSubscriptions.status", "=", "active")
    .orderBy("teacherSubscriptions.createdAt", "desc");
  if (subscriptionId !== undefined) {
    query = query.where("teacherSubscriptions.id", "=", subscriptionId);
  }
  const sub = await query.executeTakeFirst();
  if (!sub || Number(sub.price) <= 0) return null;

  await db
    .updateTable("teacherSubscriptions")
    .set({ autoRenew: false, updatedAt: new Date() })
    .where("id", "=", sub.id)
    .execute();
  const mandate = await revokeSubscriptionMandate(sub.id);

  return { subscriptionId: sub.id, planName: sub.planName, endDate: sub.endDate, mandate };
}

/**
 * Revokes every live mandate left on a closed or non-renewing subscription
 * (plan switches, admin cancels, expiries, earlier failed revokes). Runs daily
 * for everyone, and right after a plan change for one teacher.
 */
export async function revokeLeftoverMandates(teacherId?: number): Promise<number> {
  let query = db
    .selectFrom("teacherSubscriptions")
    .select("id")
    .where("mandateId", "is not", null)
    .where("mandateStatus", "in", LIVE_MANDATE_STATUSES)
    .where((eb) =>
      eb.or([
        eb("status", "!=", "active"),
        eb("autoRenew", "=", false),
        eb("autoRenew", "is", null),
        eb("mandateStatus", "=", "cancel_pending"),
      ])
    );
  if (teacherId !== undefined) {
    query = query.where("teacherId", "=", teacherId);
  }
  const rows = await query.execute();

  for (const row of rows) {
    try {
      await revokeSubscriptionMandate(row.id);
    } catch (err) {
      console.error(`[teacherMandate] Revoking the mandate of subscription ${row.id} failed:`, err);
    }
  }
  return rows.length;
}

/**
 * Re-reads a mandate from PayU before a renewal. One the payer ended outside
 * Testkart stops auto-renewal, so the plan runs out on its end date; a paused
 * one skips renewal until it is resumed. True when the renewal can go ahead.
 */
export async function refreshMandateBeforeRenewal(sub: {
  id: number;
  mandateId: string;
  mandateStatus: string | null;
  mandatePaymentMode: string | null;
}): Promise<boolean> {
  const state = await mandateStateAtPayU(sub.mandateId, sub.mandatePaymentMode);
  if (state === null) return sub.mandateStatus === "active";

  if (state === "ended") {
    await db
      .updateTable("teacherSubscriptions")
      .set({ mandateStatus: "cancelled", autoRenew: false, updatedAt: new Date() })
      .where("id", "=", sub.id)
      .execute();
    console.warn(`[teacherMandate] Mandate ${sub.mandateId} ended at PayU; subscription ${sub.id} will not renew`);
    return false;
  }
  if (state !== sub.mandateStatus) {
    await db
      .updateTable("teacherSubscriptions")
      .set({ mandateStatus: state, updatedAt: new Date() })
      .where("id", "=", sub.id)
      .execute();
  }
  return state === "active";
}
