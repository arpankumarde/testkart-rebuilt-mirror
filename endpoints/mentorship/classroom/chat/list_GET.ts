import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { getLessonAccessContext, LessonAccessError } from "../../../../helpers/mentorshipLessonAccess";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const url = new URL(request.url);
    const input = schema.parse({
      kind: url.searchParams.get("kind"),
      id: url.searchParams.get("id"),
      afterId: url.searchParams.get("afterId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    await getLessonAccessContext(input.kind, input.id, user);

    let query = db
      .selectFrom("liveLessonChatMessages")
      .innerJoin("users as sender", "sender.id", "liveLessonChatMessages.senderId")
      .select([
        "liveLessonChatMessages.id",
        "liveLessonChatMessages.senderId",
        "sender.displayName as senderName",
        "sender.avatarUrl as senderAvatarUrl",
        "liveLessonChatMessages.body",
        "liveLessonChatMessages.createdAt",
      ]);

    query =
      input.kind === "booking"
        ? query.where("liveLessonChatMessages.mentorshipBookingId", "=", input.id)
        : query.where("liveLessonChatMessages.groupLessonId", "=", input.id);

    if (input.afterId) {
      query = query.where("liveLessonChatMessages.id", ">", input.afterId);
    }

    const rows = await query
      .orderBy("liveLessonChatMessages.id", "asc")
      .limit(input.limit ?? 100)
      .execute();

    const output: OutputType = { messages: rows };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof LessonAccessError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error fetching classroom chat:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
