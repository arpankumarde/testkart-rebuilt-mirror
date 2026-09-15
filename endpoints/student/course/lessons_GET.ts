import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./lessons_GET.schema";
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
      .select("id")
      .where("courseId", "=", validation.data.courseId)
      .where("studentId", "=", user.id)
      .executeTakeFirst();

    if (!enrollment) {
      return new Response(superjson.stringify({ error: "Not enrolled in this course" }), { status: 403 });
    }

    // Update last accessed time
    await db.updateTable("courseEnrollments")
        .set({ lastAccessedAt: new Date() })
        .where("id", "=", enrollment.id)
        .execute();

    const course = await db.selectFrom("courses").selectAll().where("id", "=", validation.data.courseId).executeTakeFirstOrThrow();

    const sections = await db
      .selectFrom("courseSections")
      .selectAll()
      .where("courseId", "=", validation.data.courseId)
      .orderBy("orderIndex", "asc")
      .execute();

    const lessons = await db
      .selectFrom("courseLessons")
      .selectAll()
      .where("sectionId", "in", sections.map((s) => s.id))
      .orderBy("orderIndex", "asc")
      .execute();

    const sectionsWithLessons = sections.map((section) => ({
      ...section,
      lessons: lessons.filter((lesson) => lesson.sectionId === section.id),
    }));

    const output: OutputType = {
      course: { ...course, price: Number(course.price) },
      sections: sectionsWithLessons,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Failed to fetch course lessons for student:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to fetch lessons", details: errorMessage }), { status: 500 });
  }
}