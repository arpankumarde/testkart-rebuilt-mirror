import { Kysely, Transaction } from "kysely";
import { DB } from "./schema";

/**
 * When a teacher pays for a subscription with a wallet+PayU split
 * (see endpoints/teacher/subscription/wallet-subscribe_POST.ts), the wallet
 * portion is deducted immediately and marked "completed" while the PayU
 * portion is created as "pending". The teacher's available balance is a
 * derived value (helpers/getTeacherAvailableBalance.tsx) that subtracts any
 * "completed" wallet subscription payment — there's no separate wallet
 * ledger to credit back.
 *
 * If the PayU leg never completes — it fails, the teacher cancels the
 * popup, it's superseded by a retry, or it's given up on after sitting
 * unverifiable for too long — the wallet leg must be reversed. Otherwise the
 * teacher's balance stays deducted for a subscription they never received.
 *
 * This finds the wallet transaction linked to a given PayU subscription
 * transaction (via the `notes` field set at creation time) and marks it
 * "refunded" so it no longer counts against the available balance. Safe to
 * call even if there's no linked wallet leg (e.g. a full-PayU payment with
 * no wallet split) — it's then a no-op.
 */
export async function refundOrphanedWalletSubscriptionPayment(
  trx: Transaction<DB> | Kysely<DB>,
  teacherId: number,
  payuTransactionId: string
): Promise<void> {
  const walletLeg = await trx
    .selectFrom("subscriptionTransactions")
    .select("id")
    .where("teacherId", "=", teacherId)
    .where("paymentMethod", "=", "wallet")
    .where("status", "=", "completed")
    .where("notes", "=", `Partial wallet payment mapped to PayU Txn: ${payuTransactionId}`)
    .executeTakeFirst();

  if (walletLeg) {
    await trx
      .updateTable("subscriptionTransactions")
      .set({ status: "refunded" })
      .where("id", "=", walletLeg.id)
      .execute();
    console.log(`[SubscriptionWalletRefund] Refunded wallet transaction ${walletLeg.id} linked to failed/abandoned PayU txn ${payuTransactionId}`);
  }
}
