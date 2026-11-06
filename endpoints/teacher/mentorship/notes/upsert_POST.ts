import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { getLessonAccessContext, LessonAccessError } from "../../../../helpers/mentorshipLessonAccess";
import { schema, OutputType } from "./upsert_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const ctx = await getLessonAccessContext(input.kind, input.lessonId, user, effectiveTeacherId);
    if (ctx.viewerRole !== "teacher") {
      return new Response(superjson.stringify({ error: "Only the teacher can write notes for this session." }), { status: 403 });
    }

    if (input.id) {
      const existing = await db
        .selectFrom("liveLessonTeacherNotes")
        .select(["id", "teacherId"])
        .where("id", "=", input.id)
        .executeTakeFirst();
      if (!existing || existing.teacherId !== ctx.teacherId) {
        return new Response(superjson.stringify({ error: "Note not found" }), { status: 404 });
      }
      await db.updateTable("liveLessonTeacherNotes").set({ note: input.note, updatedAt: new Date() }).where("id", "=", input.id).execute();
      const output: OutputType = { id: input.id };
      return new Response(superjson.stringify(output));
    }

    const values =
      input.kind === "booking"
        ? { mentorshipBookingId: input.lessonId, groupLessonId: null }
        : { mentorshipBookingId: null, groupLessonId: input.lessonId };

    const inserted = await db
      .insertInto("liveLessonTeacherNotes")
      .values({ ...values, teacherId: ctx.teacherId, studentId: input.studentId ?? null, note: input.note })
      .returning("id")
      .executeTakeFirstOrThrow();

    const output: OutputType = { id: inserted.id };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof LessonAccessError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error saving teacher note:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
