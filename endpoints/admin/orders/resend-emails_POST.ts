import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { sendOrderConfirmationEmails } from "../../../helpers/sendOrderConfirmationEmails";
import { schema, OutputType } from "./resend-emails_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    // 1. Verify admin authentication
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    // 2. Parse and validate input
    const json = superjson.parse(await request.text());
    const { orderId } = schema.parse(json);

    // 3. Fetch the order
    const order = await db
      .selectFrom("orders")
      .select(["id", "status", "userId"])
      .where("id", "=", orderId)
      .executeTakeFirst();

    if (!order) {
      return new Response(
        superjson.stringify({ error: "Order not found" }),
        { status: 404 }
      );
    }

    if (order.status !== "completed") {
      return new Response(
        superjson.stringify({ error: `Cannot resend emails for order in status: ${order.status}` }),
        { status: 400 }
      );
    }

    // 4. Send emails
    // Await it to ensure any immediate errors are caught, though it's designed to not block the main flow heavily
    await sendOrderConfirmationEmails(order.id, order.userId);

    return new Response(
      superjson.stringify({
        success: true,
        message: "Order confirmation emails triggered successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[ResendOrderEmails] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}