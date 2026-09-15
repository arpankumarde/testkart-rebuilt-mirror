import { db } from '../../../helpers/db';
import { getAdminServerSessionOrThrow } from '../../../helpers/getAdminSession';
import { schema, OutputType } from "./trends_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const periodParam = url.searchParams.get("period");

    const { period } = schema.parse({ period: periodParam });
 
    const now = new Date();
    const cutoffMap = {
      daily: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      weekly: new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000),
      monthly: new Date(now.getFullYear(), now.getMonth() - 12, now.getDate()),
    };
    const cutoff = cutoffMap[period];

    const truncMapOrder = {
      daily: sql<Date>`date_trunc('day', created_at)`,
      weekly: sql<Date>`date_trunc('week', created_at)`,
      monthly: sql<Date>`date_trunc('month', created_at)`
    };

    const truncMapSub = {
      daily: sql<Date>`date_trunc('day', transaction_date)`,
      weekly: sql<Date>`date_trunc('week', transaction_date)`,
      monthly: sql<Date>`date_trunc('month', transaction_date)`
    };

    const [usersQuery, ordersQuery, subsQuery] = await Promise.all([
    db.selectFrom("users").
    select([
    truncMapOrder[period].as('periodDate'),
    sql<string>`COUNT(*) FILTER (WHERE role = 'teacher')`.as('teachers'),
    sql<string>`COUNT(*) FILTER (WHERE role = 'student')`.as('students'),
    sql<string>`COUNT(*)`.as('total')]
    ).
    where('createdAt', '>=', cutoff).
    groupBy(truncMapOrder[period]).
    orderBy(truncMapOrder[period], 'asc').
    execute(),

    db.selectFrom("orders").
    select([
    truncMapOrder[period].as('periodDate'),
    sql<string>`SUM(total_amount)`.as('revenue'),
    sql<string>`COUNT(*)`.as('orders')]
    ).
    where('status', '=', 'completed').
    where('createdAt', '>=', cutoff).
    groupBy(truncMapOrder[period]).
    execute(),

    db.selectFrom("subscriptionTransactions").
    select([
    truncMapSub[period].as('periodDate'),
    sql<string>`SUM(amount)`.as('revenue')]
    ).
    where('status', '=', 'completed').
    where('transactionDate', '>=', cutoff).
    groupBy(truncMapSub[period]).
    execute()]
    );

    const formatPeriod = (date: Date, p: "daily" | "weekly" | "monthly") => {
      if (p === "daily") {
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
      } else if (p === "weekly") {
        return `Week of ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}`;
      } else {
        return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
      }
    };

    const userGrowth = usersQuery.map((row) => {
      const pd = new Date(row.periodDate);
      return {
        period: formatPeriod(pd, period),
        teachers: Number(row.teachers || 0),
        students: Number(row.students || 0),
        total: Number(row.total || 0)
      };
    });

    const revenueMap = new Map<number, {periodDate: Date;revenue: number;orders: number;}>();

    for (const row of ordersQuery) {
      if (!row.periodDate) continue;
      const pd = new Date(row.periodDate);
      const time = pd.getTime();
      revenueMap.set(time, {
        periodDate: pd,
        revenue: Number(row.revenue || 0),
        orders: Number(row.orders || 0)
      });
    }

    for (const row of subsQuery) {
      if (!row.periodDate) continue;
      const pd = new Date(row.periodDate);
      const time = pd.getTime();
      if (revenueMap.has(time)) {
        const existing = revenueMap.get(time)!;
        existing.revenue += Number(row.revenue || 0);
      } else {
        revenueMap.set(time, {
          periodDate: pd,
          revenue: Number(row.revenue || 0),
          orders: 0
        });
      }
    }

    const revenueTrend = Array.from(revenueMap.values()).
    sort((a, b) => a.periodDate.getTime() - b.periodDate.getTime()).
    map((r) => ({
      period: formatPeriod(r.periodDate, period),
      revenue: r.revenue,
      orders: r.orders
    }));

    const output: OutputType = {
      userGrowth,
      revenueTrend
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error fetching admin dashboard trends:", error);
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401
      });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500
    });
  }
}