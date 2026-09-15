import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Verify ownership
    const existing = await db
      .selectFrom("questionBank")
      .select("teacherId")
      .where("id", "=", input.questionId)
      .executeTakeFirst();

    if (!existing || existing.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "Question not found or access denied" }),
        { status: 404 }
      );
    }

    const { questionId, ...updateData } = input;

    const updatedQuestion = await db
      .updateTable("questionBank")
      .set(updateData)
      .where("id", "=", questionId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(updatedQuestion satisfies OutputType));
  } catch (error) {
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred" }), { status: 500 });
  }
}