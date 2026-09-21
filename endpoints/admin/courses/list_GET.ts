import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const courses = await db
      .selectFrom("courses")
      .innerJoin("users", "users.id", "courses.teacherId")
      .leftJoin("courseEnrollments", "courseEnrollments.courseId", "courses.id")
      .select([
        "courses.id",
        "courses.title",
        "courses.slug",
        "courses.status",
        "courses.createdAt",
        "courses.price",
        "users.displayName as teacherName",
        "users.id as teacherId",
      ])
      .select((eb) => [
        eb.fn.count("courseEnrollments.id").as("studentsEnrolled"),
      ])
      .select((eb) =>
        eb
          .selectFrom("courseLessons")
          .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
          .whereRef("courseSections.courseId", "=", "courses.id")
          .select(eb.fn.countAll<string>().as("cnt"))
          .as("lessonsCount")
      )
      .groupBy([
        "courses.id",
        "courses.title",
        "courses.slug",
        "courses.status",
        "courses.createdAt",
        "courses.price",
        "users.displayName",
        "users.id",
      ])
      .orderBy("courses.createdAt", "desc")
      .execute();

    const typeCounts = await db
      .selectFrom("courseLessons")
      .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
      .select(["courseSections.courseId", "courseLessons.contentType"])
      .select((eb) => eb.fn.countAll<string>().as("cnt"))
      .groupBy(["courseSections.courseId", "courseLessons.contentType"])
      .execute();
    const countOf = (courseId: number, type: string) =>
      Number(typeCounts.find((row) => row.courseId === courseId && row.contentType === type)?.cnt ?? 0);

    const output: OutputType = courses.map((course) => ({
      ...course,
      price: Number(course.price),
      studentsEnrolled: Number(course.studentsEnrolled),
      lessonsCount: Number(course.lessonsCount ?? 0),
      videoLessonsCount: countOf(course.id, "video"),
      pdfLessonsCount: countOf(course.id, "pdf"),
      quizLessonsCount: countOf(course.id, "quiz"),
      textLessonsCount: countOf(course.id, "text"),
    }));

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching admin courses list:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}