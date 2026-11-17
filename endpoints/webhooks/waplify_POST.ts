import { sql } from "kysely";
import { db } from "../../helpers/db";
import { allAccounts } from "../../helpers/allAccounts";
import { verifyWaplifySignature } from "../../helpers/verifyWaplifySignature";
import { handleQuickReply } from "../../helpers/autopilotQuickReplies";
import { schema } from "./waplify_POST.schema";

export const flootPreviewPublic = true;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === "object" ? (value as Obj) : {});
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

const STOP_WORDS = /^(stop|stop all|unsubscribe|cancel|end|quit|band karo|बंद|बंद करो)$/i;

const WHATSAPP_OPT_OUT_LIST = "whatsapp_marketing";

function when(value: unknown): Date {
  const raw = str(value);
  if (!raw) return new Date();
  const parsed = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** Testkart users with this WhatsApp number (Waplify sends 91XXXXXXXXXX; users store 10 digits). */
async function usersForPhone(phone: string | null): Promise<number[]> {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return [];
  const rows = await db.selectFrom(allAccounts(db).as("users")).select("id").where("mobileNumber", "=", digits.slice(-10)).execute();
  return rows.map((row) => row.id);
}

async function findMessage(providerMessageId: string | null) {
  if (!providerMessageId) return undefined;
  return db
    .selectFrom("revMessages")
    .select(["id", "userId"])
    .where("providerMessageId", "=", providerMessageId)
    .where("channel", "=", "whatsapp")
    .executeTakeFirst();
}

/** Stores an event once per key; false when it was already stored (a Waplify retry). */
type Raw = Record<string, string | number | boolean | null>;

async function storeEvent(key: string, type: string, messageId: string | null, at: Date, raw: Raw): Promise<string | null> {
  const inserted = await db
    .insertInto("messageEvents")
    .values({ messageId, provider: "waplify", type, providerEventId: `waplify:${key}`, occurredAt: at, raw })
    .onConflict((oc) => oc.column("providerEventId").doNothing())
    .returning("id")
    .executeTakeFirst();
  return inserted?.id ?? null;
}

async function handleStatus(event: string, message: Obj, at: Date): Promise<void> {
  const providerId = str(message.message_id);
  if (!providerId) return;
  const type = event.replace(/^message\./, "");
  const ledger = await findMessage(providerId);
  const stored = await storeEvent(`${providerId}:${event}`, type, ledger?.id ?? null, at, {
    event,
    providerMessageId: providerId,
    status: str(message.status),
    errorCode: typeof message.error_code === "number" ? message.error_code : null,
  });
  if (!stored || !ledger) return;

  const id = ledger.id;
  if (event === "message.sent") {
    await db.updateTable("revMessages").set({ sentAt: sql`coalesce(sent_at, ${at})` }).where("id", "=", id).execute();
    await db.updateTable("revMessages").set({ status: "sent" }).where("id", "=", id).where("status", "=", "queued").execute();
  } else if (event === "message.delivered") {
    await db
      .updateTable("revMessages")
      .set({ status: "delivered", deliveredAt: sql`coalesce(delivered_at, ${at})` })
      .where("id", "=", id)
      .where("status", "in", ["queued", "sent", "delivered"])
      .execute();
  } else if (event === "message.read") {
    await db
      .updateTable("revMessages")
      .set({ readAt: sql`coalesce(read_at, ${at})`, deliveredAt: sql`coalesce(delivered_at, ${at})` })
      .where("id", "=", id)
      .execute();
    await db.updateTable("revMessages").set({ status: "delivered" }).where("id", "=", id).where("status", "in", ["queued", "sent"]).execute();
  } else if (event === "message.failed") {
    const reason = str(message.error_message);
    await db
      .updateTable("revMessages")
      .set({ status: "failed", error: reason ? reason.slice(0, 500) : `WhatsApp error ${message.error_code ?? ""}`.trim() })
      .where("id", "=", id)
      .execute();
  } else if (event === "button.clicked") {
    // A tracked link in the button is counted by /_api/go; this only marks that the person engaged.
    await db.updateTable("revMessages").set({ firstClickedAt: sql`coalesce(first_clicked_at, ${at})` }).where("id", "=", id).execute();
  }
}

async function handleInbound(params: {
  replyId: string | null;
  originalId: string | null;
  phone: string | null;
  content: string;
  at: Date;
}): Promise<void> {
  const ledger = await findMessage(params.originalId);
  const key = params.replyId ? `reply:${params.replyId}` : `inbound:${params.phone}:${params.at.getTime()}`;
  const stored = await storeEvent(key, params.originalId ? "reply" : "received", ledger?.id ?? null, params.at, {
    originalProviderMessageId: params.originalId,
  });
  if (!stored) return;

  const userIds = ledger?.userId ? [ledger.userId] : await usersForPhone(params.phone);
  if (ledger) {
    await db.updateTable("revMessages").set({ repliedAt: sql`coalesce(replied_at, ${params.at})` }).where("id", "=", ledger.id).execute();
  }
  await db
    .insertInto("messageReplies")
    .values({
      messageId: ledger?.id ?? null,
      userId: userIds[0] ?? null,
      channel: "whatsapp",
      body: params.content.slice(0, 4000) || "(media)",
      receivedAt: params.at,
    })
    .execute();

  if (STOP_WORDS.test(params.content.trim())) {
    const optOutTargets = userIds.length ? userIds : await usersForPhone(params.phone);
    const studentIds = optOutTargets.length
      ? new Set((await db.selectFrom("students").select("id").where("id", "in", optOutTargets).execute()).map((row) => row.id))
      : new Set<number>();
    for (const userId of optOutTargets) {
      await db
        .insertInto("emailUnsubscribes")
        .values({ userId, list: WHATSAPP_OPT_OUT_LIST })
        .onConflict((oc) => oc.columns(["userId", "list"]).doNothing())
        .execute();
      // Consents are a student record (FK to students); a teacher's STOP is kept by the opt-out row above.
      if (!studentIds.has(userId)) continue;
      await db
        .insertInto("marketingConsents")
        .values({ userId, channel: "whatsapp", granted: false, source: "whatsapp_stop", noticeVersion: "2026-11-14" })
        .onConflict((oc) =>
          oc.columns(["userId", "channel"]).doUpdateSet({ granted: false, source: "whatsapp_stop", decidedAt: sql`now()` })
        )
        .execute();
    }
    return;
  }

  await handleQuickReply({
    content: params.content,
    ledgerMessageId: ledger?.id ?? null,
    phone: params.phone,
    replyId: params.replyId,
    at: params.at,
  }).catch((error) => console.error("[autopilot] quick reply handling failed:", error));
}

/**
 * Public: Waplify's WhatsApp receipts, verified by X-Webhook-Signature
 * (WAPLIFY_WEBHOOK_SECRET, the signing secret set on the endpoint in Waplify's
 * Settings > Webhooks). Status events (sent, delivered, read, failed, button
 * clicked) update the autopilot message whose provider id is WhatsApp's own
 * id, the one /messages/send returns. Replies and inbound messages land in
 * message_replies for the admin, and a STOP reply opts that person out of
 * WhatsApp marketing (email_unsubscribes list whatsapp_marketing). A tap on an
 * autopilot quick-reply button arrives as a reply carrying the button's text
 * and is acted on by helpers/autopilotQuickReplies. Each event
 * is stored once, so Waplify's retries are harmless. Bad signatures get a 401,
 * which Waplify does not retry.
 */
export async function handle(request: Request): Promise<Response> {
  const secret = (process.env as Record<string, string | undefined>).WAPLIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("WAPLIFY_WEBHOOK_SECRET is not set; refused a Waplify webhook");
    return json({ error: "Not configured" }, 503);
  }

  const body = await request.text();
  if (!verifyWaplifySignature(secret, body, request.headers.get("x-webhook-signature"))) {
    return json({ error: "Invalid signature" }, 401);
  }

  let event;
  try {
    event = schema.parse(JSON.parse(body));
  } catch {
    return json({ error: "Invalid payload" }, 400);
  }

  try {
    const at = when(event.timestamp);
    const message = obj(event.message);

    if (event.event === "webhook.test") {
      await storeEvent(`test:${at.getTime()}`, "test", null, at, { event: event.event });
    } else if (/^message\.(sent|delivered|read|failed)$/.test(event.event) || event.event === "button.clicked") {
      await handleStatus(event.event, message, at);
    } else if (event.event === "message.reply") {
      const reply = obj(event.reply);
      await handleInbound({
        replyId: str(reply.message_id),
        originalId: str(obj(event.original_message).message_id),
        phone: str(reply.contact_phone),
        content: str(reply.content) ?? "",
        at: when(reply.timestamp ?? event.timestamp),
      });
    } else if (event.event === "message.received") {
      await handleInbound({
        replyId: str(message.message_id),
        originalId: message.is_reply === true ? str(message.original_message_id) : null,
        phone: str(message.contact_phone),
        content: str(message.content) ?? "",
        at: when(message.timestamp ?? event.timestamp),
      });
    }
    return json({ ok: true });
  } catch (error) {
    console.error("Waplify webhook failed:", error);
    return json({ error: "Could not record the event" }, 500);
  }
}