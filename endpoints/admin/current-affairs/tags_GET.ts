import superjson from "superjson";
import { sql } from "kysely";
import { OutputType } from "./tags_GET.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { currentAffairsServer } from "../../../helpers/currentAffairsServer";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const tags = await db
      .selectFrom("currentAffairsTags as t")
      .select([
        "t.id",
        "t.kind",
        "t.name",
        "t.slug",
        "t.isPredefined",
        "t.examId",
        sql<number>`(select count(distinct l.post_id)::int from current_affairs_tag_links l where l.tag_id = t.id)`.as(
          "usageCount"
        ),
      ])
      .orderBy("t.kind")
      .orderBy("t.isPredefined", "desc")
      .orderBy("t.sortOrder")
      .orderBy("t.name")
      .execute();

    return new Response(superjson.stringify({ tags } satisfies OutputType));
  } catch (error) {
    return currentAffairsServer.errorResponse(error, "Error listing current affairs tags");
  }
}