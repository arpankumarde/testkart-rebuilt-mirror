import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { deleteFromR2 } from "../../../helpers/r2Client";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can delete posts." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const post = await db
      .selectFrom("teacherPosts")
      .select(["id", "teacherId", "imageFileId"])
      .where("id", "=", input.postId)
      .executeTakeFirst();

    if (!post || post.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "Post not found." }),
        { status: 404 }
      );
    }

    await db.deleteFrom("teacherPosts").where("id", "=", post.id).execute();

    if (post.imageFileId) {
      try {
        await deleteFromR2(post.imageFileId);
      } catch (cleanupError) {
        console.error(`Failed to delete R2 file for post ${post.id}:`, cleanupError);
      }
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("Failed to delete teacher post:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to delete post.", details: errorMessage }),
      { status: 500 }
    );
  }
}
