import { sql } from "kysely";
import { db } from "./db";
import { allAccounts } from "./allAccounts";
import { AUTOPILOT_PLAYBOOKS, AUTOPILOT_PLAYBOOK_LABELS } from "./autopilotPlaybooks";

/**
 * One student's whole autopilot story for the Ledger's journey panel: how the
 * autopilot can reach them (email and WhatsApp, with the reason a route is
 * closed), every playbook they joined, and a timeline of what happened, newest
 * first: joining, each message and its receipts, Tcoin offers, replies and
 * their orders since they first joined. Real messages only. Server-only.
 */

type Row = Record<string, unknown>;
const pick = (row: Row | undefined, snake: string): unknown =>
  !row ? undefined : snake in row ? row[snake] : row[snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
const num = (row: Row | undefined, key: string) => Number(pick(row, key) ?? 0) || 0;
const str = (row: Row, key: string) => {
  const value = pick(row, key);
  return value === null || value === undefined ? null : String(value);
};
const at = (row: Row, key: string) => {
  const value = pick(row, key);
  return value ? new Date(String(value)) : null;
};

export type JourneyEventKind =
  | "joined"
  | "sent"
  | "delivered"
  | "read"
  | "clicked"
  | "replied"
  | "failed"
  | "skipped"
  | "rescued"
  | "offer"
  | "order"
  | "finished";

export type JourneyEvent = { at: Date; kind: JourneyEventKind; title: string; detail: string | null; playbook: string | null };

export type JourneyEnrolment = {
  id: number;
  playbook: string;
  label: string;
  heldOut: boolean;
  state: string;
  exitReason: string | null;
  nextStep: number | null;
  nextDueAt: Date | null;
  triggerAt: Date;
  steps: number;
};

export type AutopilotJourney = {
  userId: number;
  name: string | null;
  joinedTestkart: Date | null;
  email: { usable: boolean; note: string };
  whatsapp: { usable: boolean; note: string };
  enrolments: JourneyEnrolment[];
  events: JourneyEvent[];
};

const CHANNEL = (value: string | null) => (value === "whatsapp" ? "WhatsApp" : value === "push" ? "app push" : "email");

export async function getAutopilotJourney(userId: number): Promise<AutopilotJourney | null> {
  const user = await db
    .selectFrom(allAccounts(db).as("account"))
    .select(["id", "displayName", "email", "emailBouncedAt", "mobileNumber", "createdAt", "isActive"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!user) return null;

  const [blocks, enrolments, messages, offers, orders, replies] = await Promise.all([
    sql<Row>`
      SELECT
        EXISTS (SELECT 1 FROM email_unsubscribes WHERE user_id = ${userId} AND list = 'student_marketing') AS email_unsub,
        EXISTS (SELECT 1 FROM email_unsubscribes WHERE user_id = ${userId} AND list = 'whatsapp_marketing') AS whatsapp_stop,
        EXISTS (SELECT 1 FROM marketing_consents WHERE user_id = ${userId} AND channel = 'whatsapp' AND granted = false) AS whatsapp_declined,
        (SELECT max(e.occurred_at) FROM message_events e JOIN rev_messages m ON m.id = e.message_id
          WHERE m.user_id = ${userId} AND e.provider = 'waplify' AND e.type = 'failed' AND e.raw->>'errorCode' = '131026'
            AND e.occurred_at > now() - interval '90 days') AS not_on_whatsapp,
        (SELECT max(e.occurred_at) FROM message_events e JOIN rev_messages m ON m.id = e.message_id
          WHERE m.user_id = ${userId} AND e.provider = 'waplify' AND e.type = 'failed' AND e.raw->>'errorCode' = '131049'
            AND e.occurred_at > now() - interval '24 hours') AS meta_limit
    `.execute(db),
    db
      .selectFrom("revEnrolments")
      .select(["id", "playbookKey", "isHoldout", "state", "exitReason", "nextStep", "nextDueAt", "triggerAt", "createdAt", "updatedAt", "convertedAt", "convertedOrderId"])
      .where("userId", "=", userId)
      .orderBy("createdAt", "desc")
      .limit(20)
      .execute(),
    sql<Row>`
      SELECT id, playbook_key, step, variant_key, channel::text AS channel, template_key, status::text AS status, error,
        created_at, sent_at, delivered_at, read_at, opened_at, first_clicked_at, click_count, replied_at
      FROM rev_messages WHERE user_id = ${userId} AND shadow = false
      ORDER BY created_at DESC LIMIT 60
    `.execute(db),
    sql<Row>`
      SELECT o.coins, o.created_at, e.playbook_key, g.expires_at
      FROM rev_offers o JOIN rev_enrolments e ON e.id = o.enrolment_id LEFT JOIN tcoin_grants g ON g.id = o.tcoin_grant_id
      WHERE o.user_id = ${userId} AND o.shadow = false ORDER BY o.created_at DESC LIMIT 20
    `.execute(db),
    sql<Row>`
      SELECT id, status::text AS status, total_amount, created_at, attributed_message_id
      FROM orders WHERE user_id = ${userId}
        AND created_at >= coalesce((SELECT min(created_at) FROM rev_enrolments WHERE user_id = ${userId}), now())
      ORDER BY created_at DESC LIMIT 20
    `.execute(db),
    sql<Row>`
      SELECT r.body, r.received_at, m.playbook_key FROM message_replies r LEFT JOIN rev_messages m ON m.id = r.message_id
      WHERE r.user_id = ${userId} ORDER BY r.received_at DESC LIMIT 20
    `.execute(db),
  ]);

  const b = blocks.rows[0] ?? {};
  const email = user.email?.trim() ?? "";
  const emailNote = !email
    ? "No email on the account"
    : /@mail\.testkart\.in$/i.test(email)
      ? "Placeholder address from a phone signup"
      : user.emailBouncedAt
        ? "Address bounced"
        : pick(b, "email_unsub")
          ? "Unsubscribed from reminders"
          : "Usable";
  const mobile = (user.mobileNumber ?? "").replace(/\D/g, "").slice(-10);
  const whatsappNote = !/^[6-9]\d{9}$/.test(mobile)
    ? "No valid mobile number"
    : pick(b, "whatsapp_stop")
      ? "Replied STOP"
      : pick(b, "whatsapp_declined")
        ? "Said no to WhatsApp"
        : pick(b, "not_on_whatsapp")
          ? "Number not on WhatsApp (Meta), paused 90 days"
          : pick(b, "meta_limit")
            ? "Meta's per-person limit hit, paused 1 day"
            : "Usable";

  const label = (key: string | null) => (key ? AUTOPILOT_PLAYBOOK_LABELS[key] ?? key.replace(/_/g, " ") : null);
  const events: JourneyEvent[] = [];
  for (const e of enrolments) {
    events.push({
      at: e.createdAt,
      kind: "joined",
      title: `Joined ${label(e.playbookKey)}`,
      detail: e.isHoldout ? "Held out: gets no messages, used to measure lift" : null,
      playbook: e.playbookKey,
    });
    if (e.state !== "active") {
      events.push({
        at: e.convertedAt ?? e.updatedAt,
        kind: e.state === "converted" ? "order" : "finished",
        title: e.state === "converted" ? `Goal reached in ${label(e.playbookKey)}` : `Left ${label(e.playbookKey)}`,
        detail: e.convertedOrderId ? `Order #${e.convertedOrderId}` : e.exitReason ? e.exitReason.replace(/_/g, " ") : "All messages done",
        playbook: e.playbookKey,
      });
    }
  }
  for (const m of messages.rows) {
    const playbook = str(m, "playbook_key");
    const name = `${label(playbook)}, message ${num(m, "step")}`;
    const channel = CHANNEL(str(m, "channel"));
    const status = str(m, "status") ?? "";
    const error = str(m, "error");
    const created = at(m, "created_at")!;
    if (status === "skipped") {
      events.push({ at: created, kind: "skipped", title: `Skipped: ${name}`, detail: error, playbook });
      continue;
    }
    if (error?.startsWith("whatsapp failed:")) {
      events.push({ at: created, kind: "rescued", title: `WhatsApp refused, sent by email: ${name}`, detail: error.replace(/^whatsapp failed:\s*/, ""), playbook });
    }
    const template = str(m, "template_key");
    const sentAt = at(m, "sent_at") ?? created;
    events.push({
      at: sentAt,
      kind: "sent",
      title: `Sent by ${channel}: ${name}`,
      detail: [template?.startsWith("tk_") ? `Template ${template}` : null, str(m, "variant_key") ? `version ${str(m, "variant_key")!.toUpperCase()}` : null]
        .filter(Boolean)
        .join(", ") || null,
      playbook,
    });
    if (["failed", "bounced", "complained"].includes(status)) {
      events.push({
        at: new Date(sentAt.getTime() + 1000),
        kind: "failed",
        title: `${status === "failed" ? "Failed" : status === "bounced" ? "Bounced" : "Marked as spam"}: ${name}`,
        detail: error,
        playbook,
      });
    }
    const delivered = at(m, "delivered_at");
    if (delivered) events.push({ at: delivered, kind: "delivered", title: `Delivered: ${name}`, detail: null, playbook });
    const read = at(m, "read_at") ?? at(m, "opened_at");
    if (read) events.push({ at: read, kind: "read", title: `${str(m, "channel") === "whatsapp" ? "Read" : "Opened"}: ${name}`, detail: null, playbook });
    const clicked = at(m, "first_clicked_at");
    if (clicked) {
      const clicks = num(m, "click_count");
      events.push({ at: clicked, kind: "clicked", title: `Clicked: ${name}`, detail: clicks > 1 ? `${clicks} clicks` : null, playbook });
    }
  }
  for (const o of offers.rows) {
    const expires = at(o, "expires_at");
    events.push({
      at: at(o, "created_at")!,
      kind: "offer",
      title: `${num(o, "coins")} Tcoins added`,
      detail: expires ? `Usable until ${expires.toISOString().slice(0, 10).split("-").reverse().join("-")}` : null,
      playbook: str(o, "playbook_key"),
    });
  }
  for (const r of replies.rows) {
    const body = str(r, "body") ?? "";
    events.push({
      at: at(r, "received_at")!,
      kind: "replied",
      title: "Replied on WhatsApp",
      detail: body.length > 160 ? `${body.slice(0, 157)}...` : body,
      playbook: str(r, "playbook_key"),
    });
  }
  for (const o of orders.rows) {
    const status = str(o, "status") ?? "";
    events.push({
      at: at(o, "created_at")!,
      kind: status === "completed" ? "order" : "failed",
      title: `Order #${num(o, "id")} ${status}`,
      detail: `Rs ${Math.round(num(o, "total_amount")).toLocaleString("en-IN")}${pick(o, "attributed_message_id") ? ", credited to an autopilot message" : ""}`,
      playbook: null,
    });
  }
  events.sort((a, z) => z.at.getTime() - a.at.getTime());

  return {
    userId: user.id,
    name: user.displayName,
    joinedTestkart: user.createdAt ?? null,
    email: { usable: emailNote === "Usable" && user.isActive !== false, note: emailNote },
    whatsapp: { usable: whatsappNote === "Usable" && user.isActive !== false, note: whatsappNote },
    enrolments: enrolments.map((e) => ({
      id: Number(e.id),
      playbook: e.playbookKey,
      label: label(e.playbookKey) ?? e.playbookKey,
      heldOut: e.isHoldout,
      state: e.state,
      exitReason: e.exitReason,
      nextStep: e.state === "active" ? e.nextStep : null,
      nextDueAt: e.state === "active" ? e.nextDueAt : null,
      triggerAt: e.triggerAt,
      steps: AUTOPILOT_PLAYBOOKS.find((p) => p.key === e.playbookKey)?.steps.length ?? 0,
    })),
    events: events.slice(0, 200),
  };
}
