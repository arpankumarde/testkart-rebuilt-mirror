import { db } from "../../helpers/db";
import { schema, OutputType } from "./preview-url_GET.schema";
import superjson from "superjson";
import { getSignedDownloadUrl } from "../../helpers/r2Client";
import { extractR2Key } from "../../helpers/extractR2Key";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const fileIdParam = url.searchParams.get("fileId");

    if (!productId) {
      return new Response(
        superjson.stringify({ error: "Product ID is required" }),
        { status: 400 }
      );
    }

    const input = schema.parse({
      productId: Number(productId),
      fileId: fileIdParam ? Number(fileIdParam) : undefined,
    });

    const product = await db
      .selectFrom("digitalProducts")
      .select([
        "digitalProducts.id",
        "digitalProducts.pdfUrl",
        "digitalProducts.previewPages",
      ])
      .where("digitalProducts.id", "=", input.productId)
      .where("digitalProducts.status", "=", "published")
      .executeTakeFirst();

    if (!product) {
      return new Response(
        superjson.stringify({ error: "Product not found" }),
        { status: 404 }
      );
    }

    // A study notes product can have several file rows (chapters); when the
    // caller asks for a specific one (e.g. clicking "Preview" on a single
    // file in the Files list), use that file's own URL instead of the
    // product's main pdfUrl. Scoped to this product's id so a fileId can't
    // be used to fetch another teacher's file.
    let sourceUrl = product.pdfUrl;
    if (input.fileId) {
      const file = await db
        .selectFrom("digitalProductFiles")
        .select(["fileUrl"])
        .where("id", "=", input.fileId)
        .where("productId", "=", input.productId)
        .executeTakeFirst();
      if (file) {
        sourceUrl = file.fileUrl;
      }
    }

    let previewUrl: string | null = null;
    if (sourceUrl && product.previewPages && product.previewPages > 0) {
      try {
        const r2Key = extractR2Key(sourceUrl);
        previewUrl = await getSignedDownloadUrl(r2Key, 300); // 5 min expiry
      } catch (err) {
        console.error("Failed to generate preview URL:", err);
      }
    }

    const output: OutputType = {
      previewUrl,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching shop preview URL:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch preview URL", details: errorMessage }),
      { status: 500 }
    );
  }
}