import { schema, OutputType } from "./messages_GET.schema";
import superjson from 'superjson';
import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { effectiveTeacherId, user } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    const input = schema.parse(searchParams);

    const thread = await db.selectFrom("supportThreads")
      .where("id", "=", input.threadId)
      .where("teacherId", "=", effectiveTeacherId)
      .selectAll()
      .executeTakeFirst();

    if (!thread) {
      return new Response(superjson.stringify({ error: "Thread not found" }), { status: 404 });
    }

    // Mark unread admin messages as read upon retrieval
    await db.updateTable("supportMessages")
      .set({ isRead: true })
      .where("threadId", "=", thread.id)
      .where("senderType", "=", "admin")
      .where("isRead", "=", false)
      .execute();

    const messages = await db.selectFrom("supportMessages")
      .where("threadId", "=", thread.id)
      .selectAll()
      .orderBy("createdAt", "asc")
      .execute();

    return new Response(superjson.stringify(messages satisfies OutputType));
  } catch (error) {
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}