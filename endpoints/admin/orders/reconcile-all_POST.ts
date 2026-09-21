import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { verifyPayUPayment } from "../../../helpers/verifyPayUPayment";
import { ensureOrderCompletionSideEffects } from "../../../helpers/ensureOrderCompletionSideEffects";
import { schema, OutputType } from "./reconcile-all_POST.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { OrderStatus } from "../../../helpers/schema";

export async function handle(request: Request) {
  try {
    // 1. Verify admin authentication
    await getAdminServerSessionOrThrow(request);

    // 2. Parse and validate input (empty object)
        const text = await request.text();
    let json: unknown = {};
    if (text) {
      try {
        json = superjson.parse(text);
      } catch {
        json = JSON.parse(text);
      }
    }
    schema.parse(json ?? {});

    // 3. Fetch all pending orders with paymentTransactionId
    const pendingOrders = await db
      .selectFrom("orders")
      .select(["id", "status", "paymentTransactionId", "userId"])
      .where("status", "=", "pending")
      .where("paymentTransactionId", "is not", null)
      .execute();

    const summary: OutputType = {
      success: true,
      totalPending: pendingOrders.length,
      reconciled: 0,
      markedFailed: 0,
      stillPending: 0,
      errors: 0,
      details: [],
    };

    // 4. Process each order sequentially
    for (const order of pendingOrders) {
      if (!order.paymentTransactionId) continue;

      try {
        const verificationResult = await verifyPayUPayment(order.paymentTransactionId);

                let finalStatus = "pending" as OrderStatus;
        let message = "";
        let requiresSideEffects = false;

        if (!verificationResult.success && verificationResult.status !== "failure") {
          summary.errors++;
          summary.details.push({
            orderId: order.id,
            previousStatus: order.status,
            newStatus: order.status,
            message: `Verification error: ${verificationResult.error || verificationResult.status}`,
          });
          continue;
        }

        // Database transaction with row-level locking
        await db.transaction().execute(async (trx) => {
          const lockedOrder = await trx
            .selectFrom("orders")
            .select(["status", "userId"])
            .where("id", "=", order.id)
            .forUpdate()
            .executeTakeFirst();

          if (!lockedOrder || lockedOrder.status !== "pending") {
            finalStatus = lockedOrder?.status || "pending";
            message = "Order no longer pending when locked";
            return;
          }

          if (verificationResult.status === "success") {
            // Payment Successful
            await trx
              .updateTable("orders")
              .set({ status: "completed" })
              .where("id", "=", order.id)
              .execute();

            // Clear user's cart
            await trx
              .deleteFrom("cartItems")
              .where("userId", "=", lockedOrder.userId)
              .execute();

            // Increment studentsEnrolled for purchased mock tests
            await trx
              .updateTable("mockTests")
              .set({ studentsEnrolled: sql`students_enrolled + 1` })
              .where(
                "id",
                "in",
                trx
                  .selectFrom("orderItems")
                  .select("mockTestId")
                  .where("orderId", "=", order.id)
                  .where("mockTestId", "is not", null)
              )
              .execute();

            finalStatus = "completed";
            message = "Successfully reconciled to completed";
            requiresSideEffects = true;
          } else if (verificationResult.status === "failure") {
            // Payment Failed
            await trx
              .updateTable("orders")
              .set({ status: "failed", ...verificationResult.failure })
              .where("id", "=", order.id)
              .execute();

            finalStatus = "failed";
            message = "Successfully reconciled to failed";
          } else {
            // Still pending in PayU
            finalStatus = "pending";
            message = "Remains pending in PayU";
          }
        });

        // Update counters based on the final status
        if (finalStatus === "completed") {
          summary.reconciled++;
        } else if (finalStatus === "failed") {
          summary.markedFailed++;
        } else if (finalStatus === "pending" && message !== "Order no longer pending when locked") {
          summary.stillPending++;
        }

        summary.details.push({
          orderId: order.id,
          previousStatus: order.status,
          newStatus: finalStatus,
          message,
        });

        // Trigger side effects outside of the database transaction
        if (requiresSideEffects) {
          await ensureOrderCompletionSideEffects(order.id);
        }

      } catch (orderError) {
        console.error(`[ReconcileAll] Error processing order ${order.id}:`, orderError);
        summary.errors++;
        summary.details.push({
          orderId: order.id,
          previousStatus: order.status,
          newStatus: order.status,
          message: `Internal error processing order: ${orderError instanceof Error ? orderError.message : "Unknown error"}`,
        });
      }
    }

    return new Response(superjson.stringify(summary satisfies OutputType));

  } catch (error) {
    console.error("[ReconcileAll] Global Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}