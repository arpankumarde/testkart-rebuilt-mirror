import { schema, OutputType } from "./reactions_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const postIdStr = url.searchParams.get("postId");
    const sessionId = url.searchParams.get("sessionId");

    if (!postIdStr) {
      throw new Error("postId is required");
    }

    const postId = Number(postIdStr);
    if (isNaN(postId)) {
      throw new Error("Invalid postId");
    }

    const input = schema.parse({ 
      postId, 
      sessionId: sessionId || undefined 
    });

    const counts = await db
      .selectFrom("blogPostReactions")
      .select([
        "reaction",
        db.fn.count<string | number>("id").as("count")
      ])
      .where("postId", "=", input.postId)
      .groupBy("reaction")
      .execute();

    let likes = 0;
    let dislikes = 0;

    for (const row of counts) {
      const count = Number(row.count);
      if (row.reaction === "like") {
        likes = count;
      } else if (row.reaction === "dislike") {
        dislikes = count;
      }
    }

    let userReaction: "like" | "dislike" | null = null;
    if (input.sessionId) {
      const existing = await db
        .selectFrom("blogPostReactions")
        .select("reaction")
        .where("postId", "=", input.postId)
        .where("sessionId", "=", input.sessionId)
        .executeTakeFirst();
        
      if (existing && (existing.reaction === "like" || existing.reaction === "dislike")) {
        userReaction = existing.reaction as "like" | "dislike";
      }
    }

    return new Response(
      superjson.stringify({
        likes,
        dislikes,
        userReaction,
      } satisfies OutputType)
    );
  } catch (error: any) {
    console.error("GET blog/reactions error:", error);
    return new Response(superjson.stringify({ error: error.message }), {
      status: 400,
    });
  }
}