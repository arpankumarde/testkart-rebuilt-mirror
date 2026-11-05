import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./unenroll_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Only students can cancel their own enrollment." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      const lesson = await trx
        .selectFrom("groupLessons")
        .select(["id", "enrolledCount", "status"])
        .where("id", "=", input.groupLessonId)
        .forUpdate()
        .executeTakeFirst();
      if (!lesson) throw new Error("Group lesson not found.");

      const enrollment = await trx
        .selectFrom("groupLessonEnrollments")
        .select(["id", "status"])
        .where("groupLessonId", "=", input.groupLessonId)
        .where("studentId", "=", user.id)
        .executeTakeFirst();
      if (!enrollment || enrollment.status !== "enrolled") {
        throw new Error("You are not currently enrolled in this group lesson.");
      }

      await trx
        .updateTable("groupLessonEnrollments")
        .set({ status: "cancelled", cancelledAt: new Date() })
        .where("id", "=", enrollment.id)
        .execute();

      if (lesson.status === "scheduled") {
        await trx.updateTable("groupLessons").set({ enrolledCount: Math.max(0, lesson.enrolledCount - 1) }).where("id", "=", lesson.id).execute();
      }
    });

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Failed to cancel group lesson enrollment:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
