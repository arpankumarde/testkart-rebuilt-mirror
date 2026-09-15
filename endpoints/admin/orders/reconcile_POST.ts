import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { verifyPayUPayment } from "../../../helpers/verifyPayUPayment";
import { ensureOrderCompletionSideEffects } from "../../../helpers/ensureOrderCompletionSideEffects";
import { schema, OutputType } from "./reconcile_POST.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { type OrderStatus } from "../../../helpers/schema";

export async function handle(request: Request) {
  try {
    // 1. Verify admin authentication
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    // 2. Parse and validate input
    const json = superjson.parse(await request.text());
    const { orderId } = schema.parse(json);

    // 3. Fetch the order to perform initial checks
    const order = await db
      .selectFrom("orders")
      .select(["id", "status", "paymentTransactionId", "userId"])
      .where("id", "=", orderId)
      .executeTakeFirst();

    if (!order) {
      return new Response(
        superjson.stringify({
          success: false,
          message: "Order not found",
          order: null,
        } satisfies OutputType),
        { status: 404 }
      );
    }
    if (order.status === "completed" || order.status === "refunded") {
      return new Response(
        superjson.stringify({
          success: false,
          message: `Order is already ${order.status}`,
          order: {
            id: order.id,
            previousStatus: order.status,
            newStatus: order.status,
          },
        } satisfies OutputType),
        { status: 400 }
      );
    }

    if (!order.paymentTransactionId) {
      return new Response(
        superjson.stringify({
          success: false,
          message: "Order does not have a payment transaction ID",
          order: null,
        } satisfies OutputType),
        { status: 400 }
      );
    }

    // 4. Call verifyPayUPayment helper
    const verificationResult = await verifyPayUPayment(order.paymentTransactionId);

    if (!verificationResult.success && verificationResult.status !== "failure") {
      // Technical error or not found (but not explicitly failed payment)
      return new Response(
        superjson.stringify({
          success: false,
          message: `Payment verification failed: ${verificationResult.error || verificationResult.status}`,
          order: {
            id: order.id,
            previousStatus: order.status,
            newStatus: order.status,
          },
          verificationDetails: verificationResult,
        } satisfies OutputType),
        { status: 400 }
      );
    }
        let finalStatus = "pending" as OrderStatus;
    let updated = false;
    let previousStatus: OrderStatus = order.status;

    // 5. Database transaction with row-level locking
    await db.transaction().execute(async (trx) => {
      // Lock the order row
      const lockedOrder = await trx
        .selectFrom("orders")
        .select(["status", "userId"])
        .where("id", "=", orderId)
        .forUpdate()
        .executeTakeFirst();
      // Re-check status inside transaction. "refunded" is also terminal —
      // don't let a stale PayU response flip a refunded order back to
      // completed/failed.
      if (!lockedOrder || lockedOrder.status === "completed" || lockedOrder.status === "refunded") {
        finalStatus = lockedOrder?.status || "pending";
        return; // Already processed by another request
      }

      previousStatus = lockedOrder.status;

      if (verificationResult.status === "success") {
        // Payment Successful
        await trx
          .updateTable("orders")
          .set({ status: "completed" })
          .where("id", "=", orderId)
          .execute();

        // Clear user's cart
        await trx
          .deleteFrom("cartItems")
          .where("userId", "=", lockedOrder.userId)
          .execute();

        // Increment studentsEnrolled for purchased mock tests
        // Note: We use a subquery to find relevant mock tests from orderItems
        await trx
          .updateTable("mockTests")
          .set({ studentsEnrolled: sql`students_enrolled + 1` })
          .where(
            "id",
            "in",
            trx
              .selectFrom("orderItems")
              .select("mockTestId")
              .where("orderId", "=", orderId)
              .where("mockTestId", "is not", null)
          )
          .execute();

        finalStatus = "completed";
        updated = true;
      } else if (verificationResult.status === "failure") {
        // Payment Failed
        await trx
          .updateTable("orders")
          .set({ status: "failed", ...verificationResult.failure })
          .where("id", "=", orderId)
          .execute();

        finalStatus = "failed";
        updated = true;
      }
      // If status is pending/other from PayU, we leave the order as pending
    });

    // 6. Handle side effects for completed orders
    if (updated && finalStatus === "completed") {
      try {
        await ensureOrderCompletionSideEffects(orderId);
      } catch (sideEffectsError) {
        console.error(`[ReconcileOrder] Order ${orderId} reconciled to completed, but side effects failed:`, sideEffectsError);
      }
    }

    // 7. Return response
    if (updated) {
      return new Response(
        superjson.stringify({
          success: true,
          message: `Order successfully reconciled to '${finalStatus}'`,
          order: {
            id: orderId,
            previousStatus: previousStatus,
            newStatus: finalStatus,
          },
          verificationDetails: verificationResult,
        } satisfies OutputType)
      );
    } else {
      return new Response(
        superjson.stringify({
          success: false,
          message: `Order status remained '${finalStatus}'. PayU status: ${verificationResult.status}`,
          order: {
            id: orderId,
            previousStatus: previousStatus,
            newStatus: finalStatus,
          },
          verificationDetails: verificationResult,
        } satisfies OutputType)
      );
    }
  } catch (error) {
    console.error("[ReconcileOrder] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}