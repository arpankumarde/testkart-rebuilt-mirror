import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    
    // Ensure post exists and is actively published to prevent malicious deep injections
    const post = await db.selectFrom("blogPosts")
      .select("id")
      .where("id", "=", input.postId)
      .where("status", "=", "published")
      .executeTakeFirst();
      
    if (!post) {
      throw new Error("Post not found or not published.");
    }
    
    if (input.parentId) {
      const parent = await db.selectFrom("blogComments")
        .select("id")
        .where("id", "=", input.parentId)
        .where("postId", "=", input.postId)
        .where("status", "=", "approved")
        .executeTakeFirst();
        
      if (!parent) {
        throw new Error("Parent comment not found or not approved.");
      }
    }

    const comment = await db.insertInto("blogComments")
      .values({
        postId: input.postId,
        userId: user.id,
        content: input.content,
        parentId: input.parentId ?? null,
        status: "pending", // All submissions enter staging
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(superjson.stringify({ success: true, comment } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}