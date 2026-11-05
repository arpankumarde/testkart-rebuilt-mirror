import { db } from "./db";
import { readVisitorContext } from "./readVisitorContext";

/**
 * Writes one row to funnel_events, the autopilot's raw event log. Best effort:
 * it never throws, so tracking can never break a login or a payment. It uses
 * the global db connection, and the pool has one connection, so call it only
 * after any transaction has committed, never inside one. Always await it
 * (Floot refuses work started after the handler returns).
 */

export type FunnelEventName =
  | "add_to_cart_click"
  | "login_wall_shown"
  | "offer_shown"
  | "exit_intent_shown"
  | "otp_sent"
  | "otp_verified"
  | "signup"
  | "login"
  | "cart_add"
  | "checkout_started"
  | "free_claimed"
  | "payment_succeeded"
  | "payment_failed"
  | "attempt_started"
  | "attempt_completed"
  | "result_viewed"
  | "unsubscribed"
  | "message_clicked"
  | "message_prefetched"
  | "pay_link_created"
  | "pay_link_opened"
  | "guest_cart_merged";

export type FunnelEventInput = {
  event: FunnelEventName;
  request?: Request | null;
  userId?: number | null;
  visitorId?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  orderId?: number | null;
  amount?: number | string | null;
  messageId?: string | number | null;
  intentId?: string | number | null;
  props?: Record<string, string | number | boolean | null> | null;
};

export async function recordFunnelEvent(input: FunnelEventInput): Promise<void> {
  try {
    const context = input.request ? readVisitorContext(input.request) : null;
    const touch = context?.lastTouch ?? context?.firstTouch ?? null;
    await db
      .insertInto("funnelEvents")
      .values({
        event: input.event,
        visitorId: input.visitorId ?? context?.visitorId ?? null,
        userId: input.userId ?? null,
        platform: context?.platform ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        orderId: input.orderId ?? null,
        amount: input.amount === null || input.amount === undefined ? null : String(input.amount),
        source: touch?.source ?? (context ? "direct" : null),
        utmSource: touch?.utmSource ?? null,
        utmMedium: touch?.utmMedium ?? null,
        utmCampaign: touch?.utmCampaign ?? null,
        referrerHost: touch?.referrerHost ?? null,
        messageId: input.messageId ?? context?.messageId ?? null,
        intentId: input.intentId ?? null,
        props: input.props ?? null,
      })
      .execute();
  } catch (error) {
    console.error(`Funnel event ${input.event} was not recorded:`, error);
  }
}