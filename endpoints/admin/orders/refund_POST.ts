import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./refund_POST.schema";
import superjson from "superjson";
import { syncMockTestStudentsEnrolled } from "../../../helpers/enrollmentCounters";

export async function handle(request: Request) {
  try {
    // 1. Verify admin authentication
    await getAdminServerSessionOrThrow(request);

    // 2. Parse and validate input
    const json = superjson.parse(await request.text());
    const { orderId, reason } = schema.parse(json);

    // 3. Fetch the order to perform initial checks
    const order = await db
      .selectFrom("orders")
      .select(["id", "status"])
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

    if (order.status !== "completed") {
      return new Response(
        superjson.stringify({
          success: false,
          message: `Only completed orders can be refunded. Current status is '${order.status}'`,
          order: {
            id: order.id,
            previousStatus: order.status,
            newStatus: order.status,
          },
        } satisfies OutputType),
        { status: 400 }
      );
    }

    let updated = false;

    // 4. Database transaction with row-level locking
    await db.transaction().execute(async (trx) => {
      // Lock the order row
      const lockedOrder = await trx
        .selectFrom("orders")
        .select(["status", "userId"])
        .where("id", "=", orderId)
        .forUpdate()
        .executeTakeFirst();

      // Re-check status inside transaction to prevent race conditions
      if (!lockedOrder || lockedOrder.status !== "completed") {
        return; 
      }

      // Update the order status to refunded
      await trx
        .updateTable("orders")
        .set({ status: "refunded" })
        .where("id", "=", orderId)
        .execute();

      // Re-sync studentsEnrolled for the refunded packages rather than
      // decrementing it.
      //
      // The old code did `GREATEST(students_enrolled - 1, 0)` while leaving
      // mockTestEnrollments alone, so every refund pushed the counter one
      // BELOW the number of rows that still grant access — the package kept
      // its student and lost a unit of its count. Recomputing makes the
      // counter state what is actually true.
      //
      // Note this deliberately does NOT revoke access: the enrollment row
      // survives a refund today, so a refunded student still has the package.
      // Whether that should change is a product decision, not a counter one.
      // See helpers/enrollmentCounters.tsx.
      const refundedItems = await trx
        .selectFrom("orderItems")
        .select("mockTestId")
        .where("orderId", "=", orderId)
        .where("mockTestId", "is not", null)
        .execute();

      await syncMockTestStudentsEnrolled(
        refundedItems.map((item) => item.mockTestId!),
        trx
      );

      updated = true;
    });

    if (updated) {
      return new Response(
        superjson.stringify({
          success: true,
          message: `Order successfully refunded${reason ? ` (Reason: ${reason})` : ""}`,
          order: {
            id: orderId,
            previousStatus: order.status,
            newStatus: "refunded",
          },
        } satisfies OutputType)
      );
    } else {
      return new Response(
        superjson.stringify({
          success: false,
          message: `Failed to refund the order. It might have been altered concurrently.`,
          order: {
            id: orderId,
            previousStatus: order.status,
            newStatus: order.status,
          },
        } satisfies OutputType),
        { status: 409 }
      );
    }
  } catch (error) {
    console.error("[RefundOrder] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}