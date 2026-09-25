import { db } from "../../helpers/db";
import { schema, OutputType } from "./related_GET.schema";
import superjson from "superjson";
import { sql, type RawBuilder } from "kysely";
import { slugify } from "../../helpers/slugify";
import { courseDiscountPrice } from "../../helpers/coursePricing";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const input = schema.parse({
      courseId: url.searchParams.get("courseId") ? Number(url.searchParams.get("courseId")) : undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });

    const currentCourse = await db
      .selectFrom("courses")
      .select(["category", "teacherId", "examId", "examName"])
      .where("id", "=", input.courseId)
      .executeTakeFirst();

    if (!currentCourse) {
      return new Response(
        superjson.stringify({ error: "Course not found" }),
        { status: 404 }
      );
    }

    // Same three tiers as shop/related; the limit is filled from tier 1 down:
    //    1 - same teacher and same category
    //    2 - same exam, any teacher
    //    3 - everything else, top rated first
    // A blank category or exam never counts as a match.
    // Raw sql skips the camelCase plugin, so it uses snake_case names.
    const category = currentCourse.category?.trim() || null;
    const examName = currentCourse.examName?.trim().toLowerCase() || null;

    const sameTeacherAndCategory = category
      ? sql`(courses.teacher_id = ${currentCourse.teacherId} AND courses.category = ${category})`
      : sql`false`;

    const examMatches: RawBuilder<unknown>[] = [];
    if (currentCourse.examId != null) {
      examMatches.push(sql`courses.exam_id = ${currentCourse.examId}`);
    }
    if (examName) {
      examMatches.push(sql`lower(btrim(courses.exam_name)) = ${examName}`);
    }
    const sameExam = examMatches.length
      ? sql`(${sql.join(examMatches, sql` OR `)})`
      : sql`false`;

    const tier = sql<number>`CASE WHEN ${sameTeacherAndCategory} THEN 1 WHEN ${sameExam} THEN 2 ELSE 3 END`;
    const avgRating = sql<number | null>`(SELECT AVG(r.rating) FROM reviews r WHERE r.course_id = courses.id)`;
    const ratingsCount = sql<number>`(SELECT COUNT(*) FROM reviews r WHERE r.course_id = courses.id)`;
    const enrollmentCount = sql<number>`(SELECT COUNT(*) FROM course_enrollments WHERE course_enrollments.course_id = courses.id)`;

    const courses = await db
      .selectFrom("courses")
      .innerJoin("users", "users.id", "courses.teacherId")
      .select([
        "courses.id",
        "courses.slug",
        "courses.title",
        "courses.description",
        "courses.thumbnailUrl",
        "courses.thumbnailImageUrl",
        "courses.introVideoUrl",
        "courses.price",
        "courses.discountPrice",
        "courses.category",
        "courses.level",
        "courses.language",
        "courses.status",
        "courses.publishedAt",
        "courses.views",
        "courses.examId",
        "courses.examName",
        "users.displayName as teacherName",
        "users.isVerified as teacherIsVerified",
        "users.avatarUrl as teacherAvatarUrl",
        "users.tagline as teacherTagline",
        "users.yearsOfExperience as teacherYearsOfExperience",
        "users.slug as teacherSlugCol",
      ])
      .select([
        enrollmentCount.as("enrollmentCount"),
        avgRating.as("avgRating"),
        ratingsCount.as("ratingsCount"),
      ])
      .where("courses.id", "!=", input.courseId)
      .where("courses.status", "=", "published")
      .orderBy(tier, "asc")
      // Ratings only order tier 3; tiers 1 and 2 rank by popularity
      .orderBy(sql`CASE WHEN ${tier} = 3 THEN ${avgRating} END DESC NULLS LAST`)
      .orderBy(sql`CASE WHEN ${tier} = 3 THEN ${ratingsCount} END DESC NULLS LAST`)
      .orderBy(sql`${enrollmentCount} DESC`)
      .orderBy(sql`courses.published_at DESC NULLS LAST`)
      .limit(input.limit || 4)
      .execute();

    const output: OutputType = {
      courses: courses.map(({ teacherSlugCol, ...course }) => ({
        ...course,
        price: Number(course.price),
        discountPrice: courseDiscountPrice(course.price, course.discountPrice),
        enrollmentCount: Number(course.enrollmentCount),
        views: Number(course.views ?? 0),
        teacherIsVerified: !!course.teacherIsVerified,
        teacherAvatarUrl: course.teacherAvatarUrl ?? null,
        teacherTagline: course.teacherTagline ?? null,
        teacherYearsOfExperience: course.teacherYearsOfExperience ?? null,
        teacherSlug: teacherSlugCol || slugify(course.teacherName),
        avgRating: course.avgRating != null ? Number(course.avgRating) : null,
        ratingsCount: Number(course.ratingsCount),
      })),
    };

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error) {
    console.error("Error fetching related courses:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch related courses", details: errorMessage }),
      { status: 500 }
    );
  }
}