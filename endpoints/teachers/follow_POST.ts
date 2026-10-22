import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./follow_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can follow teachers." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const teacher = await db
      .selectFrom("users")
      .select(["id"])
      .where("id", "=", input.teacherId)
      .where("role", "=", "teacher")
      .executeTakeFirst();

    if (!teacher) {
      return new Response(
        superjson.stringify({ error: "Teacher not found." }),
        { status: 404 }
      );
    }

    const existing = await db
      .selectFrom("teacherFollows")
      .select(["id"])
      .where("teacherId", "=", input.teacherId)
      .where("studentId", "=", user.id)
      .executeTakeFirst();

    const shouldFollow = input.follow ?? !existing;
    const pair = { teacherId: input.teacherId, studentId: user.id };

    await db.transaction().execute(async (trx) => {
      if (shouldFollow) {
        await trx
          .insertInto("teacherFollows")
          .values(pair)
          .onConflict((oc) => oc.columns(["teacherId", "studentId"]).doNothing())
          .execute();
        await trx
          .deleteFrom("teacherUnfollows")
          .where("teacherId", "=", pair.teacherId)
          .where("studentId", "=", pair.studentId)
          .execute();
      } else {
        await trx
          .deleteFrom("teacherFollows")
          .where("teacherId", "=", pair.teacherId)
          .where("studentId", "=", pair.studentId)
          .execute();
        // Remembered so auto-follow does not undo this choice.
        await trx
          .insertInto("teacherUnfollows")
          .values(pair)
          .onConflict((oc) => oc.columns(["teacherId", "studentId"]).doUpdateSet({ unfollowedAt: new Date() }))
          .execute();
      }
    });

    const countRow = await db
      .selectFrom("teacherFollows")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("teacherId", "=", input.teacherId)
      .executeTakeFirst();

    return new Response(
      superjson.stringify({
        isFollowing: shouldFollow,
        followerCount: Number(countRow?.count ?? 0),
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to toggle follow:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to update follow status.", details: errorMessage }),
      { status: 500 }
    );
  }
}
