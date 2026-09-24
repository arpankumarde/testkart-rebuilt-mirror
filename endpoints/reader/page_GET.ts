import superjson from "superjson";
import { downloadFromR2 } from "../../helpers/r2Client";
import { ensureStoredPage } from "../../helpers/documentPages";
import { recordPageView } from "../../helpers/documentPageViews";
import { getClientIp } from "../../helpers/getClientIp";
import { watermarkPage } from "../../helpers/pageWatermark";
import { parseReaderDocumentRef } from "../../helpers/readerDocumentRef";
import { readerErrorResponse, resolveReaderDocument } from "../../helpers/readerDocuments";

// Serves one page of a document as a watermarked image. The file itself and its storage location never leave
// the server; each page is checked against the viewer's access and page limits.
export async function handle(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const parsed = parseReaderDocumentRef(params);
    const page = Number(params.get("page"));
    if (!parsed.success || !Number.isInteger(page) || page < 1) {
      return new Response(superjson.stringify({ error: "Invalid page request." }), { status: 400 });
    }
    const ref = parsed.data;
    const document = await resolveReaderDocument(request, ref);
    if (document.lastPage !== null && page > document.lastPage) {
      return new Response(superjson.stringify({ error: "This page is not part of the preview." }), { status: 404 });
    }

    const withinLimits = await recordPageView({
      userId: document.viewer?.id ?? null,
      ip: getClientIp(request),
      documentType: ref.type,
      documentId: ref.type === "note" || ref.type === "notePreview" ? ref.productId : ref.courseId,
      itemId: ref.type === "note" || ref.type === "notePreview" ? (ref.fileId ?? null) : ref.lessonId,
      pageNumber: page,
    });
    if (!withinLimits) {
      return new Response(
        superjson.stringify({ error: "Too many pages opened in a short time. Wait a minute and try again." }),
        { status: 429 }
      );
    }

    const stored = await ensureStoredPage(document.sourceUrl, page, document.lastPage ?? undefined);
    if (!stored) {
      return new Response(superjson.stringify({ error: "Page not found." }), { status: 404 });
    }

    const image = await downloadFromR2(stored.imageKey);
    const body = await watermarkPage(
      image,
      document.viewer
        ? {
            kind: "viewer",
            userId: document.viewer.id,
            name: document.viewer.displayName,
            email: document.viewer.email,
            mobileNumber: document.viewer.mobileNumber,
          }
        : { kind: "preview" }
    );

    return new Response(body, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=1800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return readerErrorResponse(error, "Error serving reader page");
  }
}