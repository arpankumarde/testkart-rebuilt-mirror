import { db } from "./db";
import { sql } from "kysely";
import type { InputType, OutputType } from "../endpoints/courses/list_GET.schema";
import { slugify } from "./slugify";

/**
 * Direct-DB counterpart to endpoints/courses/list_GET.ts, for use ONLY from
 * page prefetch (e.g. pages/exams.$examSlug.courses.prefetch.ts) — see
 * helpers/fetchBlogPostDetailServer.tsx for why the network endpoint can't
 * be called from within the SSR pass. Keep in sync with
 * endpoints/courses/list_GET.ts.
 */
export async function fetchCoursesListServer(filters: InputType = {}): Promise<OutputType> {
  const search = filters.search;
  const category = filters.category;
  const examId = filters.examId;
  const level = filters.level;
  const language = filters.language;
  const priceType = filters.priceType;
  const minPrice = filters.minPrice;
  const maxPrice = filters.maxPrice;
  const sortBy = filters.sortBy || "newest";
  const page = filters.page ? parseInt(filters.page, 10) : 1;
  const limit = filters.limit ? parseInt(filters.limit, 10) : 6;

  let query = db
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
    .select((eb) => [
      sql<number>`(
        SELECT COUNT(*)
        FROM course_enrollments
        WHERE course_enrollments.course_id = courses.id
      )`.as("enrollmentCount"),
      sql<number | null>`(
        SELECT AVG(r.rating)
        FROM reviews r
        WHERE r.course_id = courses.id
      )`.as("avgRating"),
      sql<number>`(
        SELECT COUNT(*)
        FROM reviews r
        WHERE r.course_id = courses.id
      )`.as("ratingsCount"),
    ])
    .where("courses.status", "=", "published");

  if (search) {
    const searchPattern = `%${search}%`;
    query = query.where((eb) =>
      eb.or([
        eb("courses.title", "ilike", searchPattern),
        eb("courses.description", "ilike", searchPattern),
      ])
    );
  }

  if (category) query = query.where("courses.category", "=", category);
  if (examId) query = query.where("courses.examId", "=", Number(examId));
  if (level) query = query.where("courses.level", "=", level as "beginner" | "intermediate" | "advanced");

  if (language) {
    const languages = language.split(",").map((l) => l.trim());
    query = query.where((eb) => eb.or(languages.map((lang) => eb("courses.language", "=", lang))));
  }

  if (priceType === "free") {
    query = query.where("courses.price", "=", "0");
  } else if (priceType === "paid") {
    query = query.where("courses.price", ">", "0");
    if (minPrice) query = query.where("courses.price", ">=", minPrice);
    if (maxPrice) query = query.where("courses.price", "<=", maxPrice);
  }

  const countQuery = query.clearSelect().select((eb) => eb.fn.countAll<number>().as("count"));
  const countResult = await countQuery.executeTakeFirst();
  const totalCount = Number(countResult?.count ?? 0);

  switch (sortBy) {
    case "price_asc":
      query = query.orderBy("courses.price", "asc");
      break;
    case "price_desc":
      query = query.orderBy("courses.price", "desc");
      break;
    case "popular":
      query = query.orderBy(sql`(
        (SELECT COUNT(*) FROM course_enrollments WHERE course_id = courses.id AND enrolled_at > NOW() - INTERVAL '7 days') * 3 +
        (SELECT COUNT(*) FROM course_enrollments WHERE course_id = courses.id AND enrolled_at > NOW() - INTERVAL '30 days')
      )`, "desc").orderBy(sql`COALESCE(courses.views, 0)`, "desc");
      break;
    case "newest":
    default:
      query = query.orderBy("courses.publishedAt", "desc");
      break;
  }

  const offset = (page - 1) * limit;
  query = query.limit(limit).offset(offset);

  const categoryRows = await db
    .selectFrom("courses")
    .select("courses.category")
    .distinct()
    .where("courses.status", "=", "published")
    .where("courses.category", "is not", null)
    .where("courses.category", "!=", "")
    .orderBy("courses.category", "asc")
    .execute();

  const categories = categoryRows.map((row) => row.category?.trim() ?? "").filter((c) => c !== "");

  const courses = await query.execute();
  const totalPages = Math.ceil(totalCount / limit);

  return {
    courses: courses.map((course) => ({
      ...course,
      price: Number(course.price),
      enrollmentCount: Number(course.enrollmentCount),
      views: Number(course.views ?? 0),
      teacherIsVerified: !!course.teacherIsVerified,
      teacherAvatarUrl: course.teacherAvatarUrl ?? null,
      teacherTagline: course.teacherTagline ?? null,
      teacherYearsOfExperience: course.teacherYearsOfExperience ?? null,
      teacherSlug: course.teacherSlugCol || slugify(course.teacherName),
      avgRating: course.avgRating !== null && course.avgRating !== undefined ? Number(course.avgRating) : null,
      ratingsCount: Number(course.ratingsCount),
    })),
    categories,
    pagination: { page, limit, totalCount, totalPages },
  };
}
