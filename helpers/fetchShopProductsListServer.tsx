import { db } from "./db";
import { sql } from "kysely";
import { schema, InputType, OutputType } from "../endpoints/shop/list_GET.schema";
import { slugify } from "./slugify";

/**
 * Direct-DB counterpart to endpoints/shop/list_GET.ts, for use ONLY from
 * page prefetch (e.g. pages/exams.$examSlug.study-notes.prefetch.ts) — see
 * helpers/fetchBlogPostDetailServer.tsx for why the network endpoint can't
 * be called from within the SSR pass. Keep in sync with
 * endpoints/shop/list_GET.ts.
 */
export async function fetchShopProductsListServer(rawInput: Partial<InputType> = {}): Promise<OutputType> {
  const input = schema.parse(rawInput);

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

  const fileCountSubquery = db
    .selectFrom("digitalProductFiles")
    .select([
      "digitalProductFiles.productId",
      (eb) => eb.fn.countAll<string>().as("fileCount"),
    ])
    .groupBy("digitalProductFiles.productId")
    .as("fileStats");

  const recentPurchasesSubquery = db
    .selectFrom("digitalProductPurchases")
    .select([
      "digitalProductPurchases.productId",
      (eb) => eb.fn.countAll<string>().as("recentPurchases"),
    ])
    .where("digitalProductPurchases.purchasedAt", ">", sql`NOW() - INTERVAL '60 days'`)
    .groupBy("digitalProductPurchases.productId")
    .as("popularity");

  let query = db
    .selectFrom("digitalProducts")
    .innerJoin("users", "users.id", "digitalProducts.teacherId")
    .leftJoin(reviewsSubquery, "reviewStats.digitalProductId", "digitalProducts.id")
    .leftJoin(fileCountSubquery, "fileStats.productId", "digitalProducts.id")
    .leftJoin(recentPurchasesSubquery, "popularity.productId", "digitalProducts.id")
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
      "reviewStats.avgRating",
      "reviewStats.ratingsCount",
      "fileStats.fileCount",
    ])
    .where("digitalProducts.status", "=", "published")
    .where("digitalProducts.isPublished", "=", true);

  if (input.category) query = query.where("digitalProducts.category", "=", input.category);
  if (input.examId !== undefined) query = query.where("digitalProducts.examId", "=", input.examId);
  if (input.priceMin !== undefined) query = query.where("digitalProducts.price", ">=", input.priceMin.toString());
  if (input.priceMax !== undefined) query = query.where("digitalProducts.price", "<=", input.priceMax.toString());
  if (input.language) query = query.where("digitalProducts.language", "=", input.language);

  if (input.search) {
    const searchTerm = `%${input.search.toLowerCase()}%`;
    query = query.where((eb) =>
      eb.or([
        eb("digitalProducts.title", "ilike", searchTerm),
        eb("digitalProducts.description", "ilike", searchTerm),
      ])
    );
  }

  switch (input.sort) {
    case "popular":
      query = query.orderBy(sql`(
        (SELECT COUNT(*) FROM digital_product_purchases WHERE product_id = digital_products.id AND purchased_at > NOW() - INTERVAL '7 days') * 3 +
        (SELECT COUNT(*) FROM digital_product_purchases WHERE product_id = digital_products.id AND purchased_at > NOW() - INTERVAL '30 days')
      )`, "desc").orderBy(sql`COALESCE(digital_products.views, 0)`, "desc");
      break;
    case "price_asc":
      query = query.orderBy("digitalProducts.price", "asc");
      break;
    case "price_desc":
      query = query.orderBy("digitalProducts.price", "desc");
      break;
    case "newest":
    default:
      query = query.orderBy("digitalProducts.publishedAt", "desc");
      break;
  }

  const countQuery = query.clearSelect().clearOrderBy().select((eb) => eb.fn.countAll<number>().as("count"));
  const countResult = await countQuery.executeTakeFirst();
  const totalCount = Number(countResult?.count ?? 0);
  const totalPages = Math.ceil(totalCount / input.limit);

  const offset = (input.page - 1) * input.limit;
  const products = await query.limit(input.limit).offset(offset).execute();

  return {
    products: products.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      price: Number(p.price),
      thumbnailUrl: p.thumbnailUrl,
      category: p.category,
      publishedAt: p.publishedAt,
      pageCount: p.pageCount ?? null,
      rating: p.avgRating != null ? Number(p.avgRating) : null,
      ratingsCount: p.ratingsCount != null ? Number(p.ratingsCount) : 0,
      examName: p.examName ?? null,
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
    page: input.page,
    limit: input.limit,
    totalCount,
    totalPages,
  };
}
