import { db } from "./db";
import { sql } from "kysely";
import type { OutputType } from "../endpoints/news/details_GET.schema";

/**
 * Shared query behind endpoints/news/details_GET.ts and the SSR prefetch in
 * pages/news-and-events.$newsSlug.prefetch.ts. Throws "Not found" when the
 * slug does not resolve to a published item; both callers turn that into a 404.
 *
 * An exact slug match always wins. Only when there is none does this fall back
 * to previousSlugs, which holds the slugs an editor has renamed away from -
 * callers compare the returned item.slug against the requested one and issue a
 * 301 to the canonical URL, so old indexed links never dead-end.
 */
export async function fetchNewsDetailServer(slug: string): Promise<OutputType> {
  const item =
    (await db
      .selectFrom("newsCoverage")
      .selectAll()
      .where("slug", "=", slug)
      .where("isPublished", "=", true)
      .executeTakeFirst()) ??
    (await db
      .selectFrom("newsCoverage")
      .selectAll()
      .where(sql<boolean>`previous_slugs @> ARRAY[${slug}]::text[]`)
      .where("isPublished", "=", true)
      .executeTakeFirst());

  if (!item) {
    throw new Error("Not found");
  }

  return { item };
}
