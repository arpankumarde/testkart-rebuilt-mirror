import { schema, OutputType } from "./delete_POST.schema";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { db } from "../../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can delete work experiences" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Verify ownership
    const existing = await db
      .selectFrom("teacherWorkExperiences")
      .select("id")
      .where("id", "=", input.id)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!existing) {
      return new Response(
        superjson.stringify({ error: "Work experience not found or access denied" }),
        { status: 404 }
      );
    }

    await db
      .deleteFrom("teacherWorkExperiences")
      .where("id", "=", input.id)
      .execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500 }
    );
  }
}