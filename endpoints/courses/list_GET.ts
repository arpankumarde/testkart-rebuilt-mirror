import { db } from "../../helpers/db";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { slugify } from "../../helpers/slugify";

export async function handle(request: Request): Promise<Response> {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const category = url.searchParams.get("category");
    const level = url.searchParams.get("level");
    const language = url.searchParams.get("language");
    const priceType = url.searchParams.get("priceType");
    const minPrice = url.searchParams.get("minPrice");
    const maxPrice = url.searchParams.get("maxPrice");
    const sortBy = url.searchParams.get("sortBy") || "newest";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "6", 10);
    const examId = url.searchParams.get("examId");

    // Start building the query
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

    // Apply filters
    if (search) {
      const searchPattern = `%${search}%`;
      query = query.where((eb) =>
        eb.or([
          eb("courses.title", "ilike", searchPattern),
          eb("courses.description", "ilike", searchPattern),
        ])
      );
    }

    if (category) {
      query = query.where("courses.category", "=", category);
    }

    if (examId) {
      query = query.where("courses.examId", "=", Number(examId));
    }

    if (level) {
      query = query.where(
        "courses.level",
        "=",
        level as "beginner" | "intermediate" | "advanced"
      );
    }

    if (language) {
      const languages = language.split(",").map((l) => l.trim());
      query = query.where((eb) =>
        eb.or(languages.map((lang) => eb("courses.language", "=", lang)))
      );
    }

    if (priceType === "free") {
      query = query.where("courses.price", "=", "0");
    } else if (priceType === "paid") {
      query = query.where("courses.price", ">", "0");

      if (minPrice) {
        query = query.where("courses.price", ">=", minPrice);
      }
      if (maxPrice) {
        query = query.where("courses.price", "<=", maxPrice);
      }
    }

    // Get total count before pagination
    const countQuery = query
      .clearSelect()
      .select((eb) => eb.fn.countAll<number>().as("count"));
    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    // Apply sorting
    switch (sortBy) {
      case "price_asc":
        query = query.orderBy("courses.price", "asc");
        break;
      case "price_desc":
        query = query.orderBy("courses.price", "desc");
        break;
            case "popular":
        query = query.orderBy(
          sql`(
            (SELECT COUNT(*) FROM course_enrollments WHERE course_id = courses.id AND enrolled_at > NOW() - INTERVAL '7 days') * 3 +
            (SELECT COUNT(*) FROM course_enrollments WHERE course_id = courses.id AND enrolled_at > NOW() - INTERVAL '30 days')
          )`,
          "desc"
        ).orderBy(sql`COALESCE(courses.views, 0)`, "desc");
        break;
      case "newest":
      default:
        query = query.orderBy("courses.publishedAt", "desc");
        break;
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);

    // Fetch distinct categories from published courses
    const categoryRows = await db
      .selectFrom("courses")
      .select("courses.category")
      .distinct()
      .where("courses.status", "=", "published")
      .where("courses.category", "is not", null)
      .where("courses.category", "!=", "")
      .orderBy("courses.category", "asc")
      .execute();

    const categories = categoryRows
      .map((row) => row.category?.trim() ?? "")
      .filter((c) => c !== "");

    const courses = await query.execute();

    const totalPages = Math.ceil(totalCount / limit);

    const output: OutputType = {
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
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing public courses:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to list courses",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}