import { sql } from "kysely";
import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { getLessonAccessContext, LessonAccessError } from "../../../../helpers/mentorshipLessonAccess";
import { schema, OutputType } from "./save_POST.schema";
import superjson from "superjson";

/** Keeps one request well under the 6 MB serverless body limit. */
const MAX_BODY_CHARS = 4_000_000;

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) {
      return new Response(superjson.stringify({ error: "The board is too full to save. Clear some of it and keep going." }), { status: 413 });
    }
    const input = schema.parse(superjson.parse(text));

    const ctx = await getLessonAccessContext(input.kind, input.id, user, effectiveTeacherId);
    // Students only watch the board, so only the teacher's copy is saved.
    if (ctx.viewerRole !== "teacher") {
      return new Response(superjson.stringify({ error: "Only the teacher saves the whiteboard." }), { status: 403 });
    }

    const parent = input.kind === "booking" ? sql.ref("mentorship_booking_id") : sql.ref("group_lesson_id");
    const result = await sql<{ updatedAt: Date }>`
      insert into live_lesson_whiteboards (${parent}, ops, updated_by, updated_at)
      values (${input.id}::uuid, ${JSON.stringify(input.ops)}::jsonb, ${user.id}, now())
      on conflict (${parent}) where ${parent} is not null
      do update set ops = excluded.ops, updated_by = excluded.updated_by, updated_at = now()
      returning updated_at
    `.execute(db);

    const output: OutputType = { ok: true, updatedAt: result.rows[0]?.updatedAt ?? new Date() };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof LessonAccessError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error saving classroom whiteboard:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
