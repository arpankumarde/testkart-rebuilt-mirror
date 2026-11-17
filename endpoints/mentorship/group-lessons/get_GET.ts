import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./get_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const input = schema.parse({ id: url.searchParams.get("id") });

    const row = await db
      .selectFrom("groupLessons")
      .innerJoin("teachers as teacher", "teacher.id", "groupLessons.teacherId")
      .select([
        "groupLessons.id",
        "groupLessons.title",
        "groupLessons.description",
        "groupLessons.subject",
        "groupLessons.level",
        "groupLessons.language",
        "groupLessons.startTime",
        "groupLessons.durationMinutes",
        "groupLessons.pricePerLearner",
        "groupLessons.maxCapacity",
        "groupLessons.enrolledCount",
        "groupLessons.status",
        "groupLessons.coverImageUrl",
        "teacher.id as teacherId",
        "teacher.displayName as teacherName",
        "teacher.avatarUrl as teacherAvatarUrl",
        "teacher.bio as teacherBio",
      ])
      .where("groupLessons.id", "=", input.id)
      .where("groupLessons.liveCourseId", "is", null)
      .executeTakeFirst();

    if (!row) {
      return new Response(superjson.stringify({ error: "Group lesson not found" }), { status: 404 });
    }

    let viewerEnrollmentStatus: "enrolled" | "cancelled" | "removed" | null = null;
    try {
      const { user } = await getServerUserSession(request);
      const enrollment = await db
        .selectFrom("groupLessonEnrollments")
        .select(["status"])
        .where("groupLessonId", "=", input.id)
        .where("studentId", "=", user.id)
        .orderBy("enrolledAt", "desc")
        .executeTakeFirst();
      if (enrollment) viewerEnrollmentStatus = enrollment.status as "enrolled" | "cancelled" | "removed";
    } catch {
      // Not signed in - fine, this endpoint is public.
    }

    const output: OutputType = {
      groupLesson: { ...row, pricePerLearner: Number(row.pricePerLearner), viewerEnrollmentStatus },
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching group lesson:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
