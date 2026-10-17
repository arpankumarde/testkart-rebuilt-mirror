import superjson from "superjson";
import { sql } from "kysely";
import { schema, OutputType } from "./list_GET.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { examNewsServer } from "../../../helpers/examNewsServer";
import type { ExamNewsStatus } from "../../../helpers/schema";

const toInt = (value: string | null) => (value ? Number.parseInt(value, 10) : undefined);

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const params = new URL(request.url).searchParams;
    const input = schema.parse({
      search: params.get("search") || undefined,
      status: params.get("status") || undefined,
      newsType: params.get("newsType") || undefined,
      examId: toInt(params.get("examId")),
      page: toInt(params.get("page")),
      limit: toInt(params.get("limit")),
    });

    await examNewsServer.promoteDue();

    let base = db.selectFrom("examNewsPosts as p");
    if (input.search) {
      const term = `%${input.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      base = base.where((eb) => eb.or([eb("p.title", "ilike", term), eb("p.slug", "ilike", term)]));
    }
    if (input.newsType) base = base.where("p.newsType", "=", input.newsType);
    if (input.examId) base = base.where("p.examId", "=", input.examId);

    const countRows = await base
      .select(["p.status", (eb) => eb.fn.countAll<string>().as("count")])
      .groupBy("p.status")
      .execute();
    const statusCounts: Record<ExamNewsStatus, number> = { draft: 0, scheduled: 0, published: 0, archived: 0 };
    for (const row of countRows) statusCounts[row.status] = Number(row.count);

    const filtered = input.status ? base.where("p.status", "=", input.status) : base;
    const total = input.status
      ? statusCounts[input.status]
      : Object.values(statusCounts).reduce((sum, n) => sum + n, 0);

    const rows = await filtered
      .leftJoin("admins as a", "a.id", "p.authorId")
      .leftJoin("exams as e", "e.id", "p.examId")
      .select([
        "p.id",
        "p.title",
        "p.slug",
        "p.newsType",
        "p.status",
        "p.heroImageUrl",
        "p.examId",
        "e.examName as examName",
        "a.fullName as authorName",
        "p.publishAt",
        "p.publishedAt",
        "p.createdAt",
        "p.updatedAt",
        sql<number>`(select count(*)::int from exam_news_key_dates d where d.post_id = p.id)`.as("keyDateCount"),
        sql<number>`(select count(*)::int from exam_news_corrections c where c.post_id = p.id)`.as("correctionCount"),
      ])
      .orderBy(sql`coalesce(p.publish_at, p.updated_at)`, "desc")
      .orderBy("p.id", "desc")
      .limit(input.limit)
      .offset((input.page - 1) * input.limit)
      .execute();

    return new Response(
      superjson.stringify({
        rows,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.limit)),
        statusCounts,
      } satisfies OutputType)
    );
  } catch (error) {
    return examNewsServer.errorResponse(error, "Error listing exam news");
  }
}