import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType, TeacherPostListItem } from "./posts_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const input = schema.parse({ teacherSlug: url.searchParams.get("teacherSlug") });

    const teacher = await db
      .selectFrom("users")
      .select(["id"])
      .where("slug", "=", input.teacherSlug)
      .where("role", "=", "teacher")
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!teacher) {
      return new Response(superjson.stringify({ error: "Teacher not found." }), { status: 404 });
    }

    // Community posts are public - anyone can read them, signed in or not.
    // Only liking requires a student session (checked in like_POST).
    let userId: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      userId = user.id;
    } catch {
      // Unauthenticated visitor - fine for this endpoint.
    }

    const followerCountRow = await db
      .selectFrom("teacherFollows")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("teacherId", "=", teacher.id)
      .executeTakeFirst();
    const followerCount = Number(followerCountRow?.count ?? 0);

    const rows = await db
      .selectFrom("teacherPosts")
      .select((eb) => [
        "teacherPosts.id",
        "teacherPosts.body",
        "teacherPosts.imageUrl",
        "teacherPosts.createdAt",
        eb
          .selectFrom("teacherPostLikes")
          .select((eb2) => eb2.fn.countAll<number>().as("count"))
          .whereRef("teacherPostLikes.postId", "=", "teacherPosts.id")
          .as("likeCount"),
        userId !== null
          ? eb
              .selectFrom("teacherPostLikes")
              .select(["id"])
              .whereRef("teacherPostLikes.postId", "=", "teacherPosts.id")
              .where("teacherPostLikes.studentId", "=", userId)
              .as("myLikeId")
          : eb.val<number | null>(null).as("myLikeId"),
      ])
      .where("teacherPosts.teacherId", "=", teacher.id)
      .orderBy("teacherPosts.createdAt", "desc")
      .limit(50)
      .execute();

    const posts: TeacherPostListItem[] = rows.map((row) => ({
      id: row.id,
      body: row.body,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      likeCount: Number(row.likeCount ?? 0),
      likedByMe: !!row.myLikeId,
    }));

    return new Response(
      superjson.stringify({
        locked: false,
        followerCount,
        posts,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to fetch teacher posts:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch teacher posts.", details: errorMessage }),
      { status: 500 }
    );
  }
}
