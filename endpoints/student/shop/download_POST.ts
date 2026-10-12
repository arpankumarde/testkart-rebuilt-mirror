import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./download_POST.schema";
import { getSignedDownloadUrl } from "../../../helpers/r2Client";
import { extractR2Key } from "../../../helpers/extractR2Key";
import { isBearerRequest } from "../../../helpers/requestAuthTransport";
import superjson from "superjson";

const SIGNED_URL_EXPIRE_SECONDS = 3600; // 1 hour

const pdfFilename = (title: string) => {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
  return `${base || "study-note"}.pdf`;
};

export async function handle(request: Request): Promise<Response> {
  try {
    // Bearer requests are the mobile app's file download and need only the purchase (app 4.9.6 and older
    // still call this). Web (cookie) requests also need the teacher's allow_download opt-in; without it the
    // note stays in the watermarked reader (endpoints/reader).
    const isBearer = isBearerRequest(request);
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
        "digitalProducts.allowDownload",
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

    if (!isBearer && !purchase.allowDownload) {
      return new Response(
        superjson.stringify({ error: "Downloads are turned off for this note. Open it in the reader instead." }),
        { status: 403 }
      );
    }

    let downloadFileUrl: string | null = null;
    let downloadTitle = purchase.title;

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

      downloadFileUrl = file.fileUrl;
      downloadTitle = file.title || purchase.title;
    } else {
      // Fallback to the product's main pdfUrl
      downloadFileUrl = purchase.pdfUrl;
    }

    if (!downloadFileUrl) {
      return new Response(
        superjson.stringify({ error: "Product file not available" }),
        { status: 404 }
      );
    }

    // Update download stats
    await db
      .updateTable("digitalProductPurchases")
      .set({
        downloadCount: (purchase.downloadCount || 0) + 1,
        lastDownloadedAt: new Date(),
      })
      .where("id", "=", purchase.purchaseId)
      .execute();

    // Generate a signed URL valid for 1 hour. Web downloads are served as an attachment.
    const r2Key = extractR2Key(downloadFileUrl);
    const downloadUrl = await getSignedDownloadUrl(
      r2Key,
      SIGNED_URL_EXPIRE_SECONDS,
      isBearer ? undefined : pdfFilename(downloadTitle)
    );

    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRE_SECONDS * 1000).toISOString();

    return new Response(
      superjson.stringify({ downloadUrl, expiresAt } satisfies OutputType),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating download URL:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to generate download URL", details: errorMessage }),
      { status: 500 }
    );
  }
}