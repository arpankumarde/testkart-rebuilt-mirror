import { schema, OutputType } from "./messages_GET.schema";
import superjson from 'superjson';
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    const input = schema.parse(searchParams);

    const thread = await db.selectFrom("supportThreads")
      .where("id", "=", input.threadId)
      .selectAll()
      .executeTakeFirst();

    if (!thread) {
      return new Response(superjson.stringify({ error: "Thread not found" }), { status: 404 });
    }

    // Mark unread teacher messages as read upon view
    await db.updateTable("supportMessages")
      .set({ isRead: true })
      .where("threadId", "=", thread.id)
      .where("senderType", "=", "teacher")
      .where("isRead", "=", false)
      .execute();

    const messages = await db.selectFrom("supportMessages")
      .leftJoin("users", (join) => join
        .onRef("users.id", "=", "supportMessages.senderId")
        .on("supportMessages.senderType", "=", "teacher")
      )
      .leftJoin("admins", (join) => join
        .onRef("admins.id", "=", "supportMessages.senderId")
        .on("supportMessages.senderType", "=", "admin")
      )
      .where("threadId", "=", thread.id)
      .select([
        "supportMessages.id",
        "supportMessages.threadId",
        "supportMessages.senderType",
        "supportMessages.senderId",
        "supportMessages.messageText",
        "supportMessages.isRead",
        "supportMessages.createdAt",
        "users.displayName as teacherName",
        "admins.fullName as adminName"
      ])
      .orderBy("supportMessages.createdAt", "asc")
      .execute();

    const formattedMessages = messages.map(m => ({
      id: m.id,
      threadId: m.threadId,
      senderType: m.senderType,
      senderId: m.senderId,
      messageText: m.messageText,
      isRead: m.isRead,
      createdAt: m.createdAt,
      senderName: m.senderType === 'teacher' ? (m.teacherName || 'Deleted account') : (m.adminName || 'Unknown Admin')
    }));

    return new Response(superjson.stringify(formattedMessages satisfies OutputType));
  } catch (error) {
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}