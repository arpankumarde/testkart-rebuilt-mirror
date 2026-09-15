import { db } from "./db";
import type { OutputType } from "../endpoints/news/list_GET.schema";

/**
 * Shared query behind endpoints/news/list_GET.ts and the SSR prefetch in
 * pages/news-and-events.prefetch.ts. A prefetch cannot call the app's own
 * /_api route during the SSR pass (see helpers/fetchBlogPostDetailServer.tsx),
 * so both paths run this directly against the DB. Ordered newest-first.
 */
export async function fetchNewsListServer(): Promise<OutputType> {
  const items = await db
    .selectFrom("newsCoverage")
    .select([
      "id",
      "title",
      "slug",
      "publicationName",
      "imageUrl",
      "excerpt",
      "publishedAt",
    ])
    .where("isPublished", "=", true)
    .orderBy("publishedAt", "desc")
    .orderBy("id", "desc")
    .execute();

  return { items };
}
