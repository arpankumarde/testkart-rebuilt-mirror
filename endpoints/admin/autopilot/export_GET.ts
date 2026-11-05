import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema } from "./export_GET.schema";

type Row = Record<string, unknown>;

const COLUMNS = [
  "day",
  "item_viewers",
  "cart_clickers",
  "signed_out_cart_clickers",
  "signups",
  "logins",
  "checkout_users",
  "paid_users",
  "paid_orders",
  "gmv",
  "attributed_orders",
  "attributed_gmv",
  "messages_sent",
  "message_cost_rupees",
] as const;

const cell = (row: Row, snake: string): string => {
  const value = row[snake] ?? row[snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
  if (value === null || value === undefined) return "0";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/[",\n]/g, " ");
};

/** Admin (autopilot module): the Autopilot page's daily figures as CSV, days in IST. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const { days } = schema.parse({ days: new URL(request.url).searchParams.get("days") ?? undefined });

    const result = await sql<Row>`
      WITH d AS (
        SELECT generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date - (${days}::int - 1),
                               (now() AT TIME ZONE 'Asia/Kolkata')::date, interval '1 day')::date AS day
      ),
      fe AS (
        SELECT (occurred_at AT TIME ZONE 'Asia/Kolkata')::date AS day, event, visitor_id, user_id, amount, props
        FROM funnel_events
        WHERE occurred_at >= now() - make_interval(days => ${days} + 1)
      ),
      o AS (
        SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, total_amount, attributed_message_id
        FROM orders
        WHERE status = 'completed' AND total_amount > 0 AND created_at >= now() - make_interval(days => ${days} + 1)
      ),
      m AS (
        SELECT (sent_at AT TIME ZONE 'Asia/Kolkata')::date AS day, cost_paise
        FROM rev_messages
        WHERE shadow = false AND sent_at >= now() - make_interval(days => ${days} + 1)
      )
      SELECT d.day,
        (SELECT count(DISTINCT session_id) FROM storefront_events s
          WHERE s.event_type = 'view' AND (s.bucket_hour AT TIME ZONE 'Asia/Kolkata')::date = d.day) AS item_viewers,
        (SELECT count(DISTINCT coalesce(visitor_id, user_id::text)) FROM fe WHERE fe.day = d.day AND event = 'add_to_cart_click') AS cart_clickers,
        (SELECT count(DISTINCT coalesce(visitor_id, user_id::text)) FROM fe WHERE fe.day = d.day AND event = 'add_to_cart_click' AND props->>'signedIn' = 'false') AS signed_out_cart_clickers,
        (SELECT count(DISTINCT user_id) FROM fe WHERE fe.day = d.day AND event = 'signup') AS signups,
        (SELECT count(DISTINCT user_id) FROM fe WHERE fe.day = d.day AND event = 'login') AS logins,
        (SELECT count(DISTINCT user_id) FROM fe WHERE fe.day = d.day AND event = 'checkout_started' AND amount > 0) AS checkout_users,
        (SELECT count(DISTINCT user_id) FROM fe WHERE fe.day = d.day AND event = 'payment_succeeded' AND amount > 0) AS paid_users,
        (SELECT count(*) FROM o WHERE o.day = d.day) AS paid_orders,
        (SELECT coalesce(sum(total_amount), 0) FROM o WHERE o.day = d.day) AS gmv,
        (SELECT count(*) FROM o WHERE o.day = d.day AND attributed_message_id IS NOT NULL) AS attributed_orders,
        (SELECT coalesce(sum(total_amount), 0) FROM o WHERE o.day = d.day AND attributed_message_id IS NOT NULL) AS attributed_gmv,
        (SELECT count(*) FROM m WHERE m.day = d.day) AS messages_sent,
        (SELECT (coalesce(sum(cost_paise), 0) / 100.0)::numeric(12, 2) FROM m WHERE m.day = d.day) AS message_cost_rupees
      FROM d ORDER BY d.day
    `.execute(db);

    const lines = [COLUMNS.join(","), ...result.rows.map((row) => COLUMNS.map((c) => cell(row, c)).join(","))];
    return new Response(lines.join("\n") + "\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="autopilot-${days}-days.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not export";
    const status = /authenticat/i.test(message) ? 401 : /access/i.test(message) ? 403 : 500;
    if (status === 500) console.error("Autopilot export failed:", error);
    return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
  }
}