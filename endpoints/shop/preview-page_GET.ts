import { db } from "../../helpers/db";
import { getPublicUrl } from "../../helpers/r2Client";
import { PdfPreviewUnavailableError } from "../../helpers/pdfPreviewRender";
import { ensureStoredPage, type StoredPage } from "../../helpers/documentPages";
import { schema, OutputType } from "./preview-page_GET.schema";
import superjson from "superjson";

// Preview pages are served as rendered images, never as the PDF itself, so only the first previewPages pages
// of a paid file ever leave the server. The mobile app reads this; the web uses the watermarked
// endpoints/reader pages instead.
function toOutput(stored: StoredPage, page: number, previewPages: number): OutputType {
  return {
    page,
    totalPages: Math.min(previewPages, stored.sourcePageCount),
    imageUrl: getPublicUrl(stored.imageKey),
    width: stored.width,
    height: stored.height,
  };
}

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const fileIdParam = url.searchParams.get("fileId");
    const parsed = schema.safeParse({
      productId: Number(url.searchParams.get("productId")),
      fileId: fileIdParam ? Number(fileIdParam) : undefined,
      page: Number(url.searchParams.get("page") ?? "1"),
    });
    if (!parsed.success) {
      return new Response(
        superjson.stringify({ error: "Invalid preview request" }),
        { status: 400 }
      );
    }
    const input = parsed.data;

    const product = await db
      .selectFrom("digitalProducts")
      .select(["id", "pdfUrl", "previewPages"])
      .where("id", "=", input.productId)
      .where("status", "=", "published")
      .executeTakeFirst();
    if (!product) {
      return new Response(
        superjson.stringify({ error: "Product not found" }),
        { status: 404 }
      );
    }

    const previewPages = product.previewPages ?? 0;
    if (input.page > previewPages) {
      return new Response(
        superjson.stringify({ error: "This page is not part of the preview" }),
        { status: 404 }
      );
    }

    let sourceUrl = product.pdfUrl;
    if (input.fileId) {
      const file = await db
        .selectFrom("digitalProductFiles")
        .select("fileUrl")
        .where("id", "=", input.fileId)
        .where("productId", "=", product.id)
        .executeTakeFirst();
      if (!file) {
        return new Response(
          superjson.stringify({ error: "File not found" }),
          { status: 404 }
        );
      }
      sourceUrl = file.fileUrl;
    }

    const stored = await ensureStoredPage(sourceUrl, input.page, previewPages);
    if (!stored) {
      return new Response(
        superjson.stringify({ error: "This page is not part of the preview" }),
        { status: 404 }
      );
    }

    return new Response(superjson.stringify(toOutput(stored, input.page, previewPages)));
  } catch (error) {
    if (error instanceof PdfPreviewUnavailableError) {
      return new Response(
        superjson.stringify({ error: "Preview is not available for this file" }),
        { status: 422 }
      );
    }
    console.error("Error rendering shop preview page:", error);
    return new Response(
      superjson.stringify({ error: "Failed to load the preview page" }),
      { status: 500 }
    );
  }
}