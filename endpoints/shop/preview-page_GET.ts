import { db } from "../../helpers/db";
import { deleteFromR2, getPublicUrl, uploadToR2 } from "../../helpers/r2Client";
import { PdfPreviewUnavailableError, renderPdfPreviewPage } from "../../helpers/pdfPreviewRender";
import { schema, OutputType } from "./preview-page_GET.schema";
import superjson from "superjson";

// Preview pages are served as rendered images, never as the PDF itself, so only the first
// previewPages pages of a paid file ever leave the server. Each page is rendered on first request
// and reused from pdf_preview_pages after that.
const PREVIEW_IMAGE_FOLDER = "products/previews";

type StoredPreviewPage = {
  imageKey: string;
  width: number;
  height: number;
  sourcePageCount: number;
};

function findPreviewPage(sourceUrl: string, pageNumber: number): Promise<StoredPreviewPage | undefined> {
  return db
    .selectFrom("pdfPreviewPages")
    .select(["imageKey", "width", "height", "sourcePageCount"])
    .where("sourceUrl", "=", sourceUrl)
    .where("pageNumber", "=", pageNumber)
    .executeTakeFirst();
}

function toOutput(stored: StoredPreviewPage, page: number, previewPages: number): OutputType {
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

    const cached = await findPreviewPage(sourceUrl, input.page);
    if (cached) {
      return new Response(superjson.stringify(toOutput(cached, input.page, previewPages)));
    }

    const rendered = await renderPdfPreviewPage(sourceUrl, input.page);
    if (!rendered.image) {
      return new Response(
        superjson.stringify({ error: "This page is not part of the preview" }),
        { status: 404 }
      );
    }

    const imageKey = `${PREVIEW_IMAGE_FOLDER}/${crypto.randomUUID()}.webp`;
    await uploadToR2(imageKey, rendered.image.data, "image/webp");
    const inserted = await db
      .insertInto("pdfPreviewPages")
      .values({
        sourceUrl,
        pageNumber: input.page,
        imageKey,
        width: rendered.image.width,
        height: rendered.image.height,
        sourcePageCount: rendered.pageCount,
      })
      .onConflict((oc) => oc.columns(["sourceUrl", "pageNumber"]).doNothing())
      .returning(["imageKey", "width", "height", "sourcePageCount"])
      .executeTakeFirst();

    let stored: StoredPreviewPage | undefined = inserted;
    if (!stored) {
      // A concurrent request stored this page first; keep its image and drop the duplicate.
      await deleteFromR2(imageKey);
      stored = await findPreviewPage(sourceUrl, input.page);
    }
    if (!stored) {
      throw new Error("Preview page was rendered but not stored");
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