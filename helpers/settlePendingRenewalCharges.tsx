import { db } from "./db";
import { verifyPayUPayment } from "./verifyPayUPayment";
import { extendRenewedSubscription } from "./activateTeacherSubscription";
import { PAYU_NOT_FOUND_STATUS } from "./extractPayUFailure";
import { sendEmail } from "./sendEmail";
import { subscriptionRenewed, subscriptionPaymentFailed } from "./emailTemplates";
import { CHARGE_TXNID_PATTERNS } from "./teacherMandate";

const SETTLE_AFTER_MINUTES = 30;
const GIVE_UP_AFTER_HOURS = 24;

/**
 * Settles autopay renewal charges that PayU left pending, using PayU's own
 * records, so a charge resolves on the next daily run instead of waiting for
 * the teacher to sign in. verify-pending does the same for a signed-in teacher;
 * both lock the transaction row, so each charge settles once.
 */
export async function settlePendingRenewalCharges(now: Date = new Date()) {
  const counts = { checked: 0, completed: 0, failed: 0, stillPending: 0 };
  const giveUpBefore = new Date(now.getTime() - GIVE_UP_AFTER_HOURS * 60 * 60 * 1000);

  const pendingCharges = await db
    .selectFrom("subscriptionTransactions")
    .innerJoin("subscriptionPlans", "subscriptionPlans.id", "subscriptionTransactions.planId")
    .innerJoin("users", "users.id", "subscriptionTransactions.teacherId")
    .select([
      "subscriptionTransactions.id",
      "subscriptionTransactions.transactionId",
      "subscriptionTransactions.teacherId",
      "subscriptionTransactions.subscriptionId",
      "subscriptionTransactions.amount",
      "subscriptionTransactions.createdAt",
      "subscriptionPlans.name as planName",
      "users.email",
      "users.displayName",
    ])
    .where("subscriptionTransactions.status", "=", "pending")
    .where("subscriptionTransactions.paymentMethod", "=", "payu_recurring")
    .where("subscriptionTransactions.subscriptionId", "is not", null)
    .where((eb) =>
      eb.or(CHARGE_TXNID_PATTERNS.map((pattern) => eb("subscriptionTransactions.transactionId", "like", pattern)))
    )
    .where("subscriptionTransactions.createdAt", "<", new Date(now.getTime() - SETTLE_AFTER_MINUTES * 60 * 1000))
    .execute();

  for (const charge of pendingCharges) {
    if (!charge.transactionId || !charge.subscriptionId) continue;
    counts.checked++;

    const result = await verifyPayUPayment(charge.transactionId);
    let outcome: "completed" | "failed" | null = null;
    if (result.success && result.status === "success") {
      outcome = "completed";
    } else if (result.success && result.status === "failure") {
      outcome = "failed";
    } else if (!result.success && charge.createdAt && charge.createdAt < giveUpBefore) {
      outcome = "failed";
    }

    if (!outcome) {
      counts.stillPending++;
      continue;
    }

    const subscriptionId = charge.subscriptionId;
    const applied = await db.transaction().execute(async (trx) => {
      const locked = await trx
        .selectFrom("subscriptionTransactions")
        .select("status")
        .where("id", "=", charge.id)
        .forUpdate()
        .executeTakeFirst();
      if (locked?.status !== "pending") return false;

      if (outcome === "completed") {
        await trx
          .updateTable("subscriptionTransactions")
          .set({ status: "completed" })
          .where("id", "=", charge.id)
          .execute();
        await extendRenewedSubscription(subscriptionId, charge.teacherId, trx);
      } else {
        await trx
          .updateTable("subscriptionTransactions")
          .set(
            result.success
              ? { status: "failed", ...result.failure }
              : result.status === "not_found"
                ? { status: "failed", paymentGatewayStatus: PAYU_NOT_FOUND_STATUS }
                : { status: "failed" }
          )
          .where("id", "=", charge.id)
          .execute();
      }
      return true;
    });

    if (!applied) continue;

    if (outcome === "completed") {
      counts.completed++;
      const renewed = await db
        .selectFrom("teacherSubscriptions")
        .select("endDate")
        .where("id", "=", subscriptionId)
        .executeTakeFirst();
      if (charge.email && renewed?.endDate) {
        await sendEmail({
          to: charge.email,
          ...subscriptionRenewed(charge.displayName, charge.planName, Number(charge.amount), new Date(renewed.endDate)),
        }).catch((err) => console.error(`[settlePendingRenewalCharges] Renewal email failed for ${charge.transactionId}:`, err));
      }
    } else {
      counts.failed++;
      if (charge.email) {
        await sendEmail({
          to: charge.email,
          ...subscriptionPaymentFailed(charge.displayName, charge.planName, Number(charge.amount)),
        }).catch((err) => console.error(`[settlePendingRenewalCharges] Failure email failed for ${charge.transactionId}:`, err));
      }
    }
  }

  return counts;
}
