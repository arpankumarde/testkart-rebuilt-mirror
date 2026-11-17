import { sql } from "kysely";
import { db } from "./db";
import { AUTOPILOT_PLAYBOOKS, type PlaybookContext } from "./autopilotPlaybooks";
import { createMessageLink } from "./createMessageLink";
import { sendWhatsAppText } from "./autopilotChannels";
import { quickReplyAction, type QuickReplyAction } from "./autopilotWhatsAppTemplates";

/**
 * What the autopilot does when someone taps a quick-reply button on one of its
 * WhatsApp templates (helpers/autopilotWhatsAppTemplates). The webhook only gets
 * the button's text, so the text names the action:
 * - "Remind me tomorrow": the playbook's next message moves to 10:00 IST
 *   tomorrow; a finished playbook sends its last message again then (the engine
 *   never grants a second Tcoins offer to the same enrolment). Twice per
 *   enrolment at most.
 * - "Not interested": the person leaves that playbook; other playbooks and
 *   STOP are unaffected.
 * - "Payment problem": an answer with the usual fixes, a link back to the order
 *   or cart and the "Someone else paying?" option.
 * Each answer is a plain WhatsApp text, which Meta allows because the tap opened
 * a 24-hour window. Each message's action runs once, however often it is tapped.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const MAX_REMINDERS_PER_ENROLMENT = 2;
const SITE = "https://testkart.in";

/** 10:00 IST on the next morning in India: the same date for a tap before 06:00 IST, else the next day. */
export function tomorrowMorningIst(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const days = ist.getUTCHours() < 6 ? 0 : 1;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + days, 10, 0) - IST_OFFSET_MS);
}

type Ledger = { id: string; userId: number | null; intentId: string | null; step: number | null; playbookKey: string | null };

async function findLedger(messageId: string | null, phone: string | null): Promise<Ledger | null> {
  if (messageId) {
    const row = await db
      .selectFrom("revMessages")
      .select(["id", "userId", "intentId", "step", "playbookKey"])
      .where("id", "=", messageId)
      .executeTakeFirst();
    if (row) return row;
  }
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const row = await db
    .selectFrom("revMessages")
    .innerJoin("students", "students.id", "revMessages.userId")
    .select(["revMessages.id", "revMessages.userId", "revMessages.intentId", "revMessages.step", "revMessages.playbookKey"])
    .where("students.mobileNumber", "=", digits.slice(-10))
    .where("revMessages.channel", "=", "whatsapp")
    .where("revMessages.shadow", "=", false)
    .where("revMessages.createdAt", ">", sql<Date>`now() - interval '72 hours'`)
    .orderBy("revMessages.createdAt", "desc")
    .executeTakeFirst();
  return row ?? null;
}

async function claimAction(ledgerId: string, action: QuickReplyAction, at: Date): Promise<boolean> {
  const inserted = await db
    .insertInto("messageEvents")
    .values({
      messageId: ledgerId,
      provider: "waplify",
      type: `quick_reply_${action}`,
      providerEventId: `waplify:qr:${ledgerId}:${action}`,
      occurredAt: at,
      raw: { action },
    })
    .onConflict((oc) => oc.column("providerEventId").doNothing())
    .returning("id")
    .executeTakeFirst();
  return inserted !== undefined;
}

async function remindersSoFar(enrolmentId: string): Promise<number> {
  const result = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM message_events e JOIN rev_messages m ON m.id = e.message_id
    WHERE m.intent_id = ${enrolmentId} AND e.type = 'quick_reply_later'
  `.execute(db);
  return Number(result.rows[0]?.n ?? 0);
}

const HELP_TEXT = (link: string) =>
  [
    "Sorry the payment gave you trouble. These usually fix it:",
    "",
    "1. Pay by UPI (GPay, PhonePe, Paytm or BHIM).",
    "2. Keep the UPI app open until it shows the payment as done.",
    "3. If one app fails, try another UPI app or a card.",
    "",
    `Try again here: ${link}`,
    "",
    'Someone at home can also pay for you: open your cart on testkart.in and use "Someone else paying?" to send them a safe payment link.',
    "",
    "If money left your account but the order did not go through, reply here with the details and our team will check it.",
  ].join("\n");

/** Acts on a quick-reply tap; returns the action taken, or null when the text was not one of our buttons. */
export async function handleQuickReply(params: {
  content: string;
  ledgerMessageId: string | null;
  phone: string | null;
  replyId: string | null;
  at: Date;
}): Promise<QuickReplyAction | null> {
  const action = quickReplyAction(params.content);
  if (!action || !params.phone) return null;
  const ledger = await findLedger(params.ledgerMessageId, params.phone);
  if (!ledger) return null;
  if (!(await claimAction(ledger.id, action, params.at))) return action;

  const enrolment = ledger.intentId
    ? await db
        .selectFrom("revEnrolments")
        .select(["id", "state", "playbookKey", "context", "nextStep"])
        .where("id", "=", ledger.intentId)
        .executeTakeFirst()
    : undefined;
  const now = new Date();
  let text: string;

  if (action === "stop") {
    if (enrolment && (enrolment.state === "active" || enrolment.state === "completed")) {
      await db
        .updateTable("revEnrolments")
        .set({ state: "exited", exitReason: "declined_whatsapp", nextDueAt: null, updatedAt: now })
        .where("id", "=", enrolment.id)
        .execute();
    }
    text = "Okay, we won't send more reminders about this. You can reply STOP any time to stop all Testkart offers on WhatsApp.";
  } else if (action === "later") {
    const open = enrolment && (enrolment.state === "active" || enrolment.state === "completed");
    if (!open) {
      text = "Looks like you're all set with this one. Thank you!";
    } else if ((await remindersSoFar(enrolment.id)) > MAX_REMINDERS_PER_ENROLMENT) {
      text = "We've already set a reminder for this. You can open Testkart any time from the link above.";
    } else {
      const due = tomorrowMorningIst(now);
      await db
        .updateTable("revEnrolments")
        .set({
          state: "active",
          nextDueAt: due,
          updatedAt: now,
          exitReason: null,
          ...(enrolment.state === "completed" && ledger.step ? { nextStep: ledger.step } : {}),
        })
        .where("id", "=", enrolment.id)
        .execute();
      text = "Done. We'll remind you tomorrow morning.";
    }
  } else {
    const playbook = AUTOPILOT_PLAYBOOKS.find((p) => p.key === (enrolment?.playbookKey ?? ledger.playbookKey));
    const ctx = (enrolment?.context ?? {}) as unknown as PlaybookContext;
    const path = playbook ? playbook.link(ctx) : "/cart";
    const link = await createMessageLink(ledger.id, path).catch(() => `${SITE}${path}`);
    text = HELP_TEXT(link);
  }

  const sent = await sendWhatsAppText({ phone: params.phone, text, replyTo: params.replyId });
  if (!sent.ok) console.warn(`[autopilot] quick reply ${action} answer for message ${ledger.id} failed: ${sent.error}`);
  return action;
}
