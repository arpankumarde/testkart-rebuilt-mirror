import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const courses = await db
      .selectFrom("courses")
      .selectAll("courses")
      .select((eb) => [
        sql<number>`(
          SELECT COUNT(*)
          FROM course_sections
          WHERE course_sections.course_id = courses.id
        )`.as("sectionsCount"),
        sql<number>`(
          SELECT COUNT(*)
          FROM course_lessons
          INNER JOIN course_sections ON course_sections.id = course_lessons.section_id
          WHERE course_sections.course_id = courses.id
        )`.as("lessonsCount"),
      ])
      .where("courses.teacherId", "=", effectiveTeacherId)
      .orderBy("courses.createdAt", "desc")
      .execute();

    const output: OutputType = courses.map((course) => ({
      ...course,
      price: Number(course.price),
      sectionsCount: Number(course.sectionsCount),
      lessonsCount: Number(course.lessonsCount),
    }));

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing teacher courses:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to list courses", details: errorMessage }),
      { status: 500 }
    );
  }
}