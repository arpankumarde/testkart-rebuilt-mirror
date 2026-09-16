import { schema, OutputType } from "./threads_GET.schema";
import superjson from 'superjson';
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

const PREVIEW_LENGTH = 140;

const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const toCount = (value: unknown) => Number(value ?? 0);

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    const query = schema.parse(searchParams);

    // Left join: a closed teacher account leaves its threads with teacher_id null.
    let base = db.selectFrom("supportThreads")
      .leftJoin("users", "users.id", "supportThreads.teacherId");

    if (query.threadId) {
      base = base.where("supportThreads.id", "=", query.threadId);
    }
    const search = query.search?.trim();
    if (search) {
      const pattern = `%${escapeLikePattern(search)}%`;
      base = base.where((eb) => eb.or([
        eb("users.displayName", "ilike", pattern),
        eb("users.email", "ilike", pattern),
        eb("supportThreads.subject", "ilike", pattern),
      ]));
    }

    const hasUnread = sql<boolean>`EXISTS (SELECT 1 FROM support_messages WHERE thread_id = support_threads.id AND sender_type = 'teacher' AND is_read = false)`;
    const statusMatch = query.status ? sql<boolean>`support_threads.status = ${query.status}` : sql<boolean>`true`;
    const unreadMatch = query.unread ? hasUnread : sql<boolean>`true`;

    const counts = await base
      .select([
        sql<string>`count(*) FILTER (WHERE ${unreadMatch})`.as("all"),
        sql<string>`count(*) FILTER (WHERE support_threads.status = 'open' AND ${unreadMatch})`.as("open"),
        sql<string>`count(*) FILTER (WHERE support_threads.status = 'resolved' AND ${unreadMatch})`.as("resolved"),
        sql<string>`count(*) FILTER (WHERE support_threads.status = 'closed' AND ${unreadMatch})`.as("closed"),
        sql<string>`count(*) FILTER (WHERE ${statusMatch} AND ${hasUnread})`.as("unread"),
        sql<string>`count(*) FILTER (WHERE ${statusMatch} AND ${unreadMatch})`.as("matching"),
      ])
      .executeTakeFirst();

    let listQuery = base;
    if (query.status) {
      listQuery = listQuery.where("supportThreads.status", "=", query.status);
    }
    if (query.unread) {
      listQuery = listQuery.where(hasUnread);
    }

    const threads = await listQuery
      .select([
        "supportThreads.id",
        "supportThreads.subject",
        "supportThreads.status",
        "supportThreads.createdAt",
        "supportThreads.lastMessageAt",
        "supportThreads.updatedAt",
        "users.displayName as teacherName",
        "users.email as teacherEmail",
        "supportThreads.teacherId",
      ])
      .select(
        sql<number>`(SELECT COUNT(*) FROM support_messages WHERE thread_id = support_threads.id AND sender_type = 'teacher' AND is_read = false)`.as("unreadCount")
      )
      .select(
        sql<string | null>`(SELECT CASE WHEN btrim(message_text) = '' THEN 'Sent a file' ELSE message_text END FROM support_messages WHERE thread_id = support_threads.id ORDER BY created_at DESC, id DESC LIMIT 1)`.as("latestMessage")
      )
      .select(
        sql<string | null>`(SELECT sender_type FROM support_messages WHERE thread_id = support_threads.id ORDER BY created_at DESC, id DESC LIMIT 1)`.as("lastSenderType")
      )
      .orderBy("supportThreads.lastMessageAt", "desc")
      .orderBy("supportThreads.id", "desc")
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)
      .execute();

    const preview = (text: string | null) => {
      if (!text) return "";
      const flat = text.replace(/\s+/g, " ").trim();
      return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH)}...` : flat;
    };

    const output: OutputType = {
      threads: threads.map(t => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt,
        lastMessageAt: t.lastMessageAt,
        updatedAt: t.updatedAt,
        teacherName: t.teacherName ?? "Deleted account",
        teacherEmail: t.teacherEmail ?? null,
        teacherId: t.teacherId,
        unreadCount: Number(t.unreadCount || 0),
        lastMessagePreview: preview(t.latestMessage),
        lastSenderType: t.lastSenderType ?? null,
      })),
      totalCount: toCount(counts?.matching),
      page: query.page,
      limit: query.limit,
      counts: {
        all: toCount(counts?.all),
        open: toCount(counts?.open),
        resolved: toCount(counts?.resolved),
        closed: toCount(counts?.closed),
        unread: toCount(counts?.unread),
      },
    };

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error) {
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}