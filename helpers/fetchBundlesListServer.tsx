import { db } from "./db";
import { sql } from "kysely";
import { schema, InputType, OutputType } from "../endpoints/bundles/list_GET.schema";

/**
 * Direct-DB counterpart to endpoints/bundles/list_GET.ts, for use ONLY from
 * page prefetch (e.g. pages/bundles.prefetch.ts,
 * pages/exams.$examSlug.bundles.prefetch.ts) — see
 * helpers/fetchBlogPostDetailServer.tsx for why the network endpoint can't
 * be called from within the SSR pass. Keep in sync with
 * endpoints/bundles/list_GET.ts.
 */
export async function fetchBundlesListServer(rawInput: Partial<InputType> = {}): Promise<OutputType> {
  const validation = schema.safeParse(rawInput);
  if (!validation.success) {
    throw new Error("Invalid bundle list filters: " + validation.error.message);
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

  let query = db
    .selectFrom("courseBundles")
    .innerJoin("users", "users.id", "courseBundles.teacherId")
    .where("courseBundles.isPublished", "=", true);

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

  return {
    bundles: bundlesResult.map((bundle) => ({
      ...bundle,
      price: Number(bundle.price),
      originalPrice: Number(bundle.originalPrice),
      discountPercentage: bundle.discountPercentage ? Number(bundle.discountPercentage) : null,
      itemCount: Number(bundle.itemCount),
      courseTitles: bundle.courseTitles || [],
      teacherIsVerified: !!bundle.teacherIsVerified,
    })),
    total: Number(totalResult.total),
    page,
    limit,
  };
}
