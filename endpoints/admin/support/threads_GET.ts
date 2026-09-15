import { schema, OutputType } from "./threads_GET.schema";
import superjson from 'superjson';
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    const query = schema.parse(searchParams);

    // Left join: a closed teacher account leaves its threads with teacher_id null.
    let qb = db.selectFrom("supportThreads")
      .leftJoin("users", "users.id", "supportThreads.teacherId");

    if (query.status) {
      qb = qb.where("supportThreads.status", "=", query.status);
    }
    if (query.search) {
      qb = qb.where((eb) => eb.or([
        eb("users.displayName", "ilike", `%${query.search}%`),
        eb("users.email", "ilike", `%${query.search}%`)
      ]));
    }
    if (query.unread) {
      qb = qb.where(
        sql<boolean>`EXISTS (SELECT 1 FROM support_messages WHERE thread_id = support_threads.id AND sender_type = 'teacher' AND is_read = false)`
      );
    }

    const threads = await qb
      .select([
        "supportThreads.id",
        "supportThreads.subject",
        "supportThreads.status",
        "supportThreads.createdAt",
        "supportThreads.lastMessageAt",
        "supportThreads.updatedAt",
        "users.displayName as teacherName",
        "supportThreads.teacherId",
      ])
      .select(
        sql<number>`(SELECT COUNT(*) FROM support_messages WHERE thread_id = support_threads.id AND sender_type = 'teacher' AND is_read = false)`.as("unreadCount")
      )
      .select(
        sql<string>`(SELECT message_text FROM support_messages WHERE thread_id = support_threads.id ORDER BY created_at DESC LIMIT 1)`.as("latestMessage")
      )
      .orderBy("supportThreads.lastMessageAt", "desc")
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)
      .execute();

    const countResult = await qb
      .select((eb) => eb.fn.count<number>("supportThreads.id").as("count"))
      .executeTakeFirst();
    const totalCount = Number(countResult?.count || 0);

    const output: OutputType = {
      threads: threads.map(t => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt,
        lastMessageAt: t.lastMessageAt,
        updatedAt: t.updatedAt,
        teacherName: t.teacherName ?? "Deleted account",
        teacherId: t.teacherId,
        unreadCount: Number(t.unreadCount || 0),
        lastMessagePreview: t.latestMessage ? (t.latestMessage.length > 100 ? t.latestMessage.slice(0, 100) + '...' : t.latestMessage) : "",
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