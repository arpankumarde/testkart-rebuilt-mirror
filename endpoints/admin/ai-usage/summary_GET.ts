import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./summary_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin']);

    const url = new URL(request.url);
    const params = url.searchParams;

    const parsedInput = schema.parse({
      dateFrom: params.get("dateFrom") ? new Date(params.get("dateFrom") as string) : undefined,
      dateTo: params.get("dateTo") ? new Date(params.get("dateTo") as string) : undefined,
    });

    let baseQuery = db.selectFrom("aiGenerationLogs");
    if (parsedInput.dateFrom) {
      baseQuery = baseQuery.where("createdAt", ">=", parsedInput.dateFrom);
    }
    if (parsedInput.dateTo) {
      const toDate = new Date(parsedInput.dateTo);
      toDate.setDate(toDate.getDate() + 1);
      baseQuery = baseQuery.where("createdAt", "<", toDate);
    }

    // Overall status counts + avg duration in a single aggregate query
    const overallPromise = baseQuery
      .select([
        db.fn.countAll<string>().as("totalAttempts"),
        sql<string>`count(*) filter (where "ai_generation_logs"."status" = 'done')`.as("doneCount"),
        sql<string>`count(*) filter (where "ai_generation_logs"."status" = 'pending')`.as("pendingCount"),
        sql<string>`count(*) filter (where "ai_generation_logs"."status" = 'failed')`.as("failedCount"),
        sql<string>`avg("ai_generation_logs"."duration_ms") filter (where "ai_generation_logs"."duration_ms" is not null)`.as("avgDurationMs"),
        sql<string>`count(distinct "ai_generation_logs"."teacher_id")`.as("activeTeachersCount"),
      ])
      .executeTakeFirstOrThrow();

    // Breakdown by feature
    const byFeaturePromise = baseQuery
      .select([
        "feature",
        db.fn.countAll<string>().as("totalAttempts"),
        sql<string>`count(*) filter (where "ai_generation_logs"."status" = 'done')`.as("doneCount"),
        sql<string>`count(*) filter (where "ai_generation_logs"."status" = 'failed')`.as("failedCount"),
      ])
      .groupBy("feature")
      .execute();

    // Total teachers on the platform (for adoption rate)
    const totalTeachersPromise = db
      .selectFrom("users")
      .where("role", "=", "teacher")
      .select(db.fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow();

    // Daily trend for the last 14 days (independent of the date filter above, always recent)
    const trendStart = new Date();
    trendStart.setDate(trendStart.getDate() - 13);
    trendStart.setHours(0, 0, 0, 0);
    const dailyTrendPromise = db
      .selectFrom("aiGenerationLogs")
      .where("createdAt", ">=", trendStart)
      .select([
        sql<string>`to_char("ai_generation_logs"."created_at", 'YYYY-MM-DD')`.as("date"),
        db.fn.countAll<string>().as("count"),
      ])
      .groupBy(sql`to_char("ai_generation_logs"."created_at", 'YYYY-MM-DD')`)
      .execute();

    const [overall, byFeature, totalTeachersResult, dailyTrendRows] = await Promise.all([
      overallPromise,
      byFeaturePromise,
      totalTeachersPromise,
      dailyTrendPromise,
    ]);

    const totalAttempts = Number(overall.totalAttempts);
    const doneCount = Number(overall.doneCount);
    const pendingCount = Number(overall.pendingCount);
    const failedCount = Number(overall.failedCount);
    const activeTeachersCount = Number(overall.activeTeachersCount);
    const totalTeachersCount = Number(totalTeachersResult.count);
    const finishedCount = doneCount + failedCount;

    // Fill in any missing days in the 14-day window with zero counts
    const trendMap = new Map(dailyTrendRows.map(r => [r.date, Number(r.count)]));
    const dailyTrend: OutputType["dailyTrend"] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(trendStart);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyTrend.push({ date: key, count: trendMap.get(key) ?? 0 });
    }

    const summary: OutputType = {
      totalAttempts,
      doneCount,
      pendingCount,
      failedCount,
      successRate: finishedCount > 0 ? (doneCount / finishedCount) * 100 : 0,
      activeTeachersCount,
      totalTeachersCount,
      adoptionRate: totalTeachersCount > 0 ? (activeTeachersCount / totalTeachersCount) * 100 : 0,
      avgDurationMs: overall.avgDurationMs ? Math.round(Number(overall.avgDurationMs)) : null,
      byFeature: byFeature.map(f => ({
        feature: f.feature,
        totalAttempts: Number(f.totalAttempts),
        doneCount: Number(f.doneCount),
        failedCount: Number(f.failedCount),
      })),
      dailyTrend,
    };

    return new Response(superjson.stringify(summary));
  } catch (error) {
    console.error("[admin/ai-usage/summary_GET] Error fetching AI usage summary:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
