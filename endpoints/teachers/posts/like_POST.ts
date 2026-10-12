import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./like_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can like posts." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const post = await db
      .selectFrom("teacherPosts")
      .select(["id"])
      .where("id", "=", input.postId)
      .executeTakeFirst();

    if (!post) {
      return new Response(superjson.stringify({ error: "Post not found." }), { status: 404 });
    }

    // Community posts are public - any signed-in student can like one, no
    // follow required.
    const existing = await db
      .selectFrom("teacherPostLikes")
      .select(["id"])
      .where("postId", "=", input.postId)
      .where("studentId", "=", user.id)
      .executeTakeFirst();

    if (existing) {
      await db.deleteFrom("teacherPostLikes").where("id", "=", existing.id).execute();
    } else {
      await db
        .insertInto("teacherPostLikes")
        .values({ postId: input.postId, studentId: user.id })
        .execute();
    }

    const countRow = await db
      .selectFrom("teacherPostLikes")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("postId", "=", input.postId)
      .executeTakeFirst();

    return new Response(
      superjson.stringify({
        likedByMe: !existing,
        likeCount: Number(countRow?.count ?? 0),
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to toggle post like:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to update like.", details: errorMessage }),
      { status: 500 }
    );
  }
}
