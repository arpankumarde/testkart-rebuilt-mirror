import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { AUTOPILOT_PLAYBOOKS } from "../../../helpers/autopilotPlaybooks";
import { schema, OutputType, LedgerMessage, LedgerPerson } from "./ledger_GET.schema";

const PAGE_SIZE = 50;

type Row = Record<string, unknown>;
/* Raw sql rows come back camelCased by the plugin; read either spelling. */
const pick = (row: Row, snake: string): unknown => {
  if (snake in row) return row[snake];
  return row[snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
};
const num = (row: Row, key: string) => Number(pick(row, key) ?? 0) || 0;
const numOrNull = (row: Row, key: string) => {
  const v = pick(row, key);
  return v === null || v === undefined ? null : Number(v);
};
const strOrNull = (row: Row, key: string) => {
  const v = pick(row, key);
  return v === null || v === undefined ? null : String(v);
};
const dateOrNull = (row: Row, key: string) => {
  const v = pick(row, key);
  return v === null || v === undefined ? null : new Date(v as string);
};

/**
 * Admin (autopilot module): the autopilot's ledger. "messages" lists every
 * message it created, with what happened to it (sent, skipped and why,
 * delivered, opened, clicked, the order it led to). "people" lists who is in
 * which playbook and when their next message is due. The summary covers the
 * last 24 hours of real (not shadow) activity.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams.entries()));
    const offset = (input.page - 1) * PAGE_SIZE;
    const like = input.q ? `%${input.q.replace(/[%_\\]/g, "\\$&")}%` : null;
    const userIdQuery = input.q && /^\d+$/.test(input.q) ? Number(input.q) : null;

    const userFilter = (alias: string) =>
      like
        ? userIdQuery !== null
          ? sql`AND (${sql.ref(`${alias}.user_id`)} = ${userIdQuery} OR u.display_name ILIKE ${like})`
          : sql`AND u.display_name ILIKE ${like}`
        : sql``;
    const playbookFilter = (alias: string) => (input.playbook ? sql`AND ${sql.ref(`${alias}.playbook_key`)} = ${input.playbook}` : sql``);

    let total = 0;
    let messages: LedgerMessage[] = [];
    let people: LedgerPerson[] = [];

    if (input.view === "messages") {
      const outcome = {
        all: sql`AND m.shadow = false`,
        sent: sql`AND m.shadow = false AND m.sent_at IS NOT NULL`,
        skipped: sql`AND m.shadow = false AND m.status = 'skipped'`,
        failed: sql`AND m.shadow = false AND m.status IN ('failed', 'bounced', 'complained')`,
        clicked: sql`AND m.shadow = false AND m.first_clicked_at IS NOT NULL`,
        ordered: sql`AND m.shadow = false AND EXISTS (SELECT 1 FROM orders o WHERE o.attributed_message_id = m.id AND o.status = 'completed')`,
        shadow: sql`AND m.shadow = true`,
      }[input.outcome];
      const where = sql`WHERE true ${outcome} ${playbookFilter("m")} ${input.channel ? sql`AND m.channel::text = ${input.channel}` : sql``} ${userFilter("m")}`;

      const count = await sql<Row>`SELECT count(*)::int AS n FROM rev_messages m LEFT JOIN students u ON u.id = m.user_id ${where}`.execute(db);
      total = num(count.rows[0] ?? {}, "n");

      const rows = await sql<Row>`
        SELECT m.id, m.created_at, m.sent_at, m.user_id, u.display_name AS user_name, m.playbook_key, m.step, m.variant_key,
               m.channel::text AS channel, m.template_key, m.status::text AS status, m.error, m.shadow, m.cost_paise,
               m.delivered_at, coalesce(m.opened_at, m.read_at) AS opened_at, m.first_clicked_at, m.click_count, m.replied_at,
               (SELECT ro.coins FROM rev_offers ro WHERE ro.message_id = m.id ORDER BY ro.id LIMIT 1) AS offer_coins,
               ord.id AS order_id, ord.total_amount AS order_amount
        FROM rev_messages m
        LEFT JOIN students u ON u.id = m.user_id
        LEFT JOIN LATERAL (
          SELECT o.id, o.total_amount FROM orders o
          WHERE o.attributed_message_id = m.id AND o.status = 'completed' ORDER BY o.id LIMIT 1
        ) ord ON true
        ${where}
        ORDER BY m.id DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `.execute(db);

      messages = rows.rows.map((r) => ({
        id: num(r, "id"),
        createdAt: new Date(pick(r, "created_at") as string),
        sentAt: dateOrNull(r, "sent_at"),
        userId: num(r, "user_id"),
        userName: strOrNull(r, "user_name"),
        playbook: String(pick(r, "playbook_key") ?? ""),
        step: num(r, "step"),
        variant: strOrNull(r, "variant_key"),
        channel: String(pick(r, "channel") ?? ""),
        template: strOrNull(r, "template_key"),
        status: String(pick(r, "status") ?? ""),
        reason: strOrNull(r, "error"),
        shadow: Boolean(pick(r, "shadow")),
        costRupees: num(r, "cost_paise") / 100,
        deliveredAt: dateOrNull(r, "delivered_at"),
        openedAt: dateOrNull(r, "opened_at"),
        clickedAt: dateOrNull(r, "first_clicked_at"),
        clicks: num(r, "click_count"),
        repliedAt: dateOrNull(r, "replied_at"),
        offerCoins: numOrNull(r, "offer_coins"),
        orderId: numOrNull(r, "order_id"),
        orderAmount: numOrNull(r, "order_amount"),
      }));
    } else {
      const state = {
        active: sql`AND e.state = 'active' AND e.is_holdout = false`,
        finished: sql`AND e.state <> 'active' AND e.is_holdout = false`,
        held_out: sql`AND e.is_holdout = true`,
      }[input.state];
      const where = sql`WHERE true ${state} ${playbookFilter("e")} ${userFilter("e")}`;

      const count = await sql<Row>`SELECT count(*)::int AS n FROM rev_enrolments e LEFT JOIN students u ON u.id = e.user_id ${where}`.execute(db);
      total = num(count.rows[0] ?? {}, "n");

      const rows = await sql<Row>`
        SELECT e.id, e.user_id, u.display_name AS user_name, e.playbook_key, e.is_holdout, e.state, e.exit_reason,
               e.next_step, e.next_due_at, e.trigger_at, e.converted_order_id, e.converted_at,
               (SELECT count(*)::int FROM rev_messages m WHERE m.user_id = e.user_id AND m.playbook_key = e.playbook_key
                  AND m.shadow = false AND m.sent_at IS NOT NULL AND m.created_at >= e.created_at) AS messages_sent,
               (SELECT max(m.sent_at) FROM rev_messages m WHERE m.user_id = e.user_id AND m.playbook_key = e.playbook_key
                  AND m.shadow = false AND m.created_at >= e.created_at) AS last_message_at
        FROM rev_enrolments e
        LEFT JOIN students u ON u.id = e.user_id
        ${where}
        ORDER BY ${input.state === "active" ? sql`e.next_due_at ASC NULLS LAST, e.id DESC` : sql`e.updated_at DESC NULLS LAST, e.id DESC`}
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `.execute(db);

      people = rows.rows.map((r) => ({
        enrolmentId: num(r, "id"),
        userId: num(r, "user_id"),
        userName: strOrNull(r, "user_name"),
        playbook: String(pick(r, "playbook_key") ?? ""),
        heldOut: Boolean(pick(r, "is_holdout")),
        state: String(pick(r, "state") ?? ""),
        exitReason: strOrNull(r, "exit_reason"),
        nextStep: numOrNull(r, "next_step"),
        nextDueAt: dateOrNull(r, "next_due_at"),
        triggerAt: new Date(pick(r, "trigger_at") as string),
        messagesSent: num(r, "messages_sent"),
        lastMessageAt: dateOrNull(r, "last_message_at"),
        convertedOrderId: numOrNull(r, "converted_order_id"),
        convertedAt: dateOrNull(r, "converted_at"),
      }));
    }

    const summaryRows = await sql<Row>`
      SELECT
        count(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent,
        count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
        count(*) FILTER (WHERE opened_at IS NOT NULL OR read_at IS NOT NULL)::int AS opened,
        count(*) FILTER (WHERE first_clicked_at IS NOT NULL)::int AS clicked,
        count(*) FILTER (WHERE status IN ('failed', 'bounced', 'complained'))::int AS failed,
        coalesce(sum(cost_paise), 0)::float AS paise
      FROM rev_messages WHERE shadow = false AND created_at >= now() - interval '24 hours'
    `.execute(db);
    const skippedRows = await sql<Row>`
      SELECT coalesce(error, 'no reason recorded') AS reason, count(*)::int AS n
      FROM rev_messages WHERE shadow = false AND status = 'skipped' AND created_at >= now() - interval '24 hours'
      GROUP BY 1 ORDER BY 2 DESC
    `.execute(db);
    const extraRows = await sql<Row>`
      SELECT
        (SELECT coalesce(sum(coins), 0)::int FROM rev_offers WHERE shadow = false AND created_at >= now() - interval '24 hours') AS coins,
        (SELECT count(*)::int FROM orders o JOIN rev_messages m ON m.id = o.attributed_message_id
           WHERE o.status = 'completed' AND o.created_at >= now() - interval '24 hours' AND m.shadow = false) AS orders,
        (SELECT coalesce(sum(o.total_amount), 0)::float FROM orders o JOIN rev_messages m ON m.id = o.attributed_message_id
           WHERE o.status = 'completed' AND o.created_at >= now() - interval '24 hours' AND m.shadow = false) AS order_amount,
        (SELECT count(*)::int FROM rev_enrolments WHERE state = 'active' AND is_holdout = false AND next_due_at <= now() + interval '1 hour') AS due_hour,
        (SELECT count(*)::int FROM rev_enrolments WHERE state = 'active' AND is_holdout = false AND next_due_at <= now() + interval '24 hours') AS due_day
    `.execute(db);
    const s = summaryRows.rows[0] ?? {};
    const x = extraRows.rows[0] ?? {};

    const out: OutputType = {
      view: input.view,
      page: input.page,
      pageSize: PAGE_SIZE,
      total,
      playbooks: AUTOPILOT_PLAYBOOKS.map((p) => ({ key: p.key, label: p.label })),
      summary: {
        sent: num(s, "sent"),
        delivered: num(s, "delivered"),
        opened: num(s, "opened"),
        clicked: num(s, "clicked"),
        failed: num(s, "failed"),
        skipped: skippedRows.rows.map((r) => ({ reason: String(pick(r, "reason") ?? ""), count: num(r, "n") })),
        costRupees: num(s, "paise") / 100,
        offerCoins: num(x, "coins"),
        orders: num(x, "orders"),
        orderAmount: num(x, "order_amount"),
        dueNextHour: num(x, "due_hour"),
        dueToday: num(x, "due_day"),
      },
      messages,
      people,
    };
    return new Response(superjson.stringify(out), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the ledger";
    const status = /authenticat/i.test(message) ? 401 : /access/i.test(message) ? 403 : 500;
    if (status === 500) console.error("Autopilot ledger failed:", error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
