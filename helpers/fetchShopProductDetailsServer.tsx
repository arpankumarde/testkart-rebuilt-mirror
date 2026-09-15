import { db } from "./db";
import { sql } from "kysely";
import type { OutputType, StudyNoteFileSummary } from "../endpoints/shop/details_GET.schema";
import { slugify } from "./slugify";
import { PRODUCT_DISCLAIMER } from "./productDisclaimer";
import { computeStudyNoteSeo } from "./seoIndexability";

export async function fetchShopProductDetailsServer(slug: string): Promise<OutputType> {
  const product = await db
    .selectFrom("digitalProducts")
    .innerJoin("users", "users.id", "digitalProducts.teacherId")
    .select([
      "digitalProducts.id",
      "digitalProducts.title",
      "digitalProducts.slug",
      "digitalProducts.description",
      "digitalProducts.shortDescription",
      "digitalProducts.price",
      "digitalProducts.thumbnailUrl",
      "digitalProducts.pdfUrl",
      "digitalProducts.previewPages",
      "digitalProducts.pageCount",
      "digitalProducts.fileSizeBytes",
      "digitalProducts.language",
      "digitalProducts.category",
      "digitalProducts.tags",
      "digitalProducts.rating",
      "digitalProducts.reviewsCount",
      "digitalProducts.totalPurchases",
      "digitalProducts.views",
      "digitalProducts.publishedAt",
     "digitalProducts.examName",
     "digitalProducts.examId",
      "users.displayName as teacherName",
      "users.avatarUrl as teacherAvatar",
      "users.bio as teacherBio",
      "users.isVerified as teacherVerified",
      "users.academyName as teacherAcademyName",
            "users.slug as teacherSlugCol",
      "digitalProducts.teacherId",
    ])
    .where("digitalProducts.slug", "=", slug)
    .where("digitalProducts.status", "=", "published")
    .executeTakeFirst();

  if (!product) {
    throw new Error("Product not found");
  }

  // This helper backs the SSR/prefetch path (pages/study-notes.$noteSlug.prefetch.ts),
  // which is how the vast majority of real page loads reach this data — the
  // client-side query hook rarely re-fetches shop/details_GET.ts once the
  // SSR result hydrates its cache as fresh. Increment views here too so the
  // counter reflects real traffic instead of only direct API cache-misses.
  db.updateTable("digitalProducts")
    .set({ views: sql`views + 1` })
    .where("id", "=", product.id)
    .execute()
    .catch((err) => {
      console.error("Failed to increment product view count (SSR):", err);
    });

  // Fetch the individual files (chapters) for the product's Files list.
  const fileRows = await db
    .selectFrom("digitalProductFiles")
    .select(["id", "title", "pageCount", "fileSizeBytes", "orderIndex"])
    .where("productId", "=", product.id)
    .orderBy("orderIndex", "asc")
    .execute();

  let files: StudyNoteFileSummary[] = fileRows.map(f => ({
    id: f.id,
    title: f.title,
    pageCount: f.pageCount,
    fileSizeBytes: f.fileSizeBytes ? Number(f.fileSizeBytes) : null,
    orderIndex: f.orderIndex,
  }));

  // Legacy single-file products predate the multi-file feature and store
  // their one file on digitalProducts.pdfUrl instead of a
  // digital_product_files row — synthesize a single entry so the Files
  // list isn't empty for them.
  if (files.length === 0 && product.pdfUrl && !product.pdfUrl.includes("placeholder")) {
    files = [{
      id: 0,
      title: product.title,
      pageCount: product.pageCount,
      fileSizeBytes: product.fileSizeBytes ? Number(product.fileSizeBytes) : null,
      orderIndex: 0,
    }];
  }

  const fileCount = files.length;
  const actualPageCount = files.reduce((sum, f) => sum + (f.pageCount ?? 0), 0);

  // Compute SEO indexability live from current data — see
  // helpers/seoIndexability.tsx for the full rule set and rationale. Kept
  // in sync with shop/details_GET.ts, which the client falls back to.
  const seoResult = await computeStudyNoteSeo(db, {
    id: product.id,
    title: product.title,
    description: product.description,
    shortDescription: product.shortDescription,
    status: "published", // gated by the query above; this row is always published
    examId: product.examId,
    category: product.category,
    actualPageCount,
    fileCount,
    thumbnailUrl: product.thumbnailUrl,
    tags: product.tags,
    language: product.language,
  });

  // Fetch recent reviews
  const reviews = await db
    .selectFrom("reviews")
    .select([
      "id",
      "reviewerName",
      "rating",
      "reviewText",
      "createdAt",
      "userId",
    ])
    .where("digitalProductId", "=", product.id)
    .orderBy("createdAt", "desc")
    .limit(5)
    .execute();

  return {
    product: {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      price: Number(product.price),
      thumbnailUrl: product.thumbnailUrl,
      previewUrl: null,
      previewPages: product.previewPages,
      pageCount: product.pageCount,
      fileSizeBytes: product.fileSizeBytes ? Number(product.fileSizeBytes) : null,
      language: product.language,
      category: product.category,
      tags: product.tags,
      rating: product.rating ? Number(product.rating) : null,
      reviewsCount: product.reviewsCount ? Number(product.reviewsCount) : 0,
      totalPurchases: product.totalPurchases ? Number(product.totalPurchases) : 0,
      views: Number(product.views ?? 0),
      fileCount,
      files,
     isPurchased: false,
     publishedAt: product.publishedAt,
     examName: product.examName ?? null,
     examId: product.examId ?? null,
            teacherId: product.teacherId,
      teacherName: product.teacherName,
      teacherSlug: product.teacherSlugCol || slugify(product.teacherName),
      teacherAvatar: product.teacherAvatar,
      teacherBio: product.teacherBio,
      teacherVerified: product.teacherVerified ?? false,
      teacherAcademyName: product.teacherAcademyName ?? null,
      disclaimer: PRODUCT_DISCLAIMER,
      seo: {
        indexable: seoResult.indexable,
        qualityScore: seoResult.qualityScore,
        robots: seoResult.robots,
      },
    },
    reviews: reviews.map(r => ({
      ...r,
      rating: Number(r.rating),
      userId: r.userId,
    })),
  };
}