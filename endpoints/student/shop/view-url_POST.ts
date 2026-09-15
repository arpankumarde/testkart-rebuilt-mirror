import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./view-url_POST.schema";
import { getSignedDownloadUrl } from "../../../helpers/r2Client";
import { extractR2Key } from "../../../helpers/extractR2Key";
import superjson from "superjson";

// Short-lived on purpose: this URL is only ever consumed by the in-app
// react-pdf viewer (never exposed as a plain <a href> download link), so a
// long expiry isn't needed the way the old raw-download endpoint used one.
const EXPIRATION_SECONDS = 1800; // 30 minutes

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Verify purchase and get product details
    const purchase = await db
      .selectFrom("digitalProductPurchases")
      .innerJoin("digitalProducts", "digitalProducts.id", "digitalProductPurchases.productId")
      .select([
        "digitalProductPurchases.id as purchaseId",
        "digitalProductPurchases.downloadCount",
        "digitalProducts.pdfUrl",
        "digitalProducts.title",
      ])
      .where("digitalProductPurchases.productId", "=", input.productId)
      .where("digitalProductPurchases.studentId", "=", user.id)
      .executeTakeFirst();

    if (!purchase) {
      return new Response(
        superjson.stringify({ error: "Purchase not found or unauthorized" }),
        { status: 403 }
      );
    }

    let viewFileUrl: string | null = null;

    if (input.fileId) {
      // Fetch the specific file from digital_product_files
      const file = await db
        .selectFrom("digitalProductFiles")
        .select(["id", "fileUrl", "title"])
        .where("id", "=", input.fileId)
        .where("productId", "=", input.productId)
        .executeTakeFirst();

      if (!file) {
        return new Response(
          superjson.stringify({ error: "File not found or does not belong to this product" }),
          { status: 404 }
        );
      }

      viewFileUrl = file.fileUrl;
    } else {
      // Fallback to the product's main pdfUrl
      viewFileUrl = purchase.pdfUrl;
    }

    if (!viewFileUrl) {
      return new Response(
        superjson.stringify({ error: "Product file not available" }),
        { status: 404 }
      );
    }

    // Track viewing activity on the same columns the old download flow used
    // (downloadCount / lastDownloadedAt) — repurposed here as "last viewed"
    // since students can no longer download the file directly, but the
    // student-facing UI still shows a "Viewed" / "Not Viewed" status badge
    // that depends on this timestamp being kept up to date.
    await db
      .updateTable("digitalProductPurchases")
      .set({
        downloadCount: (purchase.downloadCount || 0) + 1,
        lastDownloadedAt: new Date(),
      })
      .where("id", "=", purchase.purchaseId)
      .execute();

    const r2Key = extractR2Key(viewFileUrl);
    const signedUrl = await getSignedDownloadUrl(r2Key, EXPIRATION_SECONDS);

    return new Response(
      superjson.stringify({ signedUrl, expiresIn: EXPIRATION_SECONDS } satisfies OutputType),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating view URL:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to generate view URL", details: errorMessage }),
      { status: 500 }
    );
  }
}
