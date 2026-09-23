import { db } from "../../helpers/db";
import { schema, OutputType } from "./related_GET.schema";
import superjson from "superjson";
import { slugify } from "../../helpers/slugify";
import { sql, type RawBuilder } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    const queryInput = {
      productId: searchParams.get("productId") ? Number(searchParams.get("productId")) : undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    };

    const input = schema.parse(queryInput);

    // 1. Fetch current product to get its teacher, category and exam
    const currentProduct = await db
      .selectFrom("digitalProducts")
      .select(["category", "teacherId", "examId", "examName"])
      .where("id", "=", input.productId)
      .executeTakeFirst();

    if (!currentProduct) {
      return new Response(
        superjson.stringify({ error: "Product not found" }),
        { status: 404 }
      );
    }

    // Subquery: count files per digital product (matches shop/list_GET.ts)
    const fileCountSubquery = db
      .selectFrom("digitalProductFiles")
      .select([
        "digitalProductFiles.productId",
        (eb) => eb.fn.countAll<string>().as("fileCount"),
      ])
      .groupBy("digitalProductFiles.productId")
      .as("fileStats");

    // Subquery: aggregate reviews per digital product (matches shop/list_GET.ts)
    const reviewsSubquery = db
      .selectFrom("reviews")
      .select([
        "reviews.digitalProductId",
        (eb) => eb.fn.avg<string>("reviews.rating").as("avgRating"),
        (eb) => eb.fn.countAll<string>().as("ratingsCount"),
      ])
      .whereRef("reviews.digitalProductId", "is not", sql`null`)
      .groupBy("reviews.digitalProductId")
      .as("reviewStats");

    // 2. Base query for published digital products
    let query = db
      .selectFrom("digitalProducts")
      .innerJoin("users", "users.id", "digitalProducts.teacherId")
      .leftJoin(fileCountSubquery, "fileStats.productId", "digitalProducts.id")
      .leftJoin(reviewsSubquery, "reviewStats.digitalProductId", "digitalProducts.id")
      .select([
        "digitalProducts.id",
        "digitalProducts.title",
        "digitalProducts.slug",
        "digitalProducts.price",
        "digitalProducts.thumbnailUrl",
        "digitalProducts.category",
        "digitalProducts.examName",
        "digitalProducts.pageCount",
        "digitalProducts.totalPurchases",
        "digitalProducts.publishedAt",
        "digitalProducts.views",
        "users.displayName as teacherName",
        "users.avatarUrl as teacherAvatar",
        "users.isVerified as teacherIsVerified",
        "users.tagline as teacherTagline",
        "users.yearsOfExperience as teacherYearsOfExperience",
        "users.slug as teacherSlugCol",
        "fileStats.fileCount",
        "reviewStats.avgRating",
        "reviewStats.ratingsCount",
      ])
      .where("digitalProducts.id", "!=", input.productId)
      .where("digitalProducts.status", "=", "published")
      .where("digitalProducts.isPublished", "=", true);

    // 3. Rank in three tiers; the limit is filled from tier 1 down:
    //    1 - same teacher and same category
    //    2 - same exam, any teacher
    //    3 - everything else, top rated first
    // A blank category or exam never counts as a match. The exam matches on
    // exam_id or on the trimmed, case-insensitive name (NEET and NEET UG share an id).
    // Since we use the camelCase plugin, raw sql statements must use snake_case
    const category = currentProduct.category?.trim() || null;
    const examName = currentProduct.examName?.trim().toLowerCase() || null;

    const sameTeacherAndCategory = category
      ? sql`(digital_products.teacher_id = ${currentProduct.teacherId} AND digital_products.category = ${category})`
      : sql`false`;

    const examMatches: RawBuilder<unknown>[] = [];
    if (currentProduct.examId != null) {
      examMatches.push(sql`digital_products.exam_id = ${currentProduct.examId}`);
    }
    if (examName) {
      examMatches.push(sql`lower(btrim(digital_products.exam_name)) = ${examName}`);
    }
    const sameExam = examMatches.length
      ? sql`(${sql.join(examMatches, sql` OR `)})`
      : sql`false`;

    const tier = sql<number>`CASE WHEN ${sameTeacherAndCategory} THEN 1 WHEN ${sameExam} THEN 2 ELSE 3 END`;
    // Ratings only order tier 3; tiers 1 and 2 rank by popularity
    const tier3Only = (column: string) =>
      sql`CASE WHEN ${tier} = 3 THEN ${sql.ref(column)} END DESC NULLS LAST`;

    query = query
      .orderBy(tier, "asc")
      .orderBy(tier3Only("reviewStats.avgRating"))
      .orderBy(tier3Only("reviewStats.ratingsCount"))
      .orderBy(sql`coalesce(digital_products.total_purchases, 0) DESC`)
      .orderBy(sql`digital_products.published_at DESC NULLS LAST`);

    const products = await query
      .limit(input.limit || 4)
      .execute();

    // 4. Transform result format
    const output: OutputType = {
      products: products.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        price: Number(p.price),
        thumbnailUrl: p.thumbnailUrl,
        category: p.category,
        publishedAt: p.publishedAt,
        examName: p.examName ?? null,
        pageCount: p.pageCount ?? null,
        rating: p.avgRating != null ? Number(p.avgRating) : null,
        ratingsCount: p.ratingsCount != null ? Number(p.ratingsCount) : 0,
        totalPurchases: p.totalPurchases ? Number(p.totalPurchases) : 0,
        views: Number(p.views ?? 0),
        teacherName: p.teacherName,
        teacherAvatar: p.teacherAvatar,
        teacherIsVerified: !!p.teacherIsVerified,
        teacherSlug: p.teacherSlugCol || slugify(p.teacherName),
        teacherTagline: p.teacherTagline ?? null,
        teacherYearsOfExperience: p.teacherYearsOfExperience ?? null,
        fileCount: Number(p.fileCount ?? 0),
      })),
    };

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error) {
    console.error("Error fetching related products:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch related products", details: errorMessage }),
      { status: 500 }
    );
  }
}