import { Transaction } from "kysely";
import { DB } from "./schema";
import { checkMandateStatus } from "./payuSIApi";

/**
 * Whether a successful autopay sign-up registered a PayU standing instruction.
 * The callback carries IsStandingInstructionSet; without that flag (for example
 * when reconciling through the verify API) PayU is asked directly, so a plain
 * one-time payment is never stored as a mandate.
 */
export async function isMandateRegistered(
  flag: unknown,
  mihpayid: string,
  mode: string | null | undefined
): Promise<boolean> {
  const value = String(flag ?? "").toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  if (!mihpayid) return false;
  const check = await checkMandateStatus(mihpayid, mode);
  return check.success && check.mandateStatus === "active";
}

export type PaidSubscriptionActivation = {
  transactionId: number;
  teacherId: number;
  planId: number;
  planPrice: string;
  durationDays: number;
  paymentMethod: "payu" | "payu_recurring";
  // Set only when PayU registered an autopay mandate for this payment.
  mandate: { mandateId: string; paymentMode: string | null } | null;
};

/**
 * Activates the paid plan for a PayU payment that succeeded: expires the
 * teacher's current active plan (the Free plan included; days left on the same
 * plan carry over), inserts the new one,
 * completes and links the transaction and verifies the teacher. Returns null
 * when the transaction is no longer pending, so a callback and a reconciliation
 * racing on the same payment create only one plan.
 */
export async function activatePaidSubscription(
  trx: Transaction<DB>,
  params: PaidSubscriptionActivation
): Promise<{ subscriptionId: number; startDate: Date; endDate: Date } | null> {
  const locked = await trx
    .selectFrom("subscriptionTransactions")
    .select("status")
    .where("id", "=", params.transactionId)
    .forUpdate()
    .executeTakeFirst();
  if (locked?.status !== "pending") {
    return null;
  }

  const current = await trx
    .selectFrom("teacherSubscriptions")
    .select(["planId", "endDate"])
    .where("teacherId", "=", params.teacherId)
    .where("status", "=", "active")
    .orderBy("createdAt", "desc")
    .executeTakeFirst();

  // Buying the plan the teacher already has (e.g. restarting autopay after
  // cancelling it) adds the new period after the days already paid for.
  const startDate = new Date();
  const periodStart =
    current?.planId === params.planId && current.endDate && new Date(current.endDate) > startDate
      ? new Date(current.endDate)
      : startDate;
  const endDate = new Date(periodStart);
  endDate.setDate(periodStart.getDate() + params.durationDays);

  await trx
    .updateTable("teacherSubscriptions")
    .set({ status: "expired", endDate: startDate, updatedAt: startDate })
    .where("teacherId", "=", params.teacherId)
    .where("status", "=", "active")
    .execute();

  const mandate = params.mandate;
  const mandateEndDate = new Date(startDate);
  mandateEndDate.setFullYear(mandateEndDate.getFullYear() + 5);

  const [newSubscription] = await trx
    .insertInto("teacherSubscriptions")
    .values({
      teacherId: params.teacherId,
      planId: params.planId,
      status: "active",
      startDate,
      endDate,
      paymentMethod: params.paymentMethod,
      autoRenew: params.paymentMethod === "payu" ? true : mandate !== null,
      ...(params.paymentMethod === "payu_recurring" ? { lastChargeDate: startDate } : {}),
      ...(mandate
        ? {
            mandateId: mandate.mandateId,
            mandateStatus: "active",
            mandateMaxAmount: params.planPrice,
            mandateStartDate: startDate,
            mandateEndDate,
            mandateFrequency: params.durationDays > 31 ? "YEARLY" : "MONTHLY",
            mandatePaymentMode: mandate.paymentMode,
            nextChargeDate: endDate,
          } as const
        : {}),
    })
    .returning("id")
    .execute();

  await trx
    .updateTable("subscriptionTransactions")
    .set({ subscriptionId: newSubscription.id, status: "completed" })
    .where("id", "=", params.transactionId)
    .execute();

  await trx
    .updateTable("users")
    .set({ isVerified: true })
    .where("id", "=", params.teacherId)
    .execute();

  return { subscriptionId: newSubscription.id, startDate, endDate };
}
