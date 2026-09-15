import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { countLiveTestEnrollments } from "../../../helpers/enrollmentCounters";
import { deleteOwnedR2Files } from "../../../helpers/r2FileOwnership";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { id } = schema.parse(json);

    const liveTest = await db
      .selectFrom("liveTests")
      .select(["teacherId", "isActive", "thumbnailFileId", "endTime"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!liveTest) {
      return new Response(
        superjson.stringify({ error: "Live test not found." }),
        { status: 404 }
      );
    }

    if (liveTest.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this live test." }),
        { status: 403 }
      );
    }

    // This delete is a HARD delete and liveTestEnrollments cascades off
    // liveTests, so getting this guard wrong destroys real registrations.
    // Count the enrollment rows rather than reading liveTests.enrolledCount —
    // that column is an increment-maintained counter and drifts (it is not
    // decremented when a student closes their account and their enrollment
    // cascades away), so it can read 0 over live registrations.
    // See helpers/enrollmentCounters.tsx.
    const enrollmentCount = await countLiveTestEnrollments(id);

    // A draft that nobody could have registered for is still freely deletable;
    // anything with a real enrollment behind it never is, published or not.
    if (enrollmentCount > 0) {
      return new Response(
        superjson.stringify({
          error: "Cannot delete a live test with enrollments. Unpublish it first if there are no enrollments.",
        }),
        { status: 400 }
      );
    }

    if (liveTest.isActive) {
      const now = new Date();
      if (liveTest.endTime && liveTest.endTime <= now) {
        return new Response(
          superjson.stringify({
            error: "Cannot delete a live test that has already ended.",
          }),
          { status: 400 }
        );
      }
    }

    // Hard delete from database
    await db
      .deleteFrom("liveTests")
      .where("id", "=", id)
      .execute();

    // Then remove the thumbnail if the teacher uploaded it and nothing else uses it
    await deleteOwnedR2Files(liveTest.teacherId, [liveTest.thumbnailFileId]);

    console.log(`[Live Test Delete] Successfully deleted live test ${id} from database`);

    return new Response(
      superjson.stringify({
        message: "Live test has been deleted successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error deleting live test:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}