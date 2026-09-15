import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const postIdParam = url.searchParams.get("postId");
    const input = schema.parse({ postId: postIdParam ? parseInt(postIdParam, 10) : undefined });
    
    const comments = await db.selectFrom("blogComments")
      .innerJoin("users", "blogComments.userId", "users.id")
      .selectAll("blogComments")
      .select([
        "users.displayName as authorName",
        "users.avatarUrl as authorAvatar"
      ])
      .where("blogComments.postId", "=", input.postId)
      .where("blogComments.status", "=", "approved")
      .orderBy("blogComments.createdAt", "asc")
      .execute();

    return new Response(superjson.stringify({ comments } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}