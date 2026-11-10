import { db } from "../../../helpers/db";
import { isValidCashfreeWebhookSignature } from "../../../helpers/cashfree";
import { DEAD_SUBSCRIPTION_STATUSES } from "../../../helpers/cashfreeSubscriptions";
import { settleLivePackageCheckout, settleLiveRenewal } from "../../../helpers/livePackages";
import { schema, OutputType } from "./subscription-webhook_POST.schema";

const reply = (body: string, status = 200) => new Response(body, { status });

/**
 * Cashfree subscription webhook for live class packages. Like the order webhook it is only a
 * nudge: the state is always re-read from Cashfree's API before anything changes.
 * Register https://testkart.in/_api/payment/cashfree/subscription-webhook under
 * Developers > Webhooks > Subscriptions, version 2026-01-01, in sandbox and production.
 */
export async function handle(request: Request) {
  try {
    const rawBody = await request.text();
    if (!isValidCashfreeWebhookSignature(rawBody, request.headers.get("x-webhook-timestamp"), request.headers.get("x-webhook-signature"))) {
      console.error("[Cashfree Subscription Webhook] Rejected a request with a bad signature.");
      return reply("Invalid signature", 401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return reply("OK");
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return reply("OK");

    const { type, data } = parsed.data;
    const subscriptionId = data.subscription_id ?? data.subscription_details?.subscription_id;
    if (!subscriptionId) return reply("OK");

    const mandate = await db
      .selectFrom("liveMandates")
      .select(["id", "packageId", "status"])
      .where("subscriptionId", "=", subscriptionId)
      .executeTakeFirst();
    if (!mandate) {
      console.error(`[Cashfree Subscription Webhook] No mandate for ${subscriptionId} (${type})`);
      return reply("OK");
    }

    const status = data.subscription_details?.subscription_status;
    if (mandate.status === "active" && status && DEAD_SUBSCRIPTION_STATUSES.includes(status)) {
      // The student revoked autopay from their bank or UPI app: no renewal can be debited now.
      await db
        .updateTable("liveMandates")
        .set({ status: "cancelled", gatewayStatus: status, cancelledAt: new Date(), updatedAt: new Date() })
        .where("id", "=", mandate.id)
        .execute();
      await db.updateTable("livePackages").set({ autoRenew: false, updatedAt: new Date() }).where("id", "=", mandate.packageId).execute();
    }

    if (data.payment_id && (data.payment_type ?? "").toUpperCase() === "CHARGE") {
      const cycle = await db.selectFrom("livePackageCycles").select("id").where("paymentId", "=", data.payment_id).executeTakeFirst();
      if (cycle) await settleLiveRenewal(cycle.id);
    } else if (mandate.status === "initialized") {
      await settleLivePackageCheckout(mandate.packageId);
    }

    console.log(`[Cashfree Subscription Webhook] ${type} for ${subscriptionId}`);
    return reply(JSON.stringify({ received: true } satisfies OutputType));
  } catch (error) {
    console.error("[Cashfree Subscription Webhook] Failed:", error);
    return reply("Webhook handling failed", 500);
  }
}
