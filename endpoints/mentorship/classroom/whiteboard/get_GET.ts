import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { getLessonAccessContext, LessonAccessError } from "../../../../helpers/mentorshipLessonAccess";
import type { WbOp } from "../../../../helpers/classroomWhiteboardTypes";
import { schema, OutputType } from "./get_GET.schema";
import superjson from "superjson";

const readOps = (value: unknown): WbOp[] => {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed) ? (parsed as WbOp[]) : [];
};

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const url = new URL(request.url);
    const input = schema.parse({ kind: url.searchParams.get("kind"), id: url.searchParams.get("id") });

    await getLessonAccessContext(input.kind, input.id, user, effectiveTeacherId);

    const row = await db
      .selectFrom("liveLessonWhiteboards")
      .select(["ops", "updatedAt"])
      .where(input.kind === "booking" ? "mentorshipBookingId" : "groupLessonId", "=", input.id)
      .executeTakeFirst();

    const output: OutputType = { ops: readOps(row?.ops), updatedAt: row?.updatedAt ?? null };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof LessonAccessError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error reading classroom whiteboard:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
