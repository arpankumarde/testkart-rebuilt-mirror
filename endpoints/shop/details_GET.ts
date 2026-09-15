import { db } from "../../helpers/db";
import { schema, OutputType, StudyNoteFileSummary } from "./details_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { slugify } from "../../helpers/slugify";
import { PRODUCT_DISCLAIMER } from "../../helpers/productDisclaimer";
import { getServerSessionOrThrow } from "../../helpers/getSetServerSession";
import { computeStudyNoteSeo } from "../../helpers/seoIndexability";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(
        superjson.stringify({ error: "Product slug is required" }),
        { status: 400 }
      );
    }

    const input = schema.parse({ slug });

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
       "digitalProducts.examName",
       "digitalProducts.examId",
       "digitalProducts.teacherId",
         "digitalProducts.tags",
        "digitalProducts.rating",
        "digitalProducts.reviewsCount",
        "digitalProducts.totalPurchases",
        "digitalProducts.views",
        "digitalProducts.publishedAt",
        "users.displayName as teacherName",
        "users.avatarUrl as teacherAvatar",
        "users.bio as teacherBio",
        "users.isVerified as teacherVerified",
        "users.academyName as teacherAcademyName",
        "users.slug as teacherSlugCol",
      ])
      .where("digitalProducts.slug", "=", input.slug)
      .where("digitalProducts.status", "=", "published")
      .executeTakeFirst();

    if (!product) {
      return new Response(
        superjson.stringify({ error: "Product not found" }),
        { status: 404 }
      );
    }

    // Try to get the current user session (don't fail if not authenticated)
    let isPurchased = false;
    try {
      const session = await getServerSessionOrThrow(request);
      const userId = (await db
        .selectFrom("sessions")
        .select("userId")
        .where("id", "=", session.id)
        .executeTakeFirst())?.userId;
      if (userId) {
        const purchase = await db
          .selectFrom("digitalProductPurchases")
          .select("id")
          .where("studentId", "=", userId)
          .where("productId", "=", product.id)
          .executeTakeFirst();
        isPurchased = !!purchase;
      }
    } catch (error) {
      // User is not authenticated or session is invalid, treat as unauthenticated
      // isPurchased remains false
    }

        await db.updateTable("digitalProducts")
      .set({ views: sql`views + 1` })
      .where("id", "=", product.id)
      .execute()
      .catch((err) => {
        console.error("Failed to increment product view count:", err);
      });

    // Fetch the individual files (chapters) for the product's Files list —
    // mirrors the "test items" list on the mock test detail page.
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
    // helpers/seoIndexability.tsx for the full rule set and rationale.
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
       .execute();

   const output: OutputType = {
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
        examName: product.examName ?? null,
        examId: product.examId ?? null,
        rating: product.rating ? Number(product.rating) : null,
        reviewsCount: product.reviewsCount ? Number(product.reviewsCount) : 0,
        totalPurchases: product.totalPurchases ? Number(product.totalPurchases) : 0,
        views: Number(product.views ?? 0),
        fileCount,
        files,
        isPurchased,
        publishedAt: product.publishedAt,
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

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching shop product details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch product details", details: errorMessage }),
      { status: 500 }
    );
  }
}