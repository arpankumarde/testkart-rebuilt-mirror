import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { schema, OutputType } from "./add_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const inserted = await db
      .insertInto("mentorshipBlockedDates")
      .values({ teacherId: effectiveTeacherId, blockedDate: input.blockedDate, reason: input.reason ?? null })
      .returning("id")
      .executeTakeFirstOrThrow();

    const output: OutputType = { id: inserted.id };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error adding mentorship blocked date:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
