import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { verifyPayUPayment } from "../../../helpers/verifyPayUPayment";
import { ensureOrderCompletionSideEffects } from "../../../helpers/ensureOrderCompletionSideEffects";
import { activateTeacherSubscription } from "../../../helpers/activateTeacherSubscription";
import { refundOrphanedWalletSubscriptionPayment } from "../../../helpers/refundOrphanedWalletSubscriptionPayment";
import { OutputType } from "./verify-pending_POST.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { PAYU_NOT_FOUND_STATUS } from "../../../helpers/extractPayUFailure";

const PENDING_ORDER_AGE_MINUTES = 5;
// If PayU still can't resolve a transaction after this long, stop retrying and
// mark it failed instead of leaving it "pending" forever. Without this, a
// single permanently-unverifiable transaction (e.g. an abandoned subscription
// mandate) gets re-checked against PayU's API on every poll, indefinitely.
const GIVE_UP_AFTER_HOURS = 24;

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const fiveMinutesAgo = new Date(
      Date.now() - PENDING_ORDER_AGE_MINUTES * 60 * 1000
    );

    const pendingOrders = await db
      .selectFrom("orders")
      .select(["id", "paymentTransactionId", "createdAt"])
      .where("userId", "=", user.id)
      .where("status", "=", "pending")
      .where("createdAt", "<", fiveMinutesAgo)
      .where("paymentTransactionId", "is not", null)
      .execute();

    const giveUpThreshold = new Date(Date.now() - GIVE_UP_AFTER_HOURS * 60 * 60 * 1000);

    const updatedOrders: OutputType["updatedOrders"] = [];

    if (pendingOrders.length > 0) {
      for (const order of pendingOrders) {
        if (!order.paymentTransactionId) continue;

        // Skip sponsor payment orders — they are finalized by sponsor-callback_POST which
        // handles the full completion flow (orderItems, teacherSponsoredEnrollments, studentsEnrolled).
        // Auto-failing them here would corrupt sponsor flows.
        if (order.paymentTransactionId.startsWith("sponsor-")) {
          console.log(`[VerifyPending] Skipping sponsor payment order ${order.id} (txnid: ${order.paymentTransactionId})`);
          continue;
        }

        const verificationResult = await verifyPayUPayment(order.paymentTransactionId);

        if (!verificationResult.success) {
          // API error, timeout, not-found, or config error — we cannot determine the true status.
          if (order.createdAt && order.createdAt < giveUpThreshold) {
            // Been unverifiable for too long — stop retrying it forever and mark it failed.
            await db.transaction().execute(async (trx) => {
              const lockedOrder = await trx
                .selectFrom("orders")
                .select("status")
                .where("id", "=", order.id)
                .forUpdate()
                .executeTakeFirst();

              if (lockedOrder?.status === "pending") {
                await trx
                  .updateTable("orders")
                  .set(
                    verificationResult.status === "not_found"
                      ? { status: "failed", paymentGatewayStatus: PAYU_NOT_FOUND_STATUS }
                      : { status: "failed" }
                  )
                  .where("id", "=", order.id)
                  .execute();

                updatedOrders.push({
                  orderId: order.id,
                  previousStatus: "pending",
                  newStatus: "failed",
                });
              }
            });
            console.warn(`[VerifyPending] Giving up on txnid ${order.paymentTransactionId} (order ${order.id}) after ${GIVE_UP_AFTER_HOURS}h of failed verification attempts. Marked failed.`);
          } else {
            // Still within the retry window — leave the order as "pending" so a future check can retry once PayU is reachable.
            console.warn(`[VerifyPending] Could not verify txnid ${order.paymentTransactionId} (order ${order.id}): ${verificationResult.error}. Leaving as pending.`);
          }
          continue;
        }

        if (verificationResult.status === "success") {
          await db.transaction().execute(async (trx) => {
            // Lock the order row to prevent race conditions with the callback
            const lockedOrder = await trx
              .selectFrom("orders")
              .select("status")
              .where("id", "=", order.id)
              .forUpdate()
              .executeTakeFirst();

            // Check if the order is still pending before updating
            if (lockedOrder?.status === "pending") {
              await trx
                .updateTable("orders")
                .set({ status: "completed" })
                .where("id", "=", order.id)
                .execute();

              await trx
                .deleteFrom("cartItems")
                .where("userId", "=", user.id)
                .execute();

              await trx
                .updateTable("mockTests")
                .set({ studentsEnrolled: sql`students_enrolled + 1` })
                .where("id", "in", 
                  trx.selectFrom("orderItems")
                    .select("mockTestId")
                    .where("orderId", "=", order.id)
                )
                .execute();
              
              updatedOrders.push({
                orderId: order.id,
                previousStatus: "pending",
                newStatus: "completed",
              });
            }
          });

                    // After the transaction completes, ensure all enrollment records exist
          await ensureOrderCompletionSideEffects(order.id).catch((error) => {
            console.error(`[VerifyPending] Failed to ensure side effects for order ${order.id}:`, error);
          });

        } else if (verificationResult.status === "failure") {
          await db.transaction().execute(async (trx) => {
            const lockedOrder = await trx
              .selectFrom("orders")
              .select("status")
              .where("id", "=", order.id)
              .forUpdate()
              .executeTakeFirst();

            if (lockedOrder?.status === "pending") {
              await trx
                .updateTable("orders")
                .set({ status: "failed", ...verificationResult.failure })
                .where("id", "=", order.id)
                .execute();
              
              updatedOrders.push({
                orderId: order.id,
                previousStatus: "pending",
                newStatus: "failed",
              });
            }
          });
        }
      }
    }

    // IMPORTANT: scoped to the current user's own teacherId. This used to fetch
    // EVERY pending subscription transaction platform-wide, so a single
    // permanently-stuck mandate (PayU unable to fetch it) got re-verified via a
    // live external API call on every poll from every logged-in user, forever —
    // this was the dominant driver of a hosting cost spike (see incident on
    // 2026-08-06/07). Scoping to the owner keeps the blast radius to one user.
    const pendingSubscriptionTransactions = await db
      .selectFrom("subscriptionTransactions")
      .select(["id", "transactionId", "planId", "teacherId", "subscriptionId", "createdAt"])
      .where("status", "=", "pending")
      .where("createdAt", "<", fiveMinutesAgo)
      .where("teacherId", "=", user.id)
      .execute();

    const updatedSubscriptionTransactions: OutputType["updatedSubscriptionTransactions"] = [];

    if (pendingSubscriptionTransactions.length > 0) {
      for (const transaction of pendingSubscriptionTransactions) {
        if (!transaction.transactionId) {
          console.warn(`[VerifyPending] Skipping subscription transaction ${transaction.id} due to missing transactionId.`);
          continue;
        }

        const verificationResult = await verifyPayUPayment(transaction.transactionId);

        if (!verificationResult.success) {
          // API error, timeout, not-found, or config error — we cannot determine the true status.
          if (transaction.createdAt && transaction.createdAt < giveUpThreshold) {
            // Been unverifiable for too long — stop retrying it forever and mark it failed.
            await db.transaction().execute(async (trx) => {
              const lockedTransaction = await trx
                .selectFrom("subscriptionTransactions")
                .select("status")
                .where("id", "=", transaction.id)
                .forUpdate()
                .executeTakeFirst();

              if (lockedTransaction?.status === "pending") {
                await trx
                  .updateTable("subscriptionTransactions")
                  .set(
                    verificationResult.status === "not_found"
                      ? { status: "failed", paymentGatewayStatus: PAYU_NOT_FOUND_STATUS }
                      : { status: "failed" }
                  )
                  .where("id", "=", transaction.id)
                  .execute();

                // Refund the wallet leg if this was part of a wallet+PayU
                // split payment — the PayU leg never resolved, so the wallet
                // deduction shouldn't stick.
                if (transaction.transactionId) {
                  await refundOrphanedWalletSubscriptionPayment(trx, transaction.teacherId, transaction.transactionId);
                }

                updatedSubscriptionTransactions.push({
                  transactionId: transaction.id,
                  previousStatus: "pending",
                  newStatus: "failed",
                });
              }
            });
            console.warn(`[VerifyPending] Giving up on txnid ${transaction.transactionId} (subscription transaction ${transaction.id}) after ${GIVE_UP_AFTER_HOURS}h of failed verification attempts. Marked failed.`);
          } else {
            // Still within the retry window — leave the transaction as "pending" so a future check can retry once PayU is reachable.
            console.warn(`[VerifyPending] Could not verify txnid ${transaction.transactionId} (subscription transaction ${transaction.id}): ${verificationResult.error}. Leaving as pending.`);
          }
          continue;
        }

        if (verificationResult.status === "success") {
          await db.transaction().execute(async (trx) => {
            // Lock the transaction row to prevent race conditions
            const lockedTransaction = await trx
              .selectFrom("subscriptionTransactions")
              .select("status")
              .where("id", "=", transaction.id)
              .forUpdate()
              .executeTakeFirst();

            // Check if the transaction is still pending before updating
            if (lockedTransaction?.status === "pending") {
              await trx
                .updateTable("subscriptionTransactions")
                .set({ status: "completed" })
                .where("id", "=", transaction.id)
                .execute();

              // Create subscription and verify teacher if not already done
              await activateTeacherSubscription(transaction.teacherId, transaction.planId, trx);
              
              updatedSubscriptionTransactions.push({
                transactionId: transaction.id,
                previousStatus: "pending",
                newStatus: "completed",
              });
            }
          });
        } else if (verificationResult.status === "failure") {
          await db.transaction().execute(async (trx) => {
            const lockedTransaction = await trx
              .selectFrom("subscriptionTransactions")
              .select("status")
              .where("id", "=", transaction.id)
              .forUpdate()
              .executeTakeFirst();

            if (lockedTransaction?.status === "pending") {
              await trx
                .updateTable("subscriptionTransactions")
                .set({ status: "failed", ...verificationResult.failure })
                .where("id", "=", transaction.id)
                .execute();

              // Refund the wallet leg if this was part of a wallet+PayU
              // split payment — the PayU leg failed, so the wallet deduction
              // shouldn't stick.
              if (transaction.transactionId) {
                await refundOrphanedWalletSubscriptionPayment(trx, transaction.teacherId, transaction.transactionId);
              }

              updatedSubscriptionTransactions.push({
                transactionId: transaction.id,
                previousStatus: "pending",
                newStatus: "failed",
              });
            }
          });
        }
        // If status is "pending" or anything else, leave as is
      }
    }

    const responsePayload: OutputType = {
      verifiedCount: pendingOrders.length,
      updatedOrders,
      verifiedSubscriptionTransactionsCount: pendingSubscriptionTransactions.length,
      updatedSubscriptionTransactions,
    };

    if (updatedOrders.length > 0 || updatedSubscriptionTransactions.length > 0) {
      console.log(`[VerifyPending] Updated ${updatedOrders.length} orders and ${updatedSubscriptionTransactions.length} subscriptions for user ${user.id}`);
    }

    return new Response(superjson.stringify(responsePayload));
  } catch (error) {
    console.error("[VerifyPending] Endpoint failed:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 401,
      });
    }
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return new Response(
      superjson.stringify({
        error: "Failed to verify pending payments.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}