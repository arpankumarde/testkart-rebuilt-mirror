import { schema, OutputType, AdminPostListItem } from "./list_GET.schema";
import { CONTENT_STALE_DAYS } from "../../content/dashboard_GET.schema";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { sql } from "kysely";

const SORT_COLUMNS = {
  title: "blogPosts.title",
  author: "admins.fullName",
  status: "blogPosts.status",
  publishedAt: "blogPosts.publishedAt",
  viewCount: "blogPosts.viewCount",
  readingTimeMinutes: "blogPosts.readingTimeMinutes",
} as const;

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "manager"]);
    
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    
    const parsedInput = {
      ...searchParams,
      categoryId: searchParams.categoryId ? parseInt(searchParams.categoryId, 10) : undefined,
      page: searchParams.page ? parseInt(searchParams.page, 10) : undefined,
      limit: searchParams.limit ? parseInt(searchParams.limit, 10) : undefined,
    };
    
    const input = schema.parse(parsedInput);
    
    let query = db.selectFrom("blogPosts")
      .leftJoin("blogCategories", "blogPosts.categoryId", "blogCategories.id")
      .leftJoin("admins", "blogPosts.authorId", "admins.id");

    if (input.search) {
      const searchTerm = `%${input.search.toLowerCase()}%`;
      query = query.where((eb) => 
        eb.or([
          eb("blogPosts.title", "ilike", searchTerm),
          eb("blogPosts.slug", "ilike", searchTerm)
        ])
      );
    }
    
    if (input.type) {
      query = query.where("blogPosts.type", "=", input.type);
    }
    
    if (input.status) {
      query = query.where("blogPosts.status", "=", input.status);
    }
    
    if (input.categoryId) {
      query = query.where("blogPosts.categoryId", "=", input.categoryId);
    }

    if (input.filter === "missing-seo") {
      query = query.where((eb) =>
        eb.or([
          eb("blogPosts.seoTitle", "is", null),
          eb("blogPosts.seoTitle", "=", ""),
          eb("blogPosts.seoDescription", "is", null),
          eb("blogPosts.seoDescription", "=", ""),
        ])
      );
    } else if (input.filter === "missing-og-image") {
      query = query.where((eb) => eb.or([eb("blogPosts.ogImage", "is", null), eb("blogPosts.ogImage", "=", "")]));
    } else if (input.filter === "uncategorised") {
      query = query.where("blogPosts.categoryId", "is", null);
    } else if (input.filter === "stale") {
      query = query.where(
        "blogPosts.updatedAt",
        "<",
        sql<Date>`(now() - (${CONTENT_STALE_DAYS}::int * interval '1 day'))`
      );
    }

    const countResult = await query
      .select((eb) => eb.fn.count<string | number>("blogPosts.id").as("total"))
      .executeTakeFirst();
      
    const total = Number(countResult?.total || 0);

    let listQuery = query
      .select([
        "blogPosts.id",
        "blogPosts.authorId",
        "blogPosts.categoryId",
        "blogPosts.content",
        "blogPosts.createdAt",
        "blogPosts.excerpt",
        "blogPosts.featuredImage",
        "blogPosts.isFeatured",
        "blogPosts.ogImage",
        "blogPosts.publishedAt",
        "blogPosts.readingTimeMinutes",
        "blogPosts.seoDescription",
        "blogPosts.seoTitle",
        "blogPosts.slug",
        "blogPosts.status",
        "blogPosts.title",
        "blogPosts.type",
        "blogPosts.updatedAt",
        "blogPosts.viewCount",
        "blogCategories.name as categoryName",
        "admins.fullName as authorName",
        "admins.avatarUrl as authorAvatar",
      ]);

    if (input.sortBy) {
      const direction = input.sortOrder === "desc" ? "desc" : "asc";
      listQuery = listQuery.orderBy(SORT_COLUMNS[input.sortBy], sql`${sql.raw(direction)} nulls last`);
    }

    const posts = await listQuery
      .orderBy("blogPosts.createdAt", "desc")
      .orderBy("blogPosts.id", "desc")
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

    const outputPosts: AdminPostListItem[] = posts.map(p => ({
      ...p,
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