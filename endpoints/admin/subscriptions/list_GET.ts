import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  OutputType,
  SubscriptionAdminView,
  SubscriptionStats,
  PlanBreakdownItem,
  SUBSCRIPTION_SORT_COLUMNS,
  SubscriptionSortColumn,
} from "./list_GET.schema";
import superjson from "superjson";
import { sql, RawBuilder } from "kysely";
import { SubscriptionStatus } from "../../../helpers/schema";

const SORT_EXPRESSIONS: Record<SubscriptionSortColumn, RawBuilder<unknown>> = {
  teacher: sql`lower(${sql.ref("u.displayName")})`,
  plan: sql`lower(${sql.ref("sp.name")})`,
  status: sql`CASE WHEN ts.status = 'active' AND ts.end_date IS NOT NULL AND ts.end_date < NOW() THEN 'expired' ELSE ts.status::text END`,
  started: sql`${sql.ref("ts.startDate")}`,
  renews: sql`${sql.ref("ts.nextChargeDate")}`,
  daysLeft: sql`COALESCE(ts.next_charge_date, ts.end_date)`,
};

const isSortColumn = (value: string | null): value is SubscriptionSortColumn =>
  value !== null && (SUBSCRIPTION_SORT_COLUMNS as readonly string[]).includes(value);

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;
    const planIdParam = url.searchParams.get("planId");
    const planId = planIdParam ? parseInt(planIdParam, 10) : undefined;
    const statusParam = url.searchParams.get("status") as SubscriptionStatus | null;
    const includeFree = url.searchParams.get("includeFree") === "true";
    const expiringWithin7Days = url.searchParams.get("expiringWithin7Days") === "true";
    const sortByParam = url.searchParams.get("sortBy");
    const sortBy = isSortColumn(sortByParam) ? sortByParam : undefined;
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    // Effective status SQL fragment: if status is 'active' but end_date has passed, treat as 'expired'
    const effectiveStatusSql = sql<SubscriptionStatus>`
CASE
WHEN ts.status = 'active' AND ts.end_date IS NOT NULL AND ts.end_date < NOW()
THEN 'expired'
ELSE ts.status::text::text
END
`;

    // --- Stats queries (always unfiltered by search/page, but always excludes Free Plan) ---
    const [statsResult, planBreakdownResult, freeCountResult] = await Promise.all([
      db
        .selectFrom("teacherSubscriptions as ts")
        .innerJoin("subscriptionPlans as sp", "sp.id", "ts.planId")
        .where(sql`sp.price`, ">", 0)
        .select([
          db.fn.countAll<string>().as("totalCount"),
          db.fn
            .count<string>(
              sql`CASE WHEN ${effectiveStatusSql} = 'active' THEN 1 END`
            )
            .as("activeCount"),
          db.fn
            .count<string>(
              sql`CASE WHEN ${effectiveStatusSql} = 'expired' THEN 1 END`
            )
            .as("expiredCount"),
          db.fn
            .count<string>(
              sql`CASE WHEN ${effectiveStatusSql} = 'cancelled' THEN 1 END`
            )
            .as("cancelledCount"),
        ])
        .executeTakeFirstOrThrow(),

      db
        .selectFrom("teacherSubscriptions as ts")
        .innerJoin("subscriptionPlans as sp", "sp.id", "ts.planId")
        .where(sql`sp.price`, ">", 0)
        .select([
          "ts.planId",
          "sp.name as planName",
          db.fn.countAll<string>().as("totalCount"),
          db.fn
            .count<string>(
              sql`CASE WHEN ${effectiveStatusSql} = 'active' THEN 1 END`
            )
            .as("activeCount"),
        ])
        .groupBy(["ts.planId", "sp.name"])
        .orderBy("ts.planId", "asc")
        .execute(),

      db
        .selectFrom("teacherSubscriptions as ts")
        .innerJoin("subscriptionPlans as sp", "sp.id", "ts.planId")
        .where(sql`sp.price`, "=", 0)
        .select(db.fn.countAll<string>().as("freeCount"))
        .executeTakeFirstOrThrow(),
    ]);

    const stats: SubscriptionStats = {
      totalSubscriptions: parseInt(statsResult.totalCount, 10),
      activeCount: parseInt(statsResult.activeCount, 10),
      expiredCount: parseInt(statsResult.expiredCount, 10),
      cancelledCount: parseInt(statsResult.cancelledCount, 10),
      freeTeachersCount: parseInt(freeCountResult.freeCount, 10),
      planBreakdown: planBreakdownResult.map((row): PlanBreakdownItem => ({
        planId: row.planId,
        planName: row.planName,
        activeCount: parseInt(row.activeCount, 10),
        totalCount: parseInt(row.totalCount, 10),
      })),
    };

    // --- Filtered subscriptions query ---
    // The base query already joins subscriptionPlans, so we can filter by price
    const baseQuery = db
      .selectFrom("teacherSubscriptions as ts")
      .innerJoin("users as u", "u.id", "ts.teacherId")
      .innerJoin("subscriptionPlans as sp", "sp.id", "ts.planId");

    // By default exclude Free Plan (price = 0), unless includeFree is requested or the
    // expiring filter is on - the Overview tile it mirrors counts free plans too
    const basePaidQuery = includeFree || expiringWithin7Days
      ? baseQuery
      : baseQuery.where(sql`sp.price`, ">", 0);

    // Effective status for the subscription rows
    const effectiveStatusColumn = sql<SubscriptionStatus>`
      CASE
        WHEN ts.status = 'active' AND ts.end_date IS NOT NULL AND ts.end_date < NOW()
        THEN 'expired'
        ELSE ts.status::text
      END
    `.as("effectiveStatus");

    // Effective platform fee: override if present, else plan's fee
    const effectivePlatformFeeColumn = sql<number>`
      COALESCE(ts.platform_fee_override, sp.platform_fee_percentage)
    `.as("platformFeePercentage");

    const unorderedQuery = basePaidQuery
      .select([
        "ts.id as subscriptionId",
        "u.id as teacherId",
        "u.displayName as teacherName",
        "u.email as teacherEmail",
        "sp.name as planName",
        effectiveStatusColumn,
        "ts.startDate",
        "ts.endDate",
        "ts.nextChargeDate as nextRenewalDate",
        "ts.autoRenew",
        sql<number>`CASE WHEN ts.next_charge_date IS NOT NULL THEN EXTRACT(DAY FROM ts.next_charge_date - NOW()) WHEN ts.end_date IS NOT NULL THEN EXTRACT(DAY FROM ts.end_date - NOW()) ELSE 0 END`.as(
          "daysUntilRenewal"
        ),
        effectivePlatformFeeColumn,
        "ts.platformFeeOverride",
        "ts.paymentMethod",
        "ts.adminNote",
      ]);

    // Empty values sink to the bottom whichever way a column is sorted
    const orderedQuery = sortBy
      ? unorderedQuery.orderBy(SORT_EXPRESSIONS[sortBy], sql`${sql.raw(sortOrder)} nulls last`)
      : unorderedQuery.orderBy("ts.createdAt", "desc");

    let subscriptionsQuery = orderedQuery
      .orderBy("ts.id", "desc")
      .limit(limit)
      .offset(offset);

    let countQuery = basePaidQuery.select((eb) =>
      eb.fn.countAll<string>().as("count")
    );

    if (search) {
      const searchQuery = `%${search}%`;
      subscriptionsQuery = subscriptionsQuery.where((eb) =>
        eb.or([
          eb("u.displayName", "ilike", searchQuery),
          eb("u.email", "ilike", searchQuery),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("u.displayName", "ilike", searchQuery),
          eb("u.email", "ilike", searchQuery),
        ])
      );
    }

    if (planId !== undefined) {
      subscriptionsQuery = subscriptionsQuery.where("ts.planId", "=", planId);
      countQuery = countQuery.where("ts.planId", "=", planId);
    }

    // Same condition as the Overview's expiring subscriptions tile. These rows end in the
    // future, so their effective status is always 'active'.
    if (expiringWithin7Days) {
      const expiringSql = sql<boolean>`ts.status = 'active' AND ts.end_date > now() AND ts.end_date <= now() + interval '7 days'`;
      subscriptionsQuery = subscriptionsQuery.where(expiringSql);
      countQuery = countQuery.where(expiringSql);
    }

    if (statusParam) {
      // Filter by effective status instead of raw ts.status
      subscriptionsQuery = subscriptionsQuery.where(
        sql`CASE WHEN ts.status = 'active' AND ts.end_date IS NOT NULL AND ts.end_date < NOW() THEN 'expired' ELSE ts.status::text END`,
        "=",
        statusParam
      );
      countQuery = countQuery.where(
        sql`CASE WHEN ts.status = 'active' AND ts.end_date IS NOT NULL AND ts.end_date < NOW() THEN 'expired' ELSE ts.status::text END`,
        "=",
        statusParam
      );
    }

    const [subscriptions, totalResult] = await Promise.all([
      subscriptionsQuery.execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    const totalCount = parseInt(totalResult.count, 10);
    const totalPages = Math.ceil(totalCount / limit);

    const mappedSubscriptions: SubscriptionAdminView[] = subscriptions.map((s) => ({
      subscriptionId: s.subscriptionId,
      teacherId: s.teacherId,
      teacherName: s.teacherName,
      teacherEmail: s.teacherEmail,
      planName: s.planName,
      status: s.effectiveStatus,
      startDate: s.startDate,
      endDate: s.endDate,
      nextRenewalDate: s.nextRenewalDate,
      autoRenew: !!s.autoRenew,
      daysUntilRenewal: Math.floor(Number(s.daysUntilRenewal || 0)),
      platformFeePercentage: Number(s.platformFeePercentage),
      platformFeeOverride: s.platformFeeOverride !== null ? Number(s.platformFeeOverride) : null,
      paymentMethod: s.paymentMethod,
      adminNote: s.adminNote,
      isAdminTrial: s.paymentMethod === "admin_trial",
    }));

    const output: OutputType = {
      subscriptions: mappedSubscriptions,
      totalCount,
      currentPage: page,
      totalPages,
      stats,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching subscriptions list:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}