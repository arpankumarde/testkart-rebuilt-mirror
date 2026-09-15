import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType } from "./enrolled-courses_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    const enrolledCourses = await db
      .selectFrom("courseEnrollments")
      .innerJoin("courses", "courses.id", "courseEnrollments.courseId")
      .innerJoin("users", "users.id", "courses.teacherId")
      .select([
        "courses.id",
        "courses.title",
        "courses.thumbnailUrl",
        "courses.thumbnailImageUrl",
        "courses.introVideoUrl",
        "courses.category",
        "users.displayName as teacherName",
        "courseEnrollments.enrolledAt",
        "courseEnrollments.completionPercentage",
        "courseEnrollments.lastAccessedAt",
      ])
      .select((eb) => [
        sql<number>`(
          SELECT COUNT(*)
          FROM course_lessons
          INNER JOIN course_sections ON course_sections.id = course_lessons.section_id
          WHERE course_sections.course_id = courses.id
        )`.as("totalLessons"),
      ])
      .where("courseEnrollments.studentId", "=", user.id)
       .orderBy("courseEnrollments.lastAccessedAt", "desc")
       .execute();
 
    const courseIds = enrolledCourses.map((c) => c.id);
    let reviewedCourseIds = new Set<number>();
    let reviewDataMap = new Map<number, { rating: number; reviewText: string | null }>();

    if (courseIds.length > 0) {
      const reviews = await db
        .selectFrom("reviews")
        .select("courseId")
        .select("rating")
        .select("reviewText")
        .where("userId", "=", user.id)
        .where("courseId", "in", courseIds)
        .execute();

      for (const review of reviews) {
        if (review.courseId != null) {
          reviewedCourseIds.add(review.courseId);
          reviewDataMap.set(review.courseId, { rating: review.rating, reviewText: review.reviewText });
        }
      }
    }

     const output: OutputType = {
       enrolledCourses: enrolledCourses.map(course => ({
         ...course,
        totalLessons: Number(course.totalLessons),
        hasReviewed: reviewedCourseIds.has(course.id),
        reviewRating: reviewedCourseIds.has(course.id) ? reviewDataMap.get(course.id)!.rating : null,
        reviewText: reviewedCourseIds.has(course.id) ? reviewDataMap.get(course.id)!.reviewText : null,
       }))
     };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Failed to fetch enrolled courses:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch enrolled courses.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}