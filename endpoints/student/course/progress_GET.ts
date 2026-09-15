import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./progress_GET.schema";
import superjson from "superjson";
import { z } from "zod";

const schema = z.object({
  courseId: z.coerce.number().int().positive(),
});

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId");
    const validation = schema.safeParse({ courseId });

    if (!validation.success) {
      return new Response(superjson.stringify({ error: "Invalid course ID" }), { status: 400 });
    }

    const enrollment = await db
      .selectFrom("courseEnrollments")
      .select(["id", "completionPercentage"])
      .where("courseId", "=", validation.data.courseId)
      .where("studentId", "=", user.id)
      .executeTakeFirst();

    if (!enrollment) {
      return new Response(superjson.stringify({ error: "Not enrolled in this course" }), { status: 403 });
    }

    const completedLessons = await db
      .selectFrom("courseProgress")
      .select("lessonId")
      .where("enrollmentId", "=", enrollment.id)
      .execute();

    const output: OutputType = {
      enrollmentId: enrollment.id,
      completionPercentage: enrollment.completionPercentage,
      completedLessonIds: completedLessons.map(l => l.lessonId),
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Failed to fetch course progress:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to fetch progress", details: errorMessage }), { status: 500 });
  }
}