import { schema, OutputType } from "./threads_GET.schema";
import superjson from 'superjson';
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { effectiveTeacherId, user } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    const query = schema.parse(searchParams);

    let scope = db.selectFrom("supportThreads")
      .where("teacherId", "=", effectiveTeacherId);
    if (query.unreadOnly) {
      scope = scope.where(
        sql<boolean>`EXISTS (SELECT 1 FROM support_messages m WHERE m.thread_id = support_threads.id AND m.sender_type = 'admin' AND m.is_read = false)`
      );
    }

    const threads = await scope
      .selectAll("supportThreads")
      .select(
        sql<number>`(SELECT COUNT(*) FROM support_messages WHERE thread_id = support_threads.id AND sender_type = 'admin' AND is_read = false)`.as("unreadCount")
      )
      .orderBy("lastMessageAt", "desc")
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)
      .execute();

    const countResult = await scope
      .select((eb) => eb.fn.count<number>("id").as("count"))
      .executeTakeFirst();
    
    const totalCount = Number(countResult?.count || 0);

    const output: OutputType = {
      threads: threads.map(t => ({
        ...t,
        unreadCount: Number(t.unreadCount || 0)
      })),
      totalCount,
      page: query.page,
      limit: query.limit,
    };

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error) {
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}