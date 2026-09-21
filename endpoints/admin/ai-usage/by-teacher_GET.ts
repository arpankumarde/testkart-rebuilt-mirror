import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./by-teacher_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const params = url.searchParams;

    const parsedInput = schema.parse({
      page: params.get("page") ? parseInt(params.get("page") as string, 10) : 1,
      pageSize: params.get("pageSize") ? parseInt(params.get("pageSize") as string, 10) : 20,
      dateFrom: params.get("dateFrom") ? new Date(params.get("dateFrom") as string) : undefined,
      dateTo: params.get("dateTo") ? new Date(params.get("dateTo") as string) : undefined,
      searchQuery: params.get("searchQuery") || undefined,
    });

    const { page, pageSize } = parsedInput;
    const offset = (page - 1) * pageSize;

    let baseQuery = db
      .selectFrom("aiGenerationLogs")
      .innerJoin("users", "users.id", "aiGenerationLogs.teacherId");

    if (parsedInput.dateFrom) {
      baseQuery = baseQuery.where("aiGenerationLogs.createdAt", ">=", parsedInput.dateFrom);
    }
    if (parsedInput.dateTo) {
      const toDate = new Date(parsedInput.dateTo);
      toDate.setDate(toDate.getDate() + 1);
      baseQuery = baseQuery.where("aiGenerationLogs.createdAt", "<", toDate);
    }
    if (parsedInput.searchQuery) {
      const q = parsedInput.searchQuery;
      baseQuery = baseQuery.where(eb =>
        eb.or([
          eb("users.displayName", "ilike", `%${q}%`),
          eb("users.email", "ilike", `%${q}%`),
          eb("users.academyName", "ilike", `%${q}%`),
        ])
      );
    }

    const totalDistinctTeachersPromise = baseQuery
      .select(sql<string>`count(distinct "ai_generation_logs"."teacher_id")`.as("total"))
      .executeTakeFirstOrThrow();

    const rowsPromise = baseQuery
      .groupBy(["users.id", "users.displayName", "users.academyName", "users.email", "users.isVerified"])
      .select([
        "users.id as teacherId",
        "users.displayName as teacherName",
        "users.academyName",
        "users.email",
        "users.isVerified",
        db.fn.countAll<string>().as("totalAttempts"),
        sql<string>`count(*) filter (where "ai_generation_logs"."status" = 'done')`.as("doneCount"),
        sql<string>`count(*) filter (where "ai_generation_logs"."status" = 'pending')`.as("pendingCount"),
        sql<string>`count(*) filter (where "ai_generation_logs"."status" = 'failed')`.as("failedCount"),
        sql<Date>`max("ai_generation_logs"."created_at")`.as("lastUsedAt"),
      ])
      .orderBy(sql`count(*)`, "desc")
      .limit(pageSize)
      .offset(offset)
      .execute();

    const [totalResult, rows] = await Promise.all([totalDistinctTeachersPromise, rowsPromise]);

    const total = Number(totalResult.total);
    const totalPages = Math.ceil(total / pageSize);

    const teachers: OutputType["teachers"] = rows.map(r => ({
      teacherId: r.teacherId,
      teacherName: r.teacherName,
      academyName: r.academyName,
      email: r.email ?? "",
      isVerified: r.isVerified,
      totalAttempts: Number(r.totalAttempts),
      doneCount: Number(r.doneCount),
      pendingCount: Number(r.pendingCount),
      failedCount: Number(r.failedCount),
      lastUsedAt: new Date(r.lastUsedAt).toISOString(),
    }));

    return new Response(
      superjson.stringify({
        teachers,
        pagination: { total, page, pageSize, totalPages },
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/ai-usage/by-teacher_GET] Error fetching AI usage by teacher:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
