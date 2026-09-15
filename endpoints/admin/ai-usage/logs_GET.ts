import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./logs_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin']);

    const url = new URL(request.url);
    const params = url.searchParams;

    const parsedInput = schema.parse({
      page: params.get("page") ? parseInt(params.get("page") as string, 10) : 1,
      pageSize: params.get("pageSize") ? parseInt(params.get("pageSize") as string, 10) : 20,
      status: params.get("status") || undefined,
      feature: params.get("feature") || undefined,
      teacherId: params.get("teacherId") ? parseInt(params.get("teacherId") as string, 10) : undefined,
      searchQuery: params.get("searchQuery") || undefined,
      dateFrom: params.get("dateFrom") ? new Date(params.get("dateFrom") as string) : undefined,
      dateTo: params.get("dateTo") ? new Date(params.get("dateTo") as string) : undefined,
    });

    const { page, pageSize } = parsedInput;
    const offset = (page - 1) * pageSize;

    let query = db
      .selectFrom("aiGenerationLogs")
      .innerJoin("users", "users.id", "aiGenerationLogs.teacherId");

    if (parsedInput.status) {
      query = query.where("aiGenerationLogs.status", "=", parsedInput.status);
    }
    if (parsedInput.feature) {
      query = query.where("aiGenerationLogs.feature", "=", parsedInput.feature);
    }
    if (parsedInput.teacherId) {
      query = query.where("aiGenerationLogs.teacherId", "=", parsedInput.teacherId);
    }
    if (parsedInput.searchQuery) {
      const q = parsedInput.searchQuery;
      query = query.where(eb =>
        eb.or([
          eb("users.displayName", "ilike", `%${q}%`),
          eb("users.email", "ilike", `%${q}%`),
        ])
      );
    }
    if (parsedInput.dateFrom) {
      query = query.where("aiGenerationLogs.createdAt", ">=", parsedInput.dateFrom);
    }
    if (parsedInput.dateTo) {
      const toDate = new Date(parsedInput.dateTo);
      toDate.setDate(toDate.getDate() + 1);
      query = query.where("aiGenerationLogs.createdAt", "<", toDate);
    }

    const logsQuery = query
      .select([
        "aiGenerationLogs.id",
        "aiGenerationLogs.teacherId",
        "users.displayName as teacherName",
        "aiGenerationLogs.feature",
        "aiGenerationLogs.status",
        "aiGenerationLogs.errorMessage",
        "aiGenerationLogs.durationMs",
        "aiGenerationLogs.createdAt",
        "aiGenerationLogs.completedAt",
      ])
      .orderBy("aiGenerationLogs.createdAt", "desc")
      .limit(pageSize)
      .offset(offset);

    const countQuery = query.select(db.fn.countAll<string>().as("total"));

    const [rows, countResult] = await Promise.all([
      logsQuery.execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    const total = Number(countResult.total);
    const totalPages = Math.ceil(total / pageSize);

    const logs: OutputType["logs"] = rows.map(r => ({
      id: r.id,
      teacherId: r.teacherId,
      teacherName: r.teacherName,
      feature: r.feature,
      status: r.status,
      errorMessage: r.errorMessage,
      durationMs: r.durationMs,
      createdAt: new Date(r.createdAt).toISOString(),
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
    }));

    return new Response(
      superjson.stringify({
        logs,
        pagination: { total, page, pageSize, totalPages },
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/ai-usage/logs_GET] Error fetching AI usage logs:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
