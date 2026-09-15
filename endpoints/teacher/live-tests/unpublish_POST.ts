import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./unpublish_POST.schema";
import { countLiveTestEnrollments } from "../../../helpers/enrollmentCounters";
import superjson from "superjson";

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
      .select(["teacherId", "isActive", "endTime"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!liveTest) {
      return new Response(
        superjson.stringify({ error: "Live test not found." }),
        { status: 404 }
      );
    }

    if (user.role !== "admin" && liveTest.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this live test." }),
        { status: 403 }
      );
    }

    if (!liveTest.isActive) {
      return new Response(
        superjson.stringify({ error: "Live test is already unpublished/draft." }),
        { status: 400 }
      );
    }

    const now = new Date();
    if (liveTest.endTime <= now) {
      return new Response(
        superjson.stringify({ error: "Cannot unpublish a live test that has already ended." }),
        { status: 400 }
      );
    }

    // Counted off liveTestEnrollments, not liveTests.enrolledCount: that
    // column is an increment-maintained counter that drifts, and unpublishing
    // out from under registered students is exactly what this guard exists to
    // stop. See helpers/enrollmentCounters.tsx.
    const enrollmentCount = await countLiveTestEnrollments(id);

    if (enrollmentCount > 0) {
      return new Response(
        superjson.stringify({ error: "Cannot unpublish a live test that has active enrollments. Students have already registered." }),
        { status: 400 }
      );
    }

    await db
      .updateTable("liveTests")
      .set({ isActive: false })
      .where("id", "=", id)
      .execute();

    console.log(`[Live Test Unpublish] Successfully unpublished live test ${id}`);

    return new Response(
      superjson.stringify({
        message: "Live test has been unpublished successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error unpublishing live test:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}