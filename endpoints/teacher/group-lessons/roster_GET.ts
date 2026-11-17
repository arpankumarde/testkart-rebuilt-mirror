import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./roster_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const url = new URL(request.url);
    const input = schema.parse({ groupLessonId: url.searchParams.get("groupLessonId") });

    const lesson = await db
      .selectFrom("groupLessons")
      .select(["id", "teacherId"])
      .where("id", "=", input.groupLessonId)
      .executeTakeFirst();
    if (!lesson || (lesson.teacherId !== effectiveTeacherId && user.role !== "admin")) {
      return new Response(superjson.stringify({ error: "Group lesson not found" }), { status: 404 });
    }

    const rows = await db
      .selectFrom("groupLessonEnrollments")
      .innerJoin("students as student", "student.id", "groupLessonEnrollments.studentId")
      .select([
        "groupLessonEnrollments.id as enrollmentId",
        "student.id as studentId",
        "student.displayName as studentName",
        "student.avatarUrl as studentAvatarUrl",
        "student.email as studentEmail",
        "groupLessonEnrollments.status",
        "groupLessonEnrollments.amountPaid",
        "groupLessonEnrollments.enrolledAt",
      ])
      .where("groupLessonEnrollments.groupLessonId", "=", input.groupLessonId)
      .orderBy("groupLessonEnrollments.enrolledAt", "asc")
      .execute();

    const output: OutputType = { roster: rows.map((r) => ({ ...r, amountPaid: Number(r.amountPaid) })) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching group lesson roster:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
