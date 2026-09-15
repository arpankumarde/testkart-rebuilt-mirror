import { schema, OutputType } from "./get_GET.schema";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "manager"]);
    
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    const input = schema.parse({ id: idParam ? parseInt(idParam, 10) : undefined });
    
    const post = await db.selectFrom("blogPosts")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!post) {
      throw new Error("Post not found");
    }

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