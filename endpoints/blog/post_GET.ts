import { schema, OutputType } from "./post_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const slugParam = url.searchParams.get("slug");
    const input = schema.parse({ slug: slugParam || undefined });
    
    const post = await db.selectFrom("blogPosts")
      .leftJoin("blogCategories", "blogPosts.categoryId", "blogCategories.id")
      .leftJoin("admins", "blogPosts.authorId", "admins.id")
      .leftJoin("users", "blogPosts.authorId", "users.id")
      .selectAll("blogPosts")
      .select([
        "blogCategories.name as categoryName",
        "blogCategories.slug as categorySlug",
        sql<string | null>`COALESCE(admins.full_name, users.display_name)`.as("authorName"),
        sql<string | null>`CASE WHEN admins.id IS NOT NULL THEN admins.avatar_url ELSE users.avatar_url END`.as("authorAvatar")
      ])
      .where("blogPosts.slug", "=", input.slug)
      .where("blogPosts.status", "=", "published")
      .executeTakeFirst();

    if (!post) {
      throw new Error("Post not found");
    }

    // Increment view count dynamically per pull
    await db.updateTable("blogPosts")
      .set((eb) => ({ viewCount: sql<number>`view_count + 1` }))
      .where("id", "=", post.id)
      .execute();
      
    // Overwrite object memory representation prior to dispatching responses
    post.viewCount += 1;

    const postTags = await db.selectFrom("blogPostTags")
      .innerJoin("blogTags", "blogPostTags.tagId", "blogTags.id")
      .select("blogTags.name")
      .where("blogPostTags.postId", "=", post.id)
      .execute();

    const output: OutputType = {
      post: {
        ...post,
        tags: postTags.map(t => t.name)
      }
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}