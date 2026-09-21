import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./mark-failed_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    // 1. Verify admin authentication
    await getAdminServerSessionOrThrow(request);

    // 2. Parse and validate input
    const json = superjson.parse(await request.text());
    const { orderId } = schema.parse(json);

    // 3. Fetch the order to verify it exists and is pending
    const order = await db
      .selectFrom("orders")
      .select(["id", "status", "userId"])
      .where("id", "=", orderId)
      .executeTakeFirst();

    if (!order) {
      console.warn(`[MarkOrderFailed] Order not found: ${orderId}`);
      return new Response(
        superjson.stringify({
          success: false,
          message: "Order not found",
          order: null,
        } satisfies OutputType),
        { status: 404 }
      );
    }

    if (order.status !== "pending") {
      console.warn(
        `[MarkOrderFailed] Order ${orderId} is not pending (current status: ${order.status})`
      );
      return new Response(
        superjson.stringify({
          success: false,
          message: `Order is not in pending state (current status: ${order.status})`,
          order: {
            id: order.id,
            previousStatus: order.status,
            newStatus: order.status,
          },
        } satisfies OutputType),
        { status: 400 }
      );
    }

    // 4. Update order status to failed in a transaction
    await db.transaction().execute(async (trx) => {
      // Lock the order row to prevent race conditions
      const lockedOrder = await trx
        .selectFrom("orders")
        .select(["status"])
        .where("id", "=", orderId)
        .forUpdate()
        .executeTakeFirst();

      // Re-check status inside transaction
      if (!lockedOrder || lockedOrder.status !== "pending") {
        console.warn(
          `[MarkOrderFailed] Order ${orderId} status changed during transaction`
        );
        return;
      }

      // Update order status to failed
      await trx
        .updateTable("orders")
        .set({ status: "failed" })
        .where("id", "=", orderId)
        .execute();

      console.info(`[MarkOrderFailed] Order ${orderId} marked as failed`);
    });

    // 5. Return success response
    return new Response(
      superjson.stringify({
        success: true,
        message: `Order ${orderId} has been marked as failed`,
        order: {
          id: orderId,
          previousStatus: "pending",
          newStatus: "failed",
        },
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[MarkOrderFailed] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}