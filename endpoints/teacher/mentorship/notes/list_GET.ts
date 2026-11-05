import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { getLessonAccessContext, LessonAccessError } from "../../../../helpers/mentorshipLessonAccess";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const url = new URL(request.url);
    const input = schema.parse({ kind: url.searchParams.get("kind"), lessonId: url.searchParams.get("lessonId") });

    const ctx = await getLessonAccessContext(input.kind, input.lessonId, user);
    if (ctx.viewerRole !== "teacher") {
      return new Response(superjson.stringify({ error: "Only the teacher can view notes for this session." }), { status: 403 });
    }

    let query = db.selectFrom("liveLessonTeacherNotes").select(["id", "studentId", "note", "createdAt", "updatedAt"]);
    query =
      input.kind === "booking"
        ? query.where("mentorshipBookingId", "=", input.lessonId)
        : query.where("groupLessonId", "=", input.lessonId);

    const notes = await query.orderBy("createdAt", "desc").execute();

    const output: OutputType = { notes };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof LessonAccessError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error fetching teacher notes:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
