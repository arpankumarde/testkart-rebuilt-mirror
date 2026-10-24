import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { promoCodeUsesSql } from "../../../helpers/promoCodeUsage";
import { schema, OutputType, PromoAnalyticsRange, PromoCodeAnalyticsRow } from "./promo-analytics_GET.schema";

const RANGE_DAYS: Record<PromoAnalyticsRange, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
  all: null,
};

const num = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const { range } = schema.parse({ range: url.searchParams.get("range") ?? undefined });
    const days = RANGE_DAYS[range];
    const since = days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    /* Subscription codes discount teacher plans, not student orders, so they stay on the Subscriptions page. */
    const codes = await db
      .selectFrom("promoCodes")
      .leftJoin("users as teacher", "teacher.id", "promoCodes.createdByTeacherId")
      .select([
        "promoCodes.id",
        "promoCodes.code",
        "promoCodes.description",
        "promoCodes.appliesTo",
        "promoCodes.discountType",
        "promoCodes.discountValue",
        "promoCodes.maxDiscountAmount",
        "promoCodes.isActive",
        "promoCodes.isPublic",
        "promoCodes.validFrom",
        "promoCodes.validUntil",
        "promoCodes.usageLimit",
        "promoCodes.createdAt",
        "promoCodes.createdByTeacherId",
        "teacher.displayName as teacherName",
        promoCodeUsesSql().as("usesHeld"),
      ])
      .where("promoCodes.appliesTo", "!=", "subscription")
      .orderBy("promoCodes.createdAt", "desc")
      .execute();

    let statsQuery = db
      .selectFrom("orders")
      .select([
        "orders.promoCodeId",
        sql<number>`count(*)::int`.as("attempts"),
        sql<number>`count(*) filter (where orders.status = 'completed')::int`.as("completed"),
        sql<number>`count(*) filter (where orders.status = 'completed' and orders.total_amount > 0)::int`.as("paidCompleted"),
        sql<number>`count(*) filter (where orders.status = 'completed' and orders.total_amount <= 0)::int`.as("freeCompleted"),
        sql<number>`count(*) filter (where orders.status = 'pending')::int`.as("pending"),
        sql<number>`count(*) filter (where orders.status = 'failed')::int`.as("failed"),
        sql<number>`count(*) filter (where orders.status = 'cancelled')::int`.as("cancelled"),
        sql<number>`count(*) filter (where orders.status = 'refunded')::int`.as("refunded"),
        sql<number>`coalesce(sum(orders.total_amount) filter (where orders.status = 'completed'), 0)::float8`.as("revenue"),
        sql<number>`coalesce(sum(orders.discount_amount) filter (where orders.status = 'completed'), 0)::float8`.as("discountGiven"),
        sql<number>`count(distinct orders.user_id) filter (where orders.status = 'completed')::int`.as("students"),
        sql<Date | null>`max(orders.created_at)`.as("lastOrderAt"),
      ])
      .where("orders.promoCodeId", "is not", null)
      .groupBy("orders.promoCodeId");
    if (since) statsQuery = statsQuery.where("orders.createdAt", ">=", since);

    let totalsQuery = db
      .selectFrom("orders")
      .select([
        sql<number>`count(distinct orders.user_id) filter (where orders.promo_code_id is not null and orders.status = 'completed')::int`.as("students"),
        sql<number>`count(*) filter (where orders.status = 'completed' and orders.total_amount > 0)::int`.as("paidOrdersAll"),
        sql<number>`coalesce(sum(orders.total_amount) filter (where orders.status = 'completed' and orders.total_amount > 0), 0)::float8`.as("paidRevenueAll"),
      ]);
    if (since) totalsQuery = totalsQuery.where("orders.createdAt", ">=", since);

    const [stats, totals] = await Promise.all([statsQuery.execute(), totalsQuery.executeTakeFirst()]);
    const statsByCode = new Map(stats.map((s) => [s.promoCodeId as number, s]));

    const rows: PromoCodeAnalyticsRow[] = codes.map((c) => {
      const s = statsByCode.get(c.id);
      return {
        id: c.id,
        code: c.code,
        description: c.description,
        ownerType: c.createdByTeacherId !== null ? "teacher" : "admin",
        ownerName: c.createdByTeacherId !== null ? c.teacherName ?? "Deleted teacher" : null,
        appliesTo: c.appliesTo,
        discountType: c.discountType,
        discountValue: num(c.discountValue),
        maxDiscountAmount: c.maxDiscountAmount !== null ? num(c.maxDiscountAmount) : null,
        isActive: c.isActive ?? false,
        isPublic: c.isPublic ?? false,
        validFrom: c.validFrom ?? null,
        validUntil: c.validUntil ?? null,
        usageLimit: c.usageLimit ?? null,
        usesHeld: num(c.usesHeld),
        createdAt: c.createdAt ?? null,
        attempts: num(s?.attempts),
        completed: num(s?.completed),
        paidCompleted: num(s?.paidCompleted),
        freeCompleted: num(s?.freeCompleted),
        pending: num(s?.pending),
        failed: num(s?.failed),
        cancelled: num(s?.cancelled),
        refunded: num(s?.refunded),
        revenue: num(s?.revenue),
        discountGiven: num(s?.discountGiven),
        students: num(s?.students),
        lastOrderAt: s?.lastOrderAt ? new Date(s.lastOrderAt) : null,
      };
    });

    const sum = (key: keyof PromoCodeAnalyticsRow) => rows.reduce((acc, r) => acc + num(r[key]), 0);
    const now = Date.now();

    const output: OutputType = {
      range,
      since,
      summary: {
        totalCodes: rows.length,
        activeCodes: rows.filter(
          (r) =>
            r.isActive &&
            (!r.validUntil || new Date(r.validUntil).getTime() > now) &&
            (r.usageLimit === null || r.usesHeld < r.usageLimit)
        ).length,
        codesUsed: rows.filter((r) => r.attempts > 0).length,
        attempts: sum("attempts"),
        completed: sum("completed"),
        paidCompleted: sum("paidCompleted"),
        freeCompleted: sum("freeCompleted"),
        dropped: sum("failed") + sum("cancelled"),
        revenue: Math.round(sum("revenue") * 100) / 100,
        discountGiven: Math.round(sum("discountGiven") * 100) / 100,
        students: num(totals?.students),
        paidOrdersAll: num(totals?.paidOrdersAll),
        paidRevenueAll: Math.round(num(totals?.paidRevenueAll) * 100) / 100,
      },
      codes: rows,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to load promo analytics:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to load promo analytics" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}