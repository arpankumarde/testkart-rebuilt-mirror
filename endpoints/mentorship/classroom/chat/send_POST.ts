import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { getLessonAccessContext, LessonAccessError } from "../../../../helpers/mentorshipLessonAccess";
import { schema, OutputType } from "./send_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Membership is re-checked on every message - chat history must never leak to someone no
    // longer a participant (e.g. a removed group-lesson learner).
    await getLessonAccessContext(input.kind, input.id, user);

    const values =
      input.kind === "booking"
        ? { mentorshipBookingId: input.id, groupLessonId: null }
        : { mentorshipBookingId: null, groupLessonId: input.id };

    const inserted = await db
      .insertInto("liveLessonChatMessages")
      .values({ ...values, senderId: user.id, body: input.body })
      .returning(["id", "createdAt"])
      .executeTakeFirstOrThrow();

    const output: OutputType = {
      message: {
        id: inserted.id,
        senderId: user.id,
        senderName: user.displayName,
        senderAvatarUrl: user.avatarUrl ?? null,
        body: input.body,
        createdAt: inserted.createdAt,
      },
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof LessonAccessError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error sending classroom chat message:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
