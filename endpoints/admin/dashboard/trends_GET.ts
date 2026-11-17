import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, type OutputType, type TrendBucket, type TrendPeriod } from "./trends_GET.schema";

const IST = "Asia/Kolkata";

const UNITS: Record<TrendPeriod, { unit: "day" | "week" | "month"; count: number }> = {
  daily: { unit: "day", count: 30 },
  weekly: { unit: "week", count: 12 },
  monthly: { unit: "month", count: 12 },
};

type Row = Record<string, unknown>;

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const get = (row: Row, key: string): unknown => row[key] ?? row[toCamel(key)];
const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The legacy string labels kept for the MCP trends tool. */
const legacyLabel = (start: string, period: TrendPeriod) => {
  const [y, m, d] = start.split("-").map(Number);
  if (period === "monthly") return `${MONTHS[m - 1]} ${y}`;
  if (period === "weekly") return `Week of ${MONTHS[m - 1]} ${d}`;
  return `${MONTHS[m - 1]} ${d}`;
};

/** Revenue, orders and sign-ups per day, week or month in IST, every bucket present even when empty. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const { period } = schema.parse({ period: url.searchParams.get("period") });
    const { unit, count } = UNITS[period];
    const unitLit = sql.lit(unit);
    const span = sql.lit(`${count - 1} ${unit}`);
    const step = sql.lit(`1 ${unit}`);

    const result = await sql<Row>`
      WITH series AS (
        SELECT generate_series(
          date_trunc(${unitLit}, now() AT TIME ZONE ${IST}) - ${span}::interval,
          date_trunc(${unitLit}, now() AT TIME ZONE ${IST}),
          ${step}::interval
        ) AS b
      ),
      lo AS (SELECT min(b) AT TIME ZONE ${IST} AS since FROM series),
      o AS (
        SELECT date_trunc(${unitLit}, orders.created_at AT TIME ZONE ${IST}) AS b,
               sum(orders.total_amount) AS revenue, count(*) AS orders
        FROM orders, lo
        WHERE orders.status = 'completed' AND orders.gateway_env IS DISTINCT FROM 'sandbox' AND orders.created_at >= lo.since
        GROUP BY 1
      ),
      s AS (
        SELECT date_trunc(${unitLit}, st.transaction_date AT TIME ZONE ${IST}) AS b, sum(st.amount) AS revenue
        FROM subscription_transactions st, lo
        WHERE st.status = 'completed' AND st.transaction_date >= lo.since
        GROUP BY 1
      ),
      u AS (
        SELECT date_trunc(${unitLit}, accounts.created_at AT TIME ZONE ${IST}) AS b,
               count(*) FILTER (WHERE accounts.role = 'student') AS students,
               count(*) FILTER (WHERE accounts.role = 'teacher') AS teachers
        FROM accounts, lo
        WHERE accounts.created_at >= lo.since
        GROUP BY 1
      )
      SELECT to_char(series.b, 'YYYY-MM-DD') AS start,
             coalesce(o.revenue, 0) + coalesce(s.revenue, 0) AS revenue,
             coalesce(o.orders, 0) AS orders,
             coalesce(u.students, 0) AS students,
             coalesce(u.teachers, 0) AS teachers
      FROM series
      LEFT JOIN o ON o.b = series.b
      LEFT JOIN s ON s.b = series.b
      LEFT JOIN u ON u.b = series.b
      ORDER BY series.b
    `.execute(db);

    const buckets: TrendBucket[] = result.rows.map((row) => ({
      start: String(get(row, "start")),
      revenue: num(get(row, "revenue")),
      orders: num(get(row, "orders")),
      students: num(get(row, "students")),
      teachers: num(get(row, "teachers")),
    }));

    const output: OutputType = {
      period,
      buckets,
      userGrowth: buckets.map((b) => ({
        period: legacyLabel(b.start, period),
        teachers: b.teachers,
        students: b.students,
        total: b.teachers + b.students,
      })),
      revenueTrend: buckets.map((b) => ({ period: legacyLabel(b.start, period), revenue: b.revenue, orders: b.orders })),
    };

    return new Response(superjson.stringify(output), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error fetching admin dashboard trends:", error);
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return new Response(superjson.stringify({ error: error.message }), { status: 403 });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}