import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { settleCashfreeOrder } from "../../../helpers/cashfreeOrders";
import { schema, OutputType } from "./verify_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const { orderId } = schema.parse(json);

    const order = await db.selectFrom("orders").select(["id", "userId"]).where("id", "=", orderId).executeTakeFirst();
    if (!order || order.userId !== user.id) {
      return new Response(superjson.stringify({ error: "Order not found." }), { status: 404 });
    }

    const result = await settleCashfreeOrder(orderId);
    const output: OutputType = {
      success: true,
      orderStatus: result.orderStatus,
      orderId: result.orderId,
      message: result.message,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("[Cashfree Verify] Failed:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}
