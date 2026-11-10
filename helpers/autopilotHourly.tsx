import { sql } from "kysely";
import { db } from "./db";
import { getAutopilotSettings } from "./getAutopilotSettings";
import { isInGlobalHoldout } from "./isInGlobalHoldout";
import { recordOrderOutcome } from "./recordOrderOutcome";
import { getAutopilotDashboard } from "./autopilotDashboardData";
import { sendEmail } from "./sendEmail";
import { lookupPayUTransactions } from "./lookupPayUTransactions";
import { runAutopilotEngine } from "./autopilotEngine";
import { runLiveTeachingSweep } from "./liveTeachingSweep";
import type { AutopilotCheckStatus } from "./schema";

/**
 * Scheduled job, every 15 minutes, the whole autopilot in one job because the
 * project is at Floot's 10-job limit. Every run: the playbook engine
 * (helpers/autopilotEngine: enrol, send and rescue refused WhatsApp messages,
 * so a failed payment hears back in about 15 minutes; each pass is logged in
 * autopilot_runs). Once an hour (the first run after :00):
 * 1. Attribution: drops a click cookie that points at someone else's message
 *    and credits orders to a message the buyer clicked on another device in
 *    the 72 hours before.
 * 2. Outcomes: backfills payment_succeeded and payment_failed events from
 *    orders, so funnel_events always matches the orders table.
 * 3. Data checks, written to autopilot_checks; a check that turns to fail
 *    posts to Google Chat (GOOGLE_CHAT_AUTOPILOT_WEBHOOK_URL).
 * 4. At 09:00 IST, the daily digest to the same Chat space.
 * 5. On the 1st at 03:00 IST, retention: events older than 13 months are
 *    rolled into funnel_daily and deleted; checks and run logs older than 90
 *    days go.
 * Each step is caught on its own so one failure does not stop the rest.
 */

type Row = Record<string, unknown>;
const pick = (row: Row | undefined, snake: string): unknown => {
  if (!row) return undefined;
  if (snake in row) return row[snake];
  return row[snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
};
const num = (row: Row | undefined, key: string) => Number(pick(row, key) ?? 0) || 0;

const chatWebhook = () => (process.env as Record<string, string | undefined>).GOOGLE_CHAT_AUTOPILOT_WEBHOOK_URL;

async function postToChat(text: string): Promise<void> {
  const url = chatWebhook();
  if (!url) {
    console.warn("GOOGLE_CHAT_AUTOPILOT_WEBHOOK_URL is not set; skipped an autopilot chat post");
    return;
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) console.error(`Autopilot chat post failed with status ${response.status}`);
  } catch (error) {
    console.error("Autopilot chat post failed:", error);
  }
}

async function fixAttribution(): Promise<void> {
  await sql`
    UPDATE orders o SET attributed_message_id = NULL, attributed_intent_id = NULL
    WHERE o.attributed_message_id IS NOT NULL AND o.created_at > now() - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM rev_messages m
        WHERE m.id = o.attributed_message_id AND (m.user_id IS NULL OR m.user_id = o.user_id)
      )
  `.execute(db);
  await sql`
    UPDATE orders o SET attributed_intent_id = m.intent_id
    FROM rev_messages m
    WHERE o.attributed_message_id = m.id AND o.attributed_intent_id IS NULL AND m.intent_id IS NOT NULL
      AND o.created_at > now() - interval '7 days'
  `.execute(db);
  await sql`
    UPDATE orders o SET attributed_message_id = sub.mid, attributed_intent_id = sub.iid
    FROM (
      SELECT o2.id AS oid, m.id AS mid, m.intent_id AS iid
      FROM orders o2
      JOIN LATERAL (
        SELECT id, intent_id FROM rev_messages
        WHERE user_id = o2.user_id AND shadow = false
          AND first_clicked_at <= o2.created_at AND first_clicked_at > o2.created_at - interval '72 hours'
        ORDER BY first_clicked_at DESC LIMIT 1
      ) m ON true
      WHERE o2.attributed_message_id IS NULL AND o2.created_at > now() - interval '7 days'
    ) sub
    WHERE o.id = sub.oid
  `.execute(db);
}

async function backfillOutcomes(): Promise<void> {
  const succeeded = await sql<Row>`
    SELECT o.id FROM orders o
    WHERE o.status = 'completed' AND o.updated_at > now() - interval '48 hours'
      AND NOT EXISTS (SELECT 1 FROM funnel_events e WHERE e.order_id = o.id AND e.event = 'payment_succeeded')
    ORDER BY o.id LIMIT 500
  `.execute(db);
  for (const row of succeeded.rows) await recordOrderOutcome(num(row, "id"), "payment_succeeded", { backfilled: true });

  const failed = await sql<Row>`
    SELECT o.id FROM orders o
    WHERE o.status IN ('failed', 'cancelled') AND o.total_amount > 0 AND o.updated_at > now() - interval '48 hours'
      AND NOT EXISTS (SELECT 1 FROM funnel_events e WHERE e.order_id = o.id AND e.event = 'payment_failed')
    ORDER BY o.id LIMIT 500
  `.execute(db);
  for (const row of failed.rows) await recordOrderOutcome(num(row, "id"), "payment_failed");
}

type Check = {
  key: string;
  status: AutopilotCheckStatus;
  value: number | null;
  detail: Record<string, string | number | boolean | null>;
};

const band = (value: number, warnAbove: number, failAbove: number): AutopilotCheckStatus =>
  value > failAbove ? "fail" : value > warnAbove ? "warn" : "pass";

/**
 * Orders we marked failed or cancelled in the last 72 hours whose money PayU
 * actually captured. They are flagged, not completed: an admin reconciles each
 * one from Transactions, so enrolment never changes without someone looking.
 */
async function capturedButFailed(): Promise<Check> {
  const rows = await sql<Row>`
    SELECT id, payment_transaction_id FROM orders
    WHERE status IN ('failed', 'cancelled') AND payment_method = 'payu' AND total_amount > 0
      AND payment_transaction_id IS NOT NULL AND created_at > now() - interval '72 hours'
    ORDER BY id DESC LIMIT 200
  `.execute(db);
  const byTxn = new Map(rows.rows.map((row) => [String(pick(row, "payment_transaction_id")), num(row, "id")]));
  const captured: number[] = [];
  const txnids = [...byTxn.keys()];
  for (let i = 0; i < txnids.length; i += 25) {
    const batch = txnids.slice(i, i + 25);
    const result = await lookupPayUTransactions(batch);
    if (!result.ok) {
      return { key: "payu_captured_but_failed", status: "warn", value: null, detail: { error: result.status } };
    }
    for (const txnid of batch) {
      if (result.transactions[txnid]?.status === "success") captured.push(byTxn.get(txnid)!);
    }
  }
  return {
    key: "payu_captured_but_failed",
    status: captured.length > 0 ? "fail" : "pass",
    value: captured.length,
    detail: { orders: captured.slice(0, 20).join(", "), checked: txnids.length },
  };
}

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  const settings = await getAutopilotSettings();
  const start = settings.trackingStartedAt ? new Date(settings.trackingStartedAt) : null;
  if (!start) {
    for (const key of ["attribution_coverage", "checkout_events_match_orders", "payment_events_match_orders"]) {
      checks.push({ key, status: "pass", value: null, detail: { notStarted: true } });
    }
  }

  if (start) {
  const coverage = await sql<Row>`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE first_touch_source IS NOT NULL OR client_source IN ('android_app', 'ios_app'))::int AS known
    FROM orders
    WHERE status = 'completed' AND total_amount > 0 AND created_at > now() - interval '24 hours'
      AND created_at >= ${start}
  `.execute(db);
  const total = num(coverage.rows[0], "total");
  const known = num(coverage.rows[0], "known");
  const percent = total > 0 ? Math.round((known / total) * 100) : null;
  checks.push({
    key: "attribution_coverage",
    status: percent === null || percent >= 95 ? "pass" : percent >= 80 ? "warn" : "fail",
    value: percent,
    detail: { total, known },
  });
  }

  const hourly = await sql<Row>`
    SELECT
      (SELECT count(*)::int FROM funnel_events
        WHERE occurred_at >= date_trunc('hour', now()) - interval '1 hour' AND occurred_at < date_trunc('hour', now())) AS last_hour,
      (SELECT (count(*) / 7.0)::float FROM funnel_events
        WHERE occurred_at >= date_trunc('hour', now()) - interval '1 hour' - interval '7 days'
          AND occurred_at < date_trunc('hour', now()) - interval '1 day'
          AND extract(hour FROM occurred_at) = extract(hour FROM date_trunc('hour', now()) - interval '1 hour')) AS usual
  `.execute(db);
  const lastHour = num(hourly.rows[0], "last_hour");
  const usual = num(hourly.rows[0], "usual");
  const ratio = usual >= 20 ? lastHour / usual : null;
  checks.push({
    key: "events_per_hour",
    status: ratio === null || ratio >= 0.6 ? "pass" : ratio >= 0.4 ? "warn" : "fail",
    value: lastHour,
    detail: { usual: Math.round(usual) },
  });

  if (start) {
  const checkout = await sql<Row>`
    SELECT count(*)::int AS missing FROM orders o
    WHERE o.payment_method IN ('payu', 'wallet') AND o.total_amount > 0
      AND o.created_at > now() - interval '24 hours' AND o.created_at < now() - interval '10 minutes'
      AND o.created_at >= ${start}
      AND NOT EXISTS (SELECT 1 FROM funnel_events e WHERE e.order_id = o.id AND e.event = 'checkout_started')
  `.execute(db);
  const missingCheckout = num(checkout.rows[0], "missing");
  checks.push({ key: "checkout_events_match_orders", status: band(missingCheckout, 0, 2), value: missingCheckout, detail: {} });

  const payment = await sql<Row>`
    SELECT count(*)::int AS backfilled FROM funnel_events e
    JOIN orders o ON o.id = e.order_id
    WHERE e.event = 'payment_succeeded' AND e.amount > 0 AND e.props->>'backfilled' = 'true'
      AND e.occurred_at > now() - interval '24 hours' AND o.created_at >= ${start}
  `.execute(db);
  const backfilled = num(payment.rows[0], "backfilled");
  checks.push({ key: "payment_events_match_orders", status: band(backfilled, 0, 2), value: backfilled, detail: {} });
  }

  const sent = await db
    .selectFrom("revMessages")
    .select(["userId"])
    .where("shadow", "=", false)
    .where("sentAt", ">", sql<Date>`now() - interval '24 hours'`)
    .where("userId", "is not", null)
    .execute();
  const leaks = settings.holdoutSalt
    ? sent.filter((m) => m.userId !== null && isInGlobalHoldout(m.userId, settings.holdoutSalt, settings.holdoutPercent)).length
    : 0;
  checks.push({ key: "holdout_leaks", status: leaks > 0 ? "fail" : "pass", value: leaks, detail: {} });

  const orphan = await sql<Row>`
    SELECT count(*)::int AS n FROM message_events
    WHERE provider = 'resend' AND message_id IS NULL AND raw->>'mid' IS NOT NULL
      AND occurred_at > now() - interval '24 hours'
  `.execute(db);
  const orphans = num(orphan.rows[0], "n");
  checks.push({ key: "sends_without_ledger", status: orphans > 0 ? "warn" : "pass", value: orphans, detail: {} });

  const receipts = await sql<Row>`
    SELECT count(*)::int AS n FROM message_events WHERE provider = 'resend' AND occurred_at > now() - interval '24 hours'
  `.execute(db);
  const receiptCount = num(receipts.rows[0], "n");
  const configured = Boolean((process.env as Record<string, string | undefined>).RESEND_WEBHOOK_SECRET);
  checks.push({
    key: "webhook_freshness",
    status: !configured ? "warn" : receiptCount > 0 ? "pass" : "fail",
    value: receiptCount,
    detail: { configured },
  });

  checks.push(await capturedButFailed());

  return checks;
}

async function saveChecks(checks: Check[]): Promise<void> {
  const previous = await sql<Row>`
    SELECT DISTINCT ON (check_key) check_key, status::text AS status
    FROM autopilot_checks ORDER BY check_key, ran_at DESC
  `.execute(db);
  const before = new Map(previous.rows.map((row) => [String(pick(row, "check_key")), String(pick(row, "status"))]));

  await db
    .insertInto("autopilotChecks")
    .values(checks.map((c) => ({ checkKey: c.key, status: c.status, value: c.value === null ? null : String(c.value), detail: c.detail })))
    .execute();

  const newlyFailing = checks.filter((c) => c.status === "fail" && before.get(c.key) !== "fail");
  if (newlyFailing.length > 0) {
    const lines = newlyFailing.map((c) => `- ${c.key.replace(/_/g, " ")}: ${c.value ?? "n/a"}`);
    await postToChat(["*Autopilot data check failing*", ...lines, "<https://testkart.in/admin/autopilot|Open the Autopilot page>"].join("\n"));
  }
}

async function emailDigest(lines: string[]): Promise<void> {
  const recipients = await sql<Row>`
    SELECT email FROM admins WHERE is_active IS NOT FALSE AND 'autopilot' = ANY(permissions)
  `.execute(db);
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const plain = lines.map((line) => line.replace(/<([^|>]+)\|([^>]+)>/g, "$2: $1").replace(/\*/g, ""));
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6">` +
    plain.map((line, index) => (index === 0 ? `<h2 style="font-size:18px">${escape(line)}</h2>` : `<p>${escape(line)}</p>`)).join("") +
    `</div>`;
  for (const row of recipients.rows) {
    const to = String(pick(row, "email") ?? "");
    if (!to) continue;
    await sendEmail({ to, subject: plain[0], html, text: plain.join("\n") });
  }
}

async function sendDigest(): Promise<void> {
  const d = await getAutopilotDashboard(1);
  const inr = (v: number) => `Rs ${Math.round(v).toLocaleString("en-IN")}`;
  const failing = d.checks.filter((c) => c.status !== "pass").map((c) => c.key.replace(/_/g, " "));
  const funnel = d.funnel.map((s) => `${s.label}: ${s.count}`).join(" | ");
  const lines = [
    "*Revenue autopilot - last 24 hours*",
    `Paid orders ${d.kpis.paidOrders}, sales ${inr(d.kpis.gmv)}, Testkart take ${inr(d.kpis.take)}`,
    `Attributed to messages ${inr(d.kpis.attributedGmv)} (${d.kpis.attributedOrders} orders), messages sent ${d.kpis.messagesSent}, cost ${inr(d.kpis.messageCostRupees)}`,
    `Funnel: ${funnel}`,
    `Autopilot is ${d.settings.enabled ? (d.settings.shadow ? "on in shadow mode" : "on") : "off"}`,
    failing.length ? `Checks needing a look: ${failing.join(", ")}` : "All data checks pass",
    "<https://testkart.in/admin/autopilot|Open the Autopilot page>",
  ];
  await postToChat(lines.join("\n"));
  await emailDigest(lines);
}

async function applyRetention(): Promise<void> {
  await sql`
    INSERT INTO funnel_daily (day, event, platform, source, events, visitors, users)
    SELECT occurred_at::date, event, coalesce(platform, ''), coalesce(source, ''),
           count(*)::int, count(DISTINCT visitor_id)::int, count(DISTINCT user_id)::int
    FROM funnel_events WHERE occurred_at < now() - interval '13 months'
    GROUP BY 1, 2, 3, 4
    ON CONFLICT (day, event, platform, source) DO UPDATE
      SET events = funnel_daily.events + excluded.events,
          visitors = funnel_daily.visitors + excluded.visitors,
          users = funnel_daily.users + excluded.users
  `.execute(db);
  await sql`DELETE FROM funnel_events WHERE occurred_at < now() - interval '13 months'`.execute(db);
  await sql`DELETE FROM autopilot_checks WHERE ran_at < now() - interval '90 days'`.execute(db);
  await sql`DELETE FROM autopilot_runs WHERE started_at < now() - interval '90 days'`.execute(db);
}

async function step(name: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error(`[autopilotHourly] ${name} failed:`, error);
  }
}

export async function autopilotHourly(): Promise<void> {
  const ist = new Date(Date.now() + 330 * 60 * 1000);
  await step("engine", async () => {
    await runAutopilotEngine();
  });
  await step("liveTeaching", runLiveTeachingSweep);
  if (ist.getUTCMinutes() >= 15) return;
  await step("attribution", fixAttribution);
  await step("outcomes", backfillOutcomes);
  await step("checks", async () => saveChecks(await runChecks()));
  if (ist.getUTCHours() === 9) await step("digest", sendDigest);
  if (ist.getUTCDate() === 1 && ist.getUTCHours() === 3) await step("retention", applyRetention);
}