import { sql } from "kysely";
import { db } from "./db";
import { getAutopilotSettings } from "./getAutopilotSettings";
import { AUTOPILOT_PLAYBOOKS } from "./autopilotPlaybooks";
import { nextSendTime } from "./autopilotRules";

/**
 * The Autopilot page's Operations tab: how the engine is running right now.
 * Engine runs (autopilot_runs, last 24 hours), real messages per IST hour for
 * the last 48 hours next to what is scheduled for the next 24 (placed at the
 * hour it can really go out, after quiet hours), each playbook
 * step as a funnel (sent, delivered, read, clicked, paid order within 72
 * hours) over the last 7 days, why messages did not go out, channels side by
 * side, and today's offer budget. Shadow rows are left out. Server-only.
 */

type Row = Record<string, unknown>;
const pick = (row: Row | undefined, snake: string): unknown =>
  !row ? undefined : snake in row ? row[snake] : row[snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
const num = (row: Row | undefined, key: string) => Number(pick(row, key) ?? 0) || 0;
const date = (row: Row, key: string) => {
  const value = pick(row, key);
  return value ? new Date(String(value)) : null;
};

export type OperationsRun = {
  startedAt: Date;
  durationMs: number;
  due: number;
  sent: number;
  failed: number;
  skipped: number;
  deferred: number;
  converted: number;
  rescued: number;
  errors: number;
  error: string | null;
};

export type OperationsHour = {
  /** Start of the hour, UTC instant. */
  hour: Date;
  future: boolean;
  emailDelivered: number;
  whatsappDelivered: number;
  awaitingReceipt: number;
  failed: number;
  skipped: number;
  scheduled: number;
};

export type OperationsStep = {
  playbook: string;
  label: string;
  step: number;
  offer: boolean;
  delayHours: number;
  waiting: number;
  sent: number;
  email: number;
  whatsapp: number;
  delivered: number;
  read: number;
  clicked: number;
  ordered: number;
};

export type OperationsReason = { key: string; label: string; action: string; tone: "failed" | "skipped" | "rescued"; count: number };

export type OperationsChannel = {
  channel: string;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  ordered: number;
  costRupees: number;
};

export type AutopilotOperations = {
  generatedAt: Date;
  enabled: boolean;
  shadow: boolean;
  sendWindow: { start: number; end: number };
  lastRun: OperationsRun | null;
  runs: OperationsRun[];
  hours: OperationsHour[];
  steps: OperationsStep[];
  reasons: OperationsReason[];
  channels: OperationsChannel[];
  today: { sent: number; failed: number; offerRupees: number; offerBudgetRupees: number; ordersFromMessages: number; orderAmount: number };
  queue: { nextHour: number; next24Hours: number; activePeople: number };
};

const REASONS: { match: RegExp; key: string; label: string; action: string; tone?: OperationsReason["tone"] }[] = [
  {
    match: /^whatsapp failed:.*healthy ecosystem/i,
    key: "rescued_meta_limit",
    label: "WhatsApp refused by Meta's per-person limit, sent by email instead",
    action: "Rescued by email",
    tone: "rescued",
  },
  { match: /^whatsapp failed:/i, key: "rescued_other", label: "WhatsApp failed, sent by email instead", action: "Rescued by email", tone: "rescued" },
  {
    match: /healthy ecosystem/i,
    key: "meta_limit",
    label: "Meta's per-person marketing limit",
    action: "WhatsApp paused 1 day for that person; next step goes by email if they have one",
  },
  { match: /undeliverable/i, key: "not_on_whatsapp", label: "Number not on WhatsApp", action: "WhatsApp skipped for 90 days for that person" },
  { match: /experiment/i, key: "meta_experiment", label: "Number in Meta's marketing experiment", action: "WhatsApp skipped for 7 days for that person" },
  { match: /too many requests|rate limit/i, key: "email_rate", label: "Email provider busy (10 a second)", action: "Retried automatically since 15-11-2026" },
  { match: /no reachable channel/i, key: "no_channel", label: "No usable email or WhatsApp number", action: "Step skipped; the next step tries again", tone: "skipped" },
  { match: /bounced/i, key: "bounced", label: "Email bounced", action: "Address marked undeliverable; no more email to it" },
  { match: /complained/i, key: "complained", label: "Marked as spam", action: "Unsubscribed from reminders" },
];

function classify(error: string | null, status: string): Omit<OperationsReason, "count"> {
  const text = `${error ?? ""} ${status === "bounced" || status === "complained" ? status : ""}`;
  for (const reason of REASONS) {
    if (reason.match.test(text)) {
      return { key: reason.key, label: reason.label, action: reason.action, tone: reason.tone ?? (status === "skipped" ? "skipped" : "failed") };
    }
  }
  const short = (error ?? status).replace(/\s+/g, " ").trim().slice(0, 80) || status;
  return { key: `other:${short}`, label: short.charAt(0).toUpperCase() + short.slice(1), action: "Check the Ledger tab", tone: status === "skipped" ? "skipped" : "failed" };
}

const toRun = (row: Row): OperationsRun => ({
  startedAt: date(row, "started_at") ?? new Date(),
  durationMs: num(row, "duration_ms"),
  due: num(row, "due"),
  sent: num(row, "sent"),
  failed: num(row, "failed"),
  skipped: num(row, "skipped"),
  deferred: num(row, "deferred"),
  converted: num(row, "converted"),
  rescued: num(row, "rescued"),
  errors: num(row, "errors"),
  error: (pick(row, "error") as string | null) ?? null,
});

export async function getAutopilotOperations(): Promise<AutopilotOperations> {
  const settings = await getAutopilotSettings();
  const now = new Date();
  const hourMs = 60 * 60 * 1000;
  const currentHour = new Date(Math.floor(now.getTime() / hourMs) * hourMs);
  const firstHour = new Date(currentHour.getTime() - 47 * hourMs);
  const lastHour = new Date(currentHour.getTime() + 24 * hourMs);

  const [runs, lastRun, pastHours, futureHours, steps, waiting, reasons, channels, today, queue] = await Promise.all([
    sql<Row>`SELECT * FROM autopilot_runs WHERE started_at > now() - interval '24 hours' ORDER BY started_at`.execute(db),
    sql<Row>`SELECT * FROM autopilot_runs ORDER BY started_at DESC LIMIT 1`.execute(db),
    sql<Row>`
      SELECT date_trunc('hour', created_at) AS hour,
        count(*) FILTER (WHERE channel = 'email' AND (delivered_at IS NOT NULL OR status = 'delivered'))::int AS email_delivered,
        count(*) FILTER (WHERE channel = 'whatsapp' AND (delivered_at IS NOT NULL OR status = 'delivered'))::int AS whatsapp_delivered,
        count(*) FILTER (WHERE status IN ('queued', 'sent') AND delivered_at IS NULL)::int AS awaiting,
        count(*) FILTER (WHERE status IN ('failed', 'bounced', 'complained'))::int AS failed,
        count(*) FILTER (WHERE status = 'skipped')::int AS skipped
      FROM rev_messages
      WHERE shadow = false AND created_at >= ${firstHour}
      GROUP BY 1
    `.execute(db),
    sql<Row>`
      SELECT next_due_at FROM rev_enrolments
      WHERE state = 'active' AND is_holdout = false AND next_due_at IS NOT NULL AND next_due_at < ${lastHour}
      LIMIT 5000
    `.execute(db),
    sql<Row>`
      SELECT m.playbook_key, m.step, count(*)::int AS sent,
        count(*) FILTER (WHERE m.channel = 'email')::int AS email,
        count(*) FILTER (WHERE m.channel = 'whatsapp')::int AS whatsapp,
        count(*) FILTER (WHERE m.delivered_at IS NOT NULL OR m.status = 'delivered')::int AS delivered,
        count(*) FILTER (WHERE m.read_at IS NOT NULL OR m.opened_at IS NOT NULL)::int AS read,
        count(*) FILTER (WHERE m.first_clicked_at IS NOT NULL)::int AS clicked,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM orders o WHERE o.user_id = m.user_id AND o.status = 'completed' AND o.total_amount > 0
            AND o.created_at >= m.created_at AND o.created_at < m.created_at + interval '72 hours'))::int AS ordered
      FROM rev_messages m
      WHERE m.shadow = false AND m.status NOT IN ('skipped', 'failed', 'bounced', 'complained')
        AND m.created_at > now() - interval '7 days'
      GROUP BY 1, 2
    `.execute(db),
    sql<Row>`
      SELECT playbook_key, next_step AS step, count(*)::int AS waiting
      FROM rev_enrolments WHERE state = 'active' AND is_holdout = false
      GROUP BY 1, 2
    `.execute(db),
    sql<Row>`
      SELECT status::text AS status, error, count(*)::int AS n
      FROM rev_messages
      WHERE shadow = false AND created_at > now() - interval '7 days'
        AND (status IN ('failed', 'bounced', 'complained', 'skipped') OR error LIKE 'whatsapp failed:%')
      GROUP BY 1, 2
    `.execute(db),
    sql<Row>`
      SELECT m.channel::text AS channel, count(*)::int AS sent,
        count(*) FILTER (WHERE m.delivered_at IS NOT NULL OR m.status = 'delivered')::int AS delivered,
        count(*) FILTER (WHERE m.read_at IS NOT NULL OR m.opened_at IS NOT NULL)::int AS read,
        count(*) FILTER (WHERE m.first_clicked_at IS NOT NULL)::int AS clicked,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM orders o WHERE o.user_id = m.user_id AND o.status = 'completed' AND o.total_amount > 0
            AND o.created_at >= m.created_at AND o.created_at < m.created_at + interval '72 hours'))::int AS ordered,
        coalesce(sum(m.cost_paise), 0)::float / 100 AS cost
      FROM rev_messages m
      WHERE m.shadow = false AND m.status <> 'skipped' AND m.created_at > now() - interval '7 days'
      GROUP BY 1
    `.execute(db),
    sql<Row>`
      SELECT
        (SELECT count(*)::int FROM rev_messages WHERE shadow = false AND status NOT IN ('skipped', 'failed', 'bounced', 'complained')
           AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS sent,
        (SELECT count(*)::int FROM rev_messages WHERE shadow = false AND status IN ('failed', 'bounced', 'complained')
           AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS failed,
        (SELECT coalesce(sum(cost_rupees), 0)::float FROM rev_offers WHERE shadow = false
           AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS offer_rupees,
        (SELECT count(*)::int FROM orders WHERE attributed_message_id IS NOT NULL AND status = 'completed' AND total_amount > 0
           AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS orders,
        (SELECT coalesce(sum(total_amount), 0)::float FROM orders WHERE attributed_message_id IS NOT NULL AND status = 'completed'
           AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS order_amount
    `.execute(db),
    sql<Row>`
      SELECT
        count(*) FILTER (WHERE next_due_at < now() + interval '1 hour')::int AS next_hour,
        count(*) FILTER (WHERE next_due_at < now() + interval '24 hours')::int AS next_day,
        count(*)::int AS active
      FROM rev_enrolments WHERE state = 'active' AND is_holdout = false
    `.execute(db),
  ]);

  const byHour = new Map<number, OperationsHour>();
  for (let t = firstHour.getTime(); t <= lastHour.getTime(); t += hourMs) {
    byHour.set(t, {
      hour: new Date(t),
      future: t > currentHour.getTime(),
      emailDelivered: 0,
      whatsappDelivered: 0,
      awaitingReceipt: 0,
      failed: 0,
      skipped: 0,
      scheduled: 0,
    });
  }
  for (const row of pastHours.rows) {
    const slot = byHour.get(date(row, "hour")?.getTime() ?? -1);
    if (!slot) continue;
    slot.emailDelivered = num(row, "email_delivered");
    slot.whatsappDelivered = num(row, "whatsapp_delivered");
    slot.awaitingReceipt = num(row, "awaiting");
    slot.failed = num(row, "failed");
    slot.skipped = num(row, "skipped");
  }
  for (const row of futureHours.rows) {
    const due = date(row, "next_due_at");
    if (!due) continue;
    const sendAt = nextSendTime(new Date(Math.max(due.getTime(), now.getTime())), settings.sendWindowStartHour, settings.sendWindowEndHour);
    const slot = byHour.get(Math.floor(sendAt.getTime() / hourMs) * hourMs);
    if (slot) slot.scheduled += 1;
  }

  const stepRows = new Map(steps.rows.map((row) => [`${pick(row, "playbook_key")}:${num(row, "step")}`, row]));
  const waitingRows = new Map(waiting.rows.map((row) => [`${pick(row, "playbook_key")}:${num(row, "step")}`, num(row, "waiting")]));
  const stepList: OperationsStep[] = AUTOPILOT_PLAYBOOKS.flatMap((playbook) =>
    playbook.steps.map((step, index) => {
      const row = stepRows.get(`${playbook.key}:${index + 1}`);
      return {
        playbook: playbook.key,
        label: playbook.label,
        step: index + 1,
        offer: Boolean(step.offer),
        delayHours: Math.round(step.delayMinutes / 6) / 10,
        waiting: waitingRows.get(`${playbook.key}:${index + 1}`) ?? 0,
        sent: num(row, "sent"),
        email: num(row, "email"),
        whatsapp: num(row, "whatsapp"),
        delivered: num(row, "delivered"),
        read: num(row, "read"),
        clicked: num(row, "clicked"),
        ordered: num(row, "ordered"),
      };
    })
  );

  const reasonMap = new Map<string, OperationsReason>();
  for (const row of reasons.rows) {
    const status = String(pick(row, "status") ?? "");
    const error = (pick(row, "error") as string | null) ?? null;
    if (status === "skipped" && error === "shadow") continue;
    const base = classify(error, status);
    const existing = reasonMap.get(base.key);
    if (existing) existing.count += num(row, "n");
    else reasonMap.set(base.key, { ...base, count: num(row, "n") });
  }

  const t = today.rows[0];
  const q = queue.rows[0];
  return {
    generatedAt: now,
    enabled: settings.enabled,
    shadow: settings.shadow,
    sendWindow: { start: settings.sendWindowStartHour, end: settings.sendWindowEndHour },
    lastRun: lastRun.rows[0] ? toRun(lastRun.rows[0]) : null,
    runs: runs.rows.map(toRun),
    hours: [...byHour.values()],
    steps: stepList,
    reasons: [...reasonMap.values()].sort((a, b) => b.count - a.count),
    channels: channels.rows.map((row) => ({
      channel: String(pick(row, "channel") ?? ""),
      sent: num(row, "sent"),
      delivered: num(row, "delivered"),
      read: num(row, "read"),
      clicked: num(row, "clicked"),
      ordered: num(row, "ordered"),
      costRupees: num(row, "cost"),
    })),
    today: {
      sent: num(t, "sent"),
      failed: num(t, "failed"),
      offerRupees: num(t, "offer_rupees"),
      offerBudgetRupees: settings.dailyOfferBudgetRupees,
      ordersFromMessages: num(t, "orders"),
      orderAmount: num(t, "order_amount"),
    },
    queue: { nextHour: num(q, "next_hour"), next24Hours: num(q, "next_day"), activePeople: num(q, "active") },
  };
}
