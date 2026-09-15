import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./details_GET.schema";
import superjson from "superjson";
import { z } from "zod";

const schema = z.object({
  courseId: z.coerce.number().int().positive(),
});

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId");
    const validation = schema.safeParse({ courseId });

    if (!validation.success) {
      return new Response(
        superjson.stringify({ error: "Invalid course ID" }),
        { status: 400 }
      );
    }

    const course = await db
      .selectFrom("courses")
      .selectAll()
      .where("id", "=", validation.data.courseId)
      .executeTakeFirst();

    if (!course) {
      return new Response(
        superjson.stringify({ error: "Course not found" }),
        { status: 404 }
      );
    }

    if (course.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "You do not own this course" }),
        { status: 403 }
      );
    }

    const sections = await db
      .selectFrom("courseSections")
      .selectAll()
      .where("courseId", "=", validation.data.courseId)
      .orderBy("orderIndex", "asc")
      .orderBy("id", "asc")
      .execute();

    const lessons = sections.length > 0 
      ? await db
          .selectFrom("courseLessons")
          .selectAll()
          .where(
            "sectionId",
            "in",
            sections.map((s) => s.id)
          )
          .orderBy("orderIndex", "asc")
          .orderBy("id", "asc")
          .execute()
      : [];

    const sectionsWithLessons = sections.map((section) => ({
      ...section,
      lessons: lessons.filter((lesson) => lesson.sectionId === section.id),
    }));

    const output: OutputType = {
      ...course,
      price: Number(course.price),
      sections: sectionsWithLessons,
      sectionsCount: sections.length,
      lessonsCount: lessons.length,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching course details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch course details", details: errorMessage }),
      { status: 500 }
    );
  }
}