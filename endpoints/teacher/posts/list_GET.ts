import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType, TeacherOwnPostListItem } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can manage posts." }),
        { status: 403 }
      );
    }

    const rows = await db
      .selectFrom("teacherPosts")
      .select((eb) => [
        "id",
        "body",
        "imageUrl",
        "createdAt",
        eb
          .selectFrom("teacherPostLikes")
          .select((eb2) => eb2.fn.countAll<number>().as("count"))
          .whereRef("teacherPostLikes.postId", "=", "teacherPosts.id")
          .as("likeCount"),
      ])
      .where("teacherId", "=", effectiveTeacherId)
      .orderBy("createdAt", "desc")
      .limit(100)
      .execute();

    const posts: TeacherOwnPostListItem[] = rows.map((row) => ({
      id: row.id,
      body: row.body,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      likeCount: Number(row.likeCount ?? 0),
    }));

    const followerCountRow = await db
      .selectFrom("teacherFollows")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    return new Response(
      superjson.stringify({
        posts,
        followerCount: Number(followerCountRow?.count ?? 0),
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to list teacher posts:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to load posts.", details: errorMessage }),
      { status: 500 }
    );
  }
}
