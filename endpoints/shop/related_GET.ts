import { db } from "../../helpers/db";
import { schema, OutputType } from "./related_GET.schema";
import superjson from "superjson";
import { slugify } from "../../helpers/slugify";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    const queryInput = {
      productId: searchParams.get("productId") ? Number(searchParams.get("productId")) : undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    };

    const input = schema.parse(queryInput);

    // 1. Fetch current product to get its category and teacherId
    const currentProduct = await db
      .selectFrom("digitalProducts")
      .select(["category", "teacherId"])
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

    // 3. Rank sorting strategy
    // Since we use the camelCase plugin, we must use snake_case for raw sql statements
    if (currentProduct.category) {
      query = query.orderBy(
        sql<number>`CASE WHEN digital_products.category = ${currentProduct.category} THEN 1 ELSE 0 END`,
        "desc"
      );
    }
    
    query = query.orderBy(
      sql<number>`CASE WHEN digital_products.teacher_id = ${currentProduct.teacherId} THEN 1 ELSE 0 END`,
      "desc"
    );

    query = query.orderBy("digitalProducts.totalPurchases", "desc");
    query = query.orderBy("digitalProducts.publishedAt", "desc");

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