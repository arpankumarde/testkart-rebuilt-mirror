import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can create posts." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const inserted = await db
      .insertInto("teacherPosts")
      .values({
        teacherId: effectiveTeacherId,
        body: input.body,
        imageUrl: input.imageUrl ?? null,
        imageFileId: input.imageFileId ?? null,
      })
      .returning(["id", "body", "imageUrl", "createdAt"])
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({
        post: {
          id: inserted.id,
          body: inserted.body,
          imageUrl: inserted.imageUrl,
          createdAt: inserted.createdAt,
          likeCount: 0,
        },
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to create teacher post:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to create post.", details: errorMessage }),
      { status: 500 }
    );
  }
}
