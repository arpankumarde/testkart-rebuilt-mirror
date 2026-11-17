import { sql } from "kysely";
import { db } from "../../helpers/db";
import { allAccounts } from "../../helpers/allAccounts";
import { updateAccountById } from "../../helpers/accountRows";
import { verifySvixSignature } from "../../helpers/verifySvixSignature";
import { recordUnsubscribe } from "../../helpers/emailUnsubscribe";
import { schema } from "./resend_POST.schema";

export const flootPreviewPublic = true;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The autopilot message id an email was tagged with (tag "mid"), as Resend echoes tags back. */
function messageIdFromTags(tags: unknown): string | null {
  let value: unknown = null;
  if (Array.isArray(tags)) {
    value = tags.find((tag) => tag && typeof tag === "object" && (tag as { name?: unknown }).name === "mid")?.value;
  } else if (tags && typeof tags === "object") {
    value = (tags as Record<string, unknown>).mid;
  }
  return typeof value === "string" && /^[1-9][0-9]{0,15}$/.test(value) ? value : null;
}

/**
 * Public: Resend's delivery receipts for every email Testkart sends, verified
 * by Svix signature (RESEND_WEBHOOK_SECRET). Each event is stored once in
 * message_events (keyed on svix-id). Events for autopilot emails (tag mid)
 * update the rev_messages row. A bounce marks the address undeliverable
 * (email_bounced_at on the student or teacher row) and a spam complaint unsubscribes the person from
 * student_marketing, for any email, so later campaigns skip them. No email
 * address is stored.
 */
export async function handle(request: Request): Promise<Response> {
  const secret = (process.env as Record<string, string | undefined>).RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RESEND_WEBHOOK_SECRET is not set; refused a Resend webhook");
    return json({ error: "Not configured" }, 503);
  }

  const body = await request.text();
  const eventId = request.headers.get("svix-id");
  const valid = verifySvixSignature({
    secret,
    id: eventId,
    timestamp: request.headers.get("svix-timestamp"),
    signatureHeader: request.headers.get("svix-signature"),
    body,
  });
  if (!valid) return json({ error: "Invalid signature" }, 401);

  let event;
  try {
    event = schema.parse(JSON.parse(body));
  } catch {
    return json({ error: "Invalid payload" }, 400);
  }

  try {
    const type = event.type.replace(/^email\./, "");
    const messageId = messageIdFromTags(event.data.tags);
    const occurredAt = event.created_at ? new Date(event.created_at) : new Date();
    const when = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;

    const inserted = await db
      .insertInto("messageEvents")
      .values({
        messageId: null,
        provider: "resend",
        type,
        providerEventId: eventId,
        occurredAt: when,
        raw: { emailId: event.data.email_id ?? null, mid: messageId },
      })
      .onConflict((oc) => oc.column("providerEventId").doNothing())
      .returning("id")
      .executeTakeFirst();
    if (!inserted) return json({ ok: true });

    let message: { id: string; userId: number | null } | undefined;
    if (messageId) {
      message = await db.selectFrom("revMessages").select(["id", "userId"]).where("id", "=", messageId).executeTakeFirst();
      if (message) {
        await db.updateTable("messageEvents").set({ messageId: message.id }).where("id", "=", inserted.id).execute();
        const update =
          type === "sent"
            ? { status: "sent" as const, sentAt: sql<Date>`coalesce(sent_at, ${when})` }
            : type === "delivered"
              ? { status: "delivered" as const, deliveredAt: sql<Date>`coalesce(delivered_at, ${when})` }
              : type === "bounced"
                ? { status: "bounced" as const }
                : type === "complained"
                  ? { status: "complained" as const }
                  : type === "opened"
                    ? { openedAt: sql<Date>`coalesce(opened_at, ${when})` }
                    : null;
        if (update) await db.updateTable("revMessages").set(update).where("id", "=", message.id).execute();
      }
    }

    if (type === "bounced" || type === "complained") {
      const to = Array.isArray(event.data.to) ? event.data.to[0] : event.data.to;
      let userId = message?.userId ?? null;
      if (userId === null && to) {
        const user = await db
          .selectFrom(allAccounts(db).as("users"))
          .select("id")
          .where(sql<boolean>`lower(email) = ${to.trim().toLowerCase()}`)
          .executeTakeFirst();
        userId = user?.id ?? null;
      }
      if (userId !== null) {
        if (type === "bounced") {
          await updateAccountById(db, userId, { emailBouncedAt: when });
        } else {
          await recordUnsubscribe(db, userId, "student_marketing");
        }
      }
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Resend webhook failed:", error);
    return json({ error: "Could not record the event" }, 500);
  }
}