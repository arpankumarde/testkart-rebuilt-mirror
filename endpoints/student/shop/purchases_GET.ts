import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./purchases_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 20;

    const offset = (page - 1) * limit;

    const purchases = await db
      .selectFrom("digitalProductPurchases")
      .innerJoin("digitalProducts", "digitalProducts.id", "digitalProductPurchases.productId")
      .innerJoin("users", "users.id", "digitalProducts.teacherId")
      .select([
        "digitalProductPurchases.id as purchaseId",
        "digitalProductPurchases.purchasedAt",
        "digitalProductPurchases.downloadCount",
        "digitalProductPurchases.lastDownloadedAt",
        "digitalProducts.id as productId",
        "digitalProducts.title",
        "digitalProducts.slug",
        "digitalProducts.thumbnailUrl",
        "digitalProducts.category",
        "users.displayName as teacherName",
      ])
      .where("digitalProductPurchases.studentId", "=", user.id)
      .orderBy("digitalProductPurchases.purchasedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

     // Batch query for file counts per product
     const productIds = purchases.map((p) => p.productId);
     let fileCountMap = new Map<number, number>();
     let reviewedProductIds = new Set<number>();
    let reviewDataMap = new Map<number, { rating: number; reviewText: string | null }>();
 
     if (productIds.length > 0) {
       const fileCounts = await db
         .selectFrom("digitalProductFiles")
         .select([
          "productId",
          db.fn.count("id").as("fileCount"),
        ])
        .where("productId", "in", productIds)
        .groupBy("productId")
        .execute();

       for (const row of fileCounts) {
         fileCountMap.set(row.productId, Number(row.fileCount));
       }

       const reviews = await db
         .selectFrom("reviews")
         .select("digitalProductId")
        .select("rating")
        .select("reviewText")
         .where("userId", "=", user.id)
         .where("digitalProductId", "in", productIds)
         .execute();
 
       for (const review of reviews) {
         if (review.digitalProductId != null) {
           reviewedProductIds.add(review.digitalProductId);
          reviewDataMap.set(review.digitalProductId, { rating: review.rating, reviewText: review.reviewText });
         }
       }
      }
 
     const output: OutputType = {
      purchases: purchases.map((p) => ({
        ...p,
        downloadCount: p.downloadCount ? Number(p.downloadCount) : 0,
        fileCount: fileCountMap.get(p.productId) ?? 1,
       hasReviewed: reviewedProductIds.has(p.productId),
       reviewRating: reviewedProductIds.has(p.productId) ? reviewDataMap.get(p.productId)!.rating : null,
       reviewText: reviewedProductIds.has(p.productId) ? reviewDataMap.get(p.productId)!.reviewText : null,
      })),
      page,
      limit,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing student purchases:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to list purchases", details: errorMessage }),
      { status: 500 }
    );
  }
}