import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { getLessonAccessContext, LessonAccessError } from "../../../../helpers/mentorshipLessonAccess";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const url = new URL(request.url);
    const input = schema.parse({ kind: url.searchParams.get("kind"), id: url.searchParams.get("id") });

    await getLessonAccessContext(input.kind, input.id, user);

    let query = db.selectFrom("liveLessonMaterials").select(["id", "title", "fileUrl", "linkUrl", "createdAt"]);
    query =
      input.kind === "booking"
        ? query.where("mentorshipBookingId", "=", input.id)
        : query.where("groupLessonId", "=", input.id);

    const materials = await query.orderBy("createdAt", "desc").execute();

    const output: OutputType = { materials };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof LessonAccessError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error fetching classroom materials:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
