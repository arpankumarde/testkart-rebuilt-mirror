import { db } from "../../../helpers/db";
import { isValidCashfreeWebhookSignature } from "../../../helpers/cashfree";
import { settleCashfreeOrder } from "../../../helpers/cashfreeOrders";
import { schema, OutputType } from "./webhook_POST.schema";

const reply = (body: string, status = 200) => new Response(body, { status });

export async function handle(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-webhook-signature");
    const timestamp = request.headers.get("x-webhook-timestamp");

    if (!isValidCashfreeWebhookSignature(rawBody, timestamp, signature)) {
      console.error("[Cashfree Webhook] Rejected a request with a bad signature.");
      return reply("Invalid signature", 401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return reply("OK");
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      // Cashfree's dashboard test ping and unrelated event types carry no order; acknowledge so they are not retried.
      return reply("OK");
    }

    const cashfreeOrderId = parsed.data.data.order.order_id;
    const order = await db
      .selectFrom("orders")
      .select("id")
      .where("paymentTransactionId", "=", cashfreeOrderId)
      .where("paymentMethod", "=", "cashfree")
      .executeTakeFirst();

    if (!order) {
      console.error(`[Cashfree Webhook] No order for Cashfree order ${cashfreeOrderId}`);
      return reply("OK");
    }

    const result = await settleCashfreeOrder(order.id);
    console.log(`[Cashfree Webhook] ${parsed.data.type} for order ${order.id}: ${result.orderStatus}`);
    return reply(JSON.stringify({ received: true } satisfies OutputType));
  } catch (error) {
    console.error("[Cashfree Webhook] Failed:", error);
    return reply("Webhook handling failed", 500);
  }
}
