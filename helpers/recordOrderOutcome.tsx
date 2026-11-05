import { db } from "./db";

/**
 * Records payment_succeeded or payment_failed for an order in funnel_events,
 * at most once per order and outcome, taking the visitor, source and message
 * from the order's own attribution columns. Orders are the source of truth:
 * helpers/ensureOrderCompletionSideEffects calls this on every completion path,
 * and the autopilotAttribution job backfills anything missed (marked
 * backfilled) and every failure. Never throws; call it outside transactions.
 */
export async function recordOrderOutcome(
  orderId: number,
  event: "payment_succeeded" | "payment_failed",
  options: { backfilled?: boolean } = {}
): Promise<void> {
  try {
    const existing = await db
      .selectFrom("funnelEvents")
      .select("id")
      .where("orderId", "=", orderId)
      .where("event", "=", event)
      .executeTakeFirst();
    if (existing) return;

    const order = await db
      .selectFrom("orders")
      .select([
        "userId",
        "visitorId",
        "totalAmount",
        "bundleId",
        "paymentMethod",
        "paymentErrorCode",
        "firstTouchSource",
        "lastTouchSource",
        "lastTouchCampaign",
        "attributedMessageId",
        "attributedIntentId",
        "clientSource",
      ])
      .where("id", "=", orderId)
      .executeTakeFirst();
    if (!order) return;

    const platform =
      order.clientSource === "android_app" ? "android" : order.clientSource === "ios_app" ? "ios" : order.clientSource === "web" ? "web" : null;

    await db
      .insertInto("funnelEvents")
      .values({
        event,
        userId: order.userId,
        visitorId: order.visitorId,
        platform,
        orderId,
        entityType: order.bundleId ? "bundle" : null,
        entityId: order.bundleId,
        amount: order.totalAmount,
        source: order.lastTouchSource ?? order.firstTouchSource,
        utmCampaign: order.lastTouchCampaign,
        messageId: order.attributedMessageId,
        intentId: order.attributedIntentId,
        props: {
          method: order.paymentMethod,
          ...(event === "payment_failed" && order.paymentErrorCode ? { errorCode: order.paymentErrorCode } : {}),
          ...(options.backfilled ? { backfilled: true } : {}),
        },
      })
      .execute();
  } catch (error) {
    console.error(`Could not record ${event} for order ${orderId}:`, error);
  }
}