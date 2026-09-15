import { schema, OutputType, PublicPostListItem } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    
    const parsedInput = {
      ...searchParams,
      page: searchParams.page ? parseInt(searchParams.page, 10) : undefined,
      limit: searchParams.limit ? parseInt(searchParams.limit, 10) : undefined,
    };
    
    const input = schema.parse(parsedInput);
    
    let query = db.selectFrom("blogPosts")
      .leftJoin("blogCategories", "blogPosts.categoryId", "blogCategories.id")
      .leftJoin("admins", "blogPosts.authorId", "admins.id")
      .leftJoin("users", "blogPosts.authorId", "users.id")
      .where("blogPosts.status", "=", "published")
      .where("blogPosts.type", "=", input.type);

    if (input.search) {
      const searchTerm = `%${input.search.toLowerCase()}%`;
      query = query.where((eb) => 
        eb.or([
          eb("blogPosts.title", "ilike", searchTerm),
          eb("blogPosts.excerpt", "ilike", searchTerm)
        ])
      );
    }
    
    if (input.categorySlug) {
      query = query.where("blogCategories.slug", "=", input.categorySlug);
    }
    
    if (input.tag) {
      const tagPosts = await db.selectFrom("blogPostTags")
        .innerJoin("blogTags", "blogPostTags.tagId", "blogTags.id")
        .select("blogPostTags.postId")
        .where("blogTags.slug", "=", input.tag)
        .execute();
      
      const tagPostIds = tagPosts.map(tp => tp.postId);
      if (tagPostIds.length === 0) {
        return new Response(superjson.stringify({
          posts: [],
          total: 0,
          totalPages: 0
        } satisfies OutputType), {
          headers: { "Content-Type": "application/json" },
        });
      }
      query = query.where("blogPosts.id", "in", tagPostIds);
    }

    const countResult = await query
      .select((eb) => eb.fn.count<string | number>("blogPosts.id").as("total"))
      .executeTakeFirst();
      
    const total = Number(countResult?.total || 0);

    const posts = await query
      .select([
        "blogPosts.id",
        "blogPosts.title",
        "blogPosts.slug",
        "blogPosts.excerpt",
        "blogPosts.type",
        "blogPosts.featuredImage",
        "blogPosts.publishedAt",
        "blogPosts.readingTimeMinutes",
        "blogPosts.viewCount",
        "blogPosts.isFeatured",
        "blogCategories.name as categoryName",
        "blogCategories.slug as categorySlug",
        sql<string | null>`COALESCE(admins.full_name, users.display_name)`.as("authorName"),
        sql<string | null>`CASE WHEN admins.id IS NOT NULL THEN admins.avatar_url ELSE users.avatar_url END`.as("authorAvatar"),
      ])
      .orderBy("blogPosts.isFeatured", "desc")
      .orderBy("blogPosts.publishedAt", "desc")
      .limit(input.limit)
      .offset((input.page - 1) * input.limit)
      .execute();

    const postIds = posts.map(p => p.id);
    let postTags: { postId: number, tagName: string }[] = [];
    if (postIds.length > 0) {
      postTags = await db.selectFrom("blogPostTags")
        .innerJoin("blogTags", "blogPostTags.tagId", "blogTags.id")
        .select(["blogPostTags.postId", "blogTags.name as tagName"])
        .where("blogPostTags.postId", "in", postIds)
        .execute();
    }

    const tagsByPostId = postTags.reduce((acc, tag) => {
      if (!acc[tag.postId]) acc[tag.postId] = [];
      acc[tag.postId].push(tag.tagName);
      return acc;
    }, {} as Record<number, string[]>);

    const outputPosts: PublicPostListItem[] = posts.map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      type: p.type,
      categoryName: p.categoryName,
      categorySlug: p.categorySlug,
      featuredImage: p.featuredImage,
      publishedAt: p.publishedAt,
      readingTimeMinutes: p.readingTimeMinutes,
      viewCount: p.viewCount,
      authorName: p.authorName,
      authorAvatar: p.authorAvatar,
      isFeatured: p.isFeatured,
      tags: tagsByPostId[p.id] || []
    }));

    return new Response(superjson.stringify({
      posts: outputPosts,
      total,
      totalPages: Math.ceil(total / input.limit)
    } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}