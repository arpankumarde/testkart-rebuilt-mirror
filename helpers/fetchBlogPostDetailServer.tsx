import { db } from "./db";
import { sql } from "kysely";
import type { OutputType } from "../endpoints/blog/post_GET.schema";

/**
 * Direct-DB counterpart to endpoints/blog/post_GET.ts, for use ONLY from
 * page prefetch (pages/blog.$blogSlug.prefetch.ts and
 * pages/help.$articleSlug.prefetch.ts).
 *
 * Those prefetch files used to call the network endpoint (getBlogPostDetail,
 * a `fetch("/_api/blog/post?slug=...")`) during server-side rendering. A
 * relative self-fetch back into the app's own API from within the SSR pass
 * is unreliable there, so the prefetchQuery never resolved before the page
 * rendered — every blog/knowledge-base article was shipping its loading
 * skeleton as the server-rendered HTML instead of the article, which is
 * invisible to crawlers that don't execute JS. Querying the DB directly here
 * (matching the pattern already used by fetchTestDetailsServer,
 * fetchCourseDetailsServer, fetchShopProductDetailsServer, and
 * fetchBundleDetailsServer) makes the prefetch resolve in-process, so the
 * real article content is present in the initial HTML.
 *
 * Keep this in sync with endpoints/blog/post_GET.ts.
 */
export async function fetchBlogPostDetailServer(slug: string): Promise<OutputType> {
  const post = await db
    .selectFrom("blogPosts")
    .leftJoin("blogCategories", "blogPosts.categoryId", "blogCategories.id")
    .leftJoin("admins", "blogPosts.authorId", "admins.id")
    .leftJoin("users", "blogPosts.authorId", "users.id")
    .selectAll("blogPosts")
    .select([
      "blogCategories.name as categoryName",
      "blogCategories.slug as categorySlug",
      sql<string | null>`COALESCE(admins.full_name, users.display_name)`.as("authorName"),
      sql<string | null>`CASE WHEN admins.id IS NOT NULL THEN admins.avatar_url ELSE users.avatar_url END`.as("authorAvatar"),
    ])
    .where("blogPosts.slug", "=", slug)
    .where("blogPosts.status", "=", "published")
    .executeTakeFirst();

  if (!post) {
    throw new Error("Post not found");
  }

  // Increment view count for this SSR-rendered pageview. The client-side
  // hook (useBlogPostQuery) sets a 10-minute staleTime specifically so it
  // doesn't immediately re-fetch endpoints/blog/post_GET.ts right after
  // hydrating this SSR data, which would otherwise double-count the view.
  await db
    .updateTable("blogPosts")
    .set(() => ({ viewCount: sql<number>`view_count + 1` }))
    .where("id", "=", post.id)
    .execute();

  post.viewCount += 1;

  const postTags = await db
    .selectFrom("blogPostTags")
    .innerJoin("blogTags", "blogPostTags.tagId", "blogTags.id")
    .select("blogTags.name")
    .where("blogPostTags.postId", "=", post.id)
    .execute();

  return {
    post: {
      ...post,
      tags: postTags.map((t) => t.name),
    },
  };
}
