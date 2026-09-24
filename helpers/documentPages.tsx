import { db } from "./db";
import { deleteFromR2, uploadToR2 } from "./r2Client";
import { renderDocumentPages, type RenderedPage } from "./pdfPreviewRender";

// Rendered pages sit beside the public preview images under random keys. A key only ever reaches a browser
// for a page inside a study note's public preview; every other page is served through endpoints/reader/page.
const PAGE_IMAGE_FOLDER = "products/previews";
const RENDER_AHEAD_PAGES = 6;
const RENDER_BUDGET_MS = 9_000;

export type StoredPage = {
  imageKey: string;
  width: number;
  height: number;
  sourcePageCount: number;
};

export function findStoredPage(sourceUrl: string, pageNumber: number): Promise<StoredPage | undefined> {
  return db
    .selectFrom("pdfPreviewPages")
    .select(["imageKey", "width", "height", "sourcePageCount"])
    .where("sourceUrl", "=", sourceUrl)
    .where("pageNumber", "=", pageNumber)
    .executeTakeFirst();
}

async function storePage(sourceUrl: string, page: RenderedPage, sourcePageCount: number): Promise<StoredPage | undefined> {
  const imageKey = `${PAGE_IMAGE_FOLDER}/${crypto.randomUUID()}.webp`;
  await uploadToR2(imageKey, page.data, "image/webp");
  const inserted = await db
    .insertInto("pdfPreviewPages")
    .values({
      sourceUrl,
      pageNumber: page.pageNumber,
      imageKey,
      width: page.width,
      height: page.height,
      sourcePageCount,
    })
    .onConflict((oc) => oc.columns(["sourceUrl", "pageNumber"]).doNothing())
    .returning(["imageKey", "width", "height", "sourcePageCount"])
    .executeTakeFirst();
  if (inserted) return inserted;

  // A concurrent request stored this page first; keep its image and drop the duplicate.
  await deleteFromR2(imageKey);
  return findStoredPage(sourceUrl, page.pageNumber);
}

// Returns the stored image of a page, rendering it on first request together with the next few missing pages,
// so reading straight through downloads the source once every few pages. null means the page is past the end
// of the document. lastPage caps how far ahead is rendered (a public preview's page count).
export async function ensureStoredPage(
  sourceUrl: string,
  pageNumber: number,
  lastPage?: number
): Promise<StoredPage | null> {
  const cached = await findStoredPage(sourceUrl, pageNumber);
  if (cached) return cached;

  const known = await db
    .selectFrom("pdfPreviewPages")
    .select("sourcePageCount")
    .where("sourceUrl", "=", sourceUrl)
    .limit(1)
    .executeTakeFirst();
  if (known && pageNumber > known.sourcePageCount) return null;

  const renderUpTo = Math.min(
    pageNumber + RENDER_AHEAD_PAGES - 1,
    lastPage ?? Number.MAX_SAFE_INTEGER,
    known?.sourcePageCount ?? Number.MAX_SAFE_INTEGER
  );
  const alreadyStored = await db
    .selectFrom("pdfPreviewPages")
    .select("pageNumber")
    .where("sourceUrl", "=", sourceUrl)
    .where("pageNumber", ">", pageNumber)
    .where("pageNumber", "<=", renderUpTo)
    .execute();
  const stored = new Set(alreadyStored.map((row) => row.pageNumber));
  const wanted = [pageNumber];
  for (let next = pageNumber + 1; next <= renderUpTo; next++) {
    if (!stored.has(next)) wanted.push(next);
  }

  const rendered = await renderDocumentPages(sourceUrl, wanted, Date.now() + RENDER_BUDGET_MS);
  if (pageNumber > rendered.pageCount) return null;

  const results = await Promise.all(
    rendered.pages.map((page) => storePage(sourceUrl, page, rendered.pageCount))
  );
  const index = rendered.pages.findIndex((page) => page.pageNumber === pageNumber);
  return (index >= 0 ? results[index] : undefined) ?? (await findStoredPage(sourceUrl, pageNumber)) ?? null;
}