import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { getLessonAccessContext, LessonAccessError } from "../../../../helpers/mentorshipLessonAccess";
import { schema, OutputType } from "./add_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const ctx = await getLessonAccessContext(input.kind, input.id, user);
    if (ctx.viewerRole !== "teacher") {
      return new Response(superjson.stringify({ error: "Only the teacher can add materials." }), { status: 403 });
    }

    const values =
      input.kind === "booking"
        ? { mentorshipBookingId: input.id, groupLessonId: null }
        : { mentorshipBookingId: null, groupLessonId: input.id };

    const inserted = await db
      .insertInto("liveLessonMaterials")
      .values({
        ...values,
        teacherId: ctx.teacherId,
        title: input.title,
        fileUrl: input.fileUrl ?? null,
        fileId: input.fileId ?? null,
        linkUrl: input.linkUrl ?? null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const output: OutputType = { id: inserted.id };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof LessonAccessError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error adding classroom material:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
