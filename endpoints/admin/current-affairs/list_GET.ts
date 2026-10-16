import superjson from "superjson";
import { sql } from "kysely";
import { schema, OutputType } from "./list_GET.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { currentAffairsServer } from "../../../helpers/currentAffairsServer";
import type { CurrentAffairsStatus } from "../../../helpers/schema";

const toInt = (value: string | null) => (value ? Number.parseInt(value, 10) : undefined);

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const params = new URL(request.url).searchParams;
    const input = schema.parse({
      search: params.get("search") || undefined,
      status: params.get("status") || undefined,
      contentType: params.get("contentType") || undefined,
      topicId: toInt(params.get("topicId")),
      examId: toInt(params.get("examId")),
      dateFrom: params.get("dateFrom") || undefined,
      dateTo: params.get("dateTo") || undefined,
      page: toInt(params.get("page")),
      limit: toInt(params.get("limit")),
    });

    await currentAffairsServer.promoteDue();

    let base = db.selectFrom("currentAffairsPosts as p");
    if (input.search) {
      const term = `%${input.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      base = base.where((eb) => eb.or([eb("p.title", "ilike", term), eb("p.slug", "ilike", term)]));
    }
    if (input.contentType) base = base.where("p.contentType", "=", input.contentType);
    for (const tagId of [input.topicId, input.examId]) {
      if (!tagId) continue;
      base = base.where((eb) =>
        eb.exists(
          eb
            .selectFrom("currentAffairsTagLinks as l")
            .select("l.id")
            .whereRef("l.postId", "=", "p.id")
            .where("l.tagId", "=", tagId)
        )
      );
    }
    const dated = sql`coalesce(p.publish_at, p.created_at)`;
    if (input.dateFrom) base = base.where(sql<boolean>`${dated} >= (${input.dateFrom}::date)::timestamp AT TIME ZONE 'Asia/Kolkata'`);
    if (input.dateTo) {
      base = base.where(sql<boolean>`${dated} < ((${input.dateTo}::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`);
    }

    const countRows = await base
      .select(["p.status", (eb) => eb.fn.countAll<string>().as("count")])
      .groupBy("p.status")
      .execute();
    const statusCounts: Record<CurrentAffairsStatus, number> = { draft: 0, scheduled: 0, published: 0, archived: 0 };
    for (const row of countRows) statusCounts[row.status] = Number(row.count);

    const filtered = input.status ? base.where("p.status", "=", input.status) : base;
    const total = input.status
      ? statusCounts[input.status]
      : Object.values(statusCounts).reduce((sum, n) => sum + n, 0);

    const posts = await filtered
      .leftJoin("admins as a", "a.id", "p.authorId")
      .leftJoin("currentAffairsQuizzes as q", "q.postId", "p.id")
      .select([
        "p.id",
        "p.title",
        "p.slug",
        "p.contentType",
        "p.status",
        "p.language",
        "p.coverImageUrl",
        "p.publishAt",
        "p.publishedAt",
        "p.createdAt",
        "p.updatedAt",
        "a.fullName as authorName",
        "q.questionCount",
        "q.isPublished as quizPublished",
        sql<string | null>`to_char(p.digest_date, 'YYYY-MM-DD')`.as("digestDate"),
        sql<number>`(select count(*)::int from current_affairs_items i where i.post_id = p.id)`.as("itemCount"),
      ])
      .orderBy(sql`coalesce(p.publish_at, p.updated_at)`, "desc")
      .orderBy("p.id", "desc")
      .limit(input.limit)
      .offset((input.page - 1) * input.limit)
      .execute();

    const ids = posts.map((p) => p.id);
    const tagRows = ids.length
      ? await db
          .selectFrom("currentAffairsTagLinks as l")
          .innerJoin("currentAffairsTags as t", "t.id", "l.tagId")
          .select(["l.postId", "t.kind", "t.name"])
          .distinct()
          .where("l.postId", "in", ids)
          .where("l.itemId", "is", null)
          .where("l.questionId", "is", null)
          .execute()
      : [];

    const rows = posts.map(({ questionCount, quizPublished, ...post }) => ({
      ...post,
      quiz: questionCount === null ? null : { questionCount, isPublished: !!quizPublished },
      tags: tagRows.filter((t) => t.postId === post.id).map(({ kind, name }) => ({ kind, name })),
    }));

    return new Response(
      superjson.stringify({
        rows,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.limit)),
        statusCounts,
      } satisfies OutputType)
    );
  } catch (error) {
    return currentAffairsServer.errorResponse(error, "Error listing current affairs");
  }
}