import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { ensureStoredPage } from "../../helpers/documentPages";
import { parseReaderDocumentRef } from "../../helpers/readerDocumentRef";
import { readerErrorResponse, resolveReaderDocument } from "../../helpers/readerDocuments";
import type { OutputType } from "./info_GET.schema";

// Opens a document for the reader: checks access, renders the first pages if they are not stored yet, and
// returns the page count. The pages themselves come from endpoints/reader/page.
export async function handle(request: Request): Promise<Response> {
  try {
    const parsed = parseReaderDocumentRef(new URL(request.url).searchParams);
    if (!parsed.success) {
      return new Response(superjson.stringify({ error: "Invalid document request." }), { status: 400 });
    }
    const ref = parsed.data;
    const document = await resolveReaderDocument(request, ref);

    const firstPage = await ensureStoredPage(document.sourceUrl, 1, document.lastPage ?? undefined);
    if (!firstPage) {
      return new Response(superjson.stringify({ error: "This document has no pages." }), { status: 422 });
    }

    // Keeps the "Viewed" badge on the student's purchases working.
    if (ref.type === "note" && document.viewer) {
      await db
        .updateTable("digitalProductPurchases")
        .set({
          downloadCount: sql<number>`coalesce(download_count, 0) + 1`,
          lastDownloadedAt: new Date(),
        })
        .where("productId", "=", ref.productId)
        .where("studentId", "=", document.viewer.id)
        .execute();
    }

    const output: OutputType = {
      title: document.title,
      totalPages: Math.min(firstPage.sourcePageCount, document.lastPage ?? firstPage.sourcePageCount),
      firstPage: { width: firstPage.width, height: firstPage.height },
    };
    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return readerErrorResponse(error, "Error opening reader document");
  }
}