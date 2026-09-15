import { schema, OutputType } from "./react_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    let userReaction: "like" | "dislike" | null = null;

    const existing = await db
      .selectFrom("blogPostReactions")
      .select(["id", "reaction"])
      .where("postId", "=", input.postId)
      .where("sessionId", "=", input.sessionId)
      .executeTakeFirst();

    if (existing) {
      if (existing.reaction === input.reaction) {
        // Same reaction clicked, toggle off
        await db
          .deleteFrom("blogPostReactions")
          .where("id", "=", existing.id)
          .execute();
        userReaction = null;
      } else {
        // Different reaction clicked, update
        await db
          .updateTable("blogPostReactions")
          .set({
            reaction: input.reaction,
            updatedAt: new Date(),
          })
          .where("id", "=", existing.id)
          .execute();
        userReaction = input.reaction;
      }
    } else {
      // No existing reaction, insert
      await db
        .insertInto("blogPostReactions")
        .values({
          postId: input.postId,
          sessionId: input.sessionId,
          reaction: input.reaction,
          updatedAt: new Date(),
        })
        .execute();
      userReaction = input.reaction;
    }

    // Count totals for the post
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

    return new Response(
      superjson.stringify({
        likes,
        dislikes,
        userReaction,
      } satisfies OutputType)
    );
  } catch (error: any) {
    console.error("POST blog/react error:", error);
    return new Response(superjson.stringify({ error: error.message }), {
      status: 400,
    });
  }
}