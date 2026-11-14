import { sql } from "kysely";
import { db } from "./db";
import { WAPLIFY_ENDPOINT } from "./_publicConfigs";

/**
 * How the autopilot reaches a person, in order of preference: the Testkart app
 * (a live push token), WhatsApp when the engine prefers it (a playbook's first
 * message, or an offer step with an approved offer template), email (a real
 * address that has not bounced or unsubscribed), and WhatsApp on other
 * messages for people with no usable email. WhatsApp consent is taken outside
 * the product (owner's decisions of 14-11-2026 and 15-11-2026): anyone with a
 * mobile number gets it unless a declined marketing_consents row or a STOP
 * reply blocks it. The opt-in dialog step was removed and every recorded
 * choice set to granted on 15-11-2026, so in practice only STOP blocks it,
 * plus Meta's own refusals: a number Meta called undeliverable (131026, not on
 * WhatsApp) is skipped for 90 days, one over Meta's per-person marketing limit
 * (131049) for a day and one in Meta's marketing experiment (130472) for a week.
 * Also the senders for push (Expo) and WhatsApp (Waplify) and Expo's delivery
 * receipts. Server-only; never throws from a send, it returns the failure.
 */

export type ChannelChoice =
  | { channel: "push"; tokens: string[] }
  | { channel: "whatsapp"; phone: string; template: string }
  | { channel: "email"; email: string };

type Row = Record<string, unknown>;

export async function chooseChannel(
  userId: number,
  whatsappTemplate: string | null,
  preferWhatsApp: boolean
): Promise<ChannelChoice | null> {
  const user = await db
    .selectFrom("users")
    .select(["email", "emailBouncedAt", "isActive", "mobileNumber"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!user || user.isActive === false) return null;

  const tokens = await db
    .selectFrom("pushTokens")
    .select("token")
    .where("userId", "=", userId)
    .where("disabledAt", "is", null)
    .orderBy("lastSeenAt", "desc")
    .limit(3)
    .execute();
  if (tokens.length > 0) return { channel: "push", tokens: tokens.map((t) => t.token) };

  let whatsapp: ChannelChoice | null = null;
  const mobile = (user.mobileNumber ?? "").replace(/\D/g, "").slice(-10);
  if (whatsappTemplate && /^[6-9]\d{9}$/.test(mobile)) {
    const declined = await sql<Row>`
      SELECT 1 FROM marketing_consents c WHERE c.user_id = ${userId} AND c.channel = 'whatsapp' AND c.granted = false
      UNION ALL
      SELECT 1 FROM email_unsubscribes u WHERE u.user_id = ${userId} AND u.list = 'whatsapp_marketing'
      UNION ALL
      SELECT 1 FROM message_events e JOIN rev_messages m ON m.id = e.message_id
      WHERE m.user_id = ${userId} AND e.provider = 'waplify' AND e.type = 'failed' AND (
        (e.raw->>'errorCode' = '131026' AND e.occurred_at > now() - interval '90 days')
        OR (e.raw->>'errorCode' = '131049' AND e.occurred_at > now() - interval '24 hours')
        OR (e.raw->>'errorCode' = '130472' AND e.occurred_at > now() - interval '7 days'))
    `.execute(db);
    if (declined.rows.length === 0) whatsapp = { channel: "whatsapp", phone: `91${mobile}`, template: whatsappTemplate };
  }
  if (whatsapp && preferWhatsApp) return whatsapp;

  const email = await emailFallback(userId);
  return email ?? whatsapp;
}

/** The email route for a user, used when WhatsApp fails (for example a template still waiting for Meta). */
export async function emailFallback(userId: number): Promise<{ channel: "email"; email: string } | null> {
  const user = await db.selectFrom("users").select(["email", "emailBouncedAt"]).where("id", "=", userId).executeTakeFirst();
  const email = user?.email?.trim();
  if (!email || user?.emailBouncedAt || /@mail\.testkart\.in$/i.test(email)) return null;
  const unsubscribed = await db
    .selectFrom("emailUnsubscribes")
    .select("userId")
    .where("userId", "=", userId)
    .where("list", "=", "student_marketing")
    .executeTakeFirst();
  return unsubscribed ? null : { channel: "email", email };
}

export type SendOutcome = { ok: true; providerId: string | null } | { ok: false; error: string };

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

type ExpoTicket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };

export async function sendPush(params: {
  tokens: string[];
  title: string;
  body: string;
  path: string;
  messageId: string;
}): Promise<SendOutcome> {
  try {
    const response = await fetch(EXPO_SEND_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(
        params.tokens.map((to) => ({
          to,
          title: params.title.slice(0, 65),
          body: params.body.length > 178 ? `${params.body.slice(0, 175)}...` : params.body,
          data: { url: params.path, mid: params.messageId },
          sound: "default",
          channelId: "default",
        }))
      ),
      signal: AbortSignal.timeout(10000),
    });
    const payload = (await response.json().catch(() => ({}))) as { data?: ExpoTicket[] };
    const tickets = payload.data ?? [];
    const dead = params.tokens.filter((_, index) => {
      const ticket = tickets[index];
      return ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered";
    });
    if (dead.length > 0) {
      await db
        .updateTable("pushTokens")
        .set({ disabledAt: new Date(), disabledReason: "DeviceNotRegistered" })
        .where("token", "in", dead)
        .execute();
    }
    const ok = tickets.find((ticket): ticket is { status: "ok"; id: string } => ticket.status === "ok");
    if (ok) return { ok: true, providerId: ok.id };
    const firstError = tickets.find((ticket) => ticket.status === "error") as { message?: string } | undefined;
    return { ok: false, error: firstError?.message ?? `Expo answered ${response.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Push failed" };
  }
}

export async function sendWhatsAppTemplate(params: {
  phone: string;
  template: string;
  name: string;
  variables: string[];
  linkCode: string;
  /** The image for a template with an image header; leave out for text-header templates. */
  mediaUrl?: string | null;
}): Promise<SendOutcome> {
  const apiKey = process.env.WAPLIFY_API_KEY;
  if (!apiKey) return { ok: false, error: "WAPLIFY_API_KEY is not set" };
  try {
    const response = await fetch(`${WAPLIFY_ENDPOINT}/api/v1/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        template_name: params.template,
        contact_phone: params.phone,
        contact_name: params.name,
        body_data: Object.fromEntries(params.variables.map((value, index) => [String(index + 1), value.slice(0, 200)])),
        url_button_data: params.linkCode,
        ...(params.mediaUrl ? { media_url: params.mediaUrl } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = (await response.json().catch(() => ({}))) as { message_id?: string; detail?: unknown; message?: string };
    if (!response.ok) {
      return { ok: false, error: `Waplify ${response.status}: ${JSON.stringify(payload.detail ?? payload.message ?? "").slice(0, 300)}` };
    }
    return { ok: true, providerId: payload.message_id ?? null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "WhatsApp send failed" };
  }
}

/**
 * A plain WhatsApp text, allowed only inside the 24 hours after the person last wrote to us
 * (a quick-reply tap counts), so it is used only to answer one. Quotes their message when given.
 */
export async function sendWhatsAppText(params: { phone: string; text: string; replyTo?: string | null }): Promise<SendOutcome> {
  const apiKey = process.env.WAPLIFY_API_KEY;
  if (!apiKey) return { ok: false, error: "WAPLIFY_API_KEY is not set" };
  try {
    const response = await fetch(`${WAPLIFY_ENDPOINT}/api/v1/messages/send-message`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_phone: params.phone,
        message_type: "text",
        message: params.text.slice(0, 4000),
        ...(params.replyTo && params.replyTo.startsWith("wamid.") ? { reply_to_message_id: params.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = (await response.json().catch(() => ({}))) as { message_id?: string; detail?: unknown; message?: string };
    if (!response.ok) {
      return { ok: false, error: `Waplify ${response.status}: ${JSON.stringify(payload.detail ?? payload.message ?? "").slice(0, 300)}` };
    }
    return { ok: true, providerId: payload.message_id ?? null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "WhatsApp text failed" };
  }
}

/** Asks Expo whether recent pushes reached the phone, and records delivered or failed. */
export async function collectPushReceipts(): Promise<void> {
  const pending = await db
    .selectFrom("revMessages")
    .select(["id", "providerMessageId"])
    .where("channel", "=", "push")
    .where("status", "=", "sent")
    .where("providerMessageId", "is not", null)
    .where("sentAt", "<", sql<Date>`now() - interval '15 minutes'`)
    .where("sentAt", ">", sql<Date>`now() - interval '24 hours'`)
    .limit(300)
    .execute();
  if (pending.length === 0) return;
  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ids: pending.map((p) => p.providerMessageId) }),
    signal: AbortSignal.timeout(10000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: Record<string, { status: "ok" | "error"; message?: string; details?: { error?: string } }>;
  };
  for (const message of pending) {
    const receipt = payload.data?.[message.providerMessageId ?? ""];
    if (!receipt) continue;
    if (receipt.status === "ok") {
      await db.updateTable("revMessages").set({ status: "delivered", deliveredAt: new Date() }).where("id", "=", message.id).execute();
    } else {
      await db
        .updateTable("revMessages")
        .set({ status: "failed", error: (receipt.details?.error ?? receipt.message ?? "push failed").slice(0, 300) })
        .where("id", "=", message.id)
        .execute();
    }
  }
}