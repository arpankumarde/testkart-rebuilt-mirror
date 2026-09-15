import { db } from "../../helpers/db";
import { OutputType, schema } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const validation = schema.safeParse(params);

    if (!validation.success) {
      return new Response(
        superjson.stringify({
          error: "Invalid query parameters",
          details: validation.error.flatten(),
        }),
        { status: 400 }
      );
    }

    const {
      page = 1,
      limit = 10,
      sort = "newest",
      teacherId,
      minPrice,
      maxPrice,
      search,
      examId,
    } = validation.data;

    const offset = (page - 1) * limit;

    // Build the main query with joins for the bundle list
    let query = db
      .selectFrom("courseBundles")
      .innerJoin("users", "users.id", "courseBundles.teacherId")
      .where("courseBundles.isPublished", "=", true);

    // Build a separate count query from scratch with the same filters.
    // We do NOT clone the main query with clearSelect() because the subquery
    // selects (itemCount, courseTitles) cause a "must appear in GROUP BY" error.
    let countQuery = db
      .selectFrom("courseBundles")
      .where("courseBundles.isPublished", "=", true);

    if (search) {
      const searchPattern = `%${search}%`;
      query = query.where((eb) =>
        eb.or([
          eb("courseBundles.title", "ilike", searchPattern),
          eb("courseBundles.description", "ilike", searchPattern),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("courseBundles.title", "ilike", searchPattern),
          eb("courseBundles.description", "ilike", searchPattern),
        ])
      );
    }

    if (teacherId) {
      query = query.where("courseBundles.teacherId", "=", teacherId);
      countQuery = countQuery.where("courseBundles.teacherId", "=", teacherId);
    }
    if (minPrice) {
      query = query.where("courseBundles.price", ">=", minPrice.toString());
      countQuery = countQuery.where("courseBundles.price", ">=", minPrice.toString());
    }
    if (maxPrice) {
      query = query.where("courseBundles.price", "<=", maxPrice.toString());
      countQuery = countQuery.where("courseBundles.price", "<=", maxPrice.toString());
    }

    // A bundle is "for" an exam if ANY of its items (mock test, digital
    // product, or course) is tagged to that exam — bundles have no exam
    // field of their own, so this is derived rather than a direct filter.
    if (examId) {
      const examRelevance = sql<boolean>`EXISTS (
        SELECT 1 FROM course_bundle_items cbi
        LEFT JOIN mock_tests mt ON mt.id = cbi.mock_test_id
        LEFT JOIN digital_products dp ON dp.id = cbi.digital_product_id
        LEFT JOIN courses c ON c.id = cbi.course_id
        WHERE cbi.bundle_id = course_bundles.id
          AND (mt.exam_id = ${examId} OR dp.exam_id = ${examId} OR c.exam_id = ${examId})
      )`;
      query = query.where(examRelevance);
      countQuery = countQuery.where(examRelevance);
    }

    // Apply sorting to the main query only
    if (sort === "newest") {
      query = query.orderBy("courseBundles.publishedAt", "desc");
    } else if (sort === "price_asc") {
      query = query.orderBy("courseBundles.price", "asc");
    } else if (sort === "price_desc") {
      query = query.orderBy("courseBundles.price", "desc");
        } else if (sort === "popular") {
      query = query.orderBy(
        sql`(
          (SELECT COUNT(*) FROM bundle_enrollments WHERE bundle_id = course_bundles.id AND enrolled_at > NOW() - INTERVAL '7 days') * 3 +
          (SELECT COUNT(*) FROM bundle_enrollments WHERE bundle_id = course_bundles.id AND enrolled_at > NOW() - INTERVAL '30 days')
        )`,
        "desc"
      );
    }

    const totalQuery = countQuery.select(db.fn.countAll().as("total"));

    const bundlesQuery = query
      .selectAll("courseBundles")
      .select(["users.displayName as teacherName", "users.isVerified as teacherIsVerified"])
      .select((eb) => [
        sql<number>`(
          SELECT COUNT(*)
          FROM course_bundle_items
          WHERE course_bundle_items.bundle_id = course_bundles.id
        )`.as("itemCount"),
        sql<string[]>`(
          SELECT array_agg(c.title)
          FROM course_bundle_items cbi
          JOIN courses c ON c.id = cbi.course_id
          WHERE cbi.bundle_id = course_bundles.id
        )`.as("courseTitles"),
      ])
      .limit(limit)
      .offset(offset);

    const [bundlesResult, totalResult] = await Promise.all([
      bundlesQuery.execute(),
      totalQuery.executeTakeFirstOrThrow(),
    ]);

    const output: OutputType = {
      bundles: bundlesResult.map((bundle) => ({
        ...bundle,
        price: Number(bundle.price),
        originalPrice: Number(bundle.originalPrice),
        discountPercentage: bundle.discountPercentage
          ? Number(bundle.discountPercentage)
          : null,
        itemCount: Number(bundle.itemCount),
        courseTitles: bundle.courseTitles || [],
        teacherIsVerified: !!bundle.teacherIsVerified,
      })),
      total: Number(totalResult.total),
      page,
      limit,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing course bundles:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to list course bundles",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}