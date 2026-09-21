import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    
    const parsedInput = {
      ...searchParams,
      postId: searchParams.postId ? parseInt(searchParams.postId, 10) : undefined,
      page: searchParams.page ? parseInt(searchParams.page, 10) : undefined,
      limit: searchParams.limit ? parseInt(searchParams.limit, 10) : undefined,
    };
    
    const input = schema.parse(parsedInput);
    
    let query = db.selectFrom("blogComments")
      .innerJoin("users", "blogComments.userId", "users.id")
      .innerJoin("blogPosts", "blogComments.postId", "blogPosts.id");

    if (input.status) {
      query = query.where("blogComments.status", "=", input.status);
    }
    
    if (input.postId) {
      query = query.where("blogComments.postId", "=", input.postId);
    }

    const countResult = await query
      .select((eb) => eb.fn.count<string | number>("blogComments.id").as("total"))
      .executeTakeFirst();
      
    const total = Number(countResult?.total || 0);

    const comments = await query
      .select([
        "blogComments.id",
        "blogComments.postId",
        "blogComments.userId",
        "blogComments.parentId",
        "blogComments.content",
        "blogComments.status",
        "blogComments.createdAt",
        "blogComments.updatedAt",
        "users.displayName as authorName",
        "users.avatarUrl as authorAvatar",
        "blogPosts.title as postTitle"
      ])
      .orderBy("blogComments.createdAt", "desc")
      .limit(input.limit)
      .offset((input.page - 1) * input.limit)
      .execute();

    return new Response(superjson.stringify({
      comments,
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