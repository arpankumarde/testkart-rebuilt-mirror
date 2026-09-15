import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { schema, OutputType } from "./publish_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const test = await db
      .selectFrom("mockTests")
      .select(["teacherId", "isPublished", "isFree", "price", "title", "deletedAt"])
      .where("id", "=", input.testId)
      .executeTakeFirst();

    if (!test) {
      return new Response(
        superjson.stringify({ error: "Test not found" }),
        { status: 404 }
      );
    }

    // A trashed series stays off the marketplace until it is restored.
    if (test.deletedAt) {
      return new Response(
        superjson.stringify({ error: "This test series is in the Trash. Restore it before publishing." }),
        { status: 400 }
      );
    }

    if (test.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "You do not own this test" }),
        { status: 403 }
      );
    }

    if (test.isPublished) {
      return new Response(
        superjson.stringify({ error: "Test is already published" }),
        { status: 400 }
      );
    }

    // A live test's schedule/prize record (liveTests) is backed by its own
    // "shadow" mockTests row for shared product fields (title, description,
    // media, etc.) - that row must never be published through this generic
    // endpoint. Doing so makes it show up as an independent, purchasable
    // normal mock test on public listing/search/detail pages, duplicating
    // (and undermining) the actual live test experience. Live tests are
    // published exclusively through teacher/live-test/publish_POST.ts.
    const linkedLiveTest = await db
      .selectFrom("liveTests")
      .select("id")
      .where("mockTestId", "=", input.testId)
      .executeTakeFirst();

    if (linkedLiveTest) {
      return new Response(
        superjson.stringify({
          error: "This test is a live competitive test and must be published from its live test management page, not here.",
        }),
        { status: 400 }
      );
    }

    if (!test.title || test.title.trim().length < 3) {
      return new Response(
        superjson.stringify({ error: "Test must have a title (at least 3 characters) before publishing. Please update the basic info." }),
        { status: 400 }
      );
    }

    // Trashed items do not count: a series whose items are all in the Trash is empty.
    const { count } = await db
      .selectFrom("mockTestItems")
      .select(db.fn.count("id").as("count"))
      .where("packageId", "=", input.testId)
      .where("deletedAt", "is", null)
      .executeTakeFirstOrThrow();

    if (Number(count) === 0) {
      return new Response(
        superjson.stringify({
          error: "Cannot publish a test with no test items.",
        }),
        { status: 400 }
      );
    }

    // Ensure aggregate fields are fresh before publishing
    await syncMockTestAggregates(input.testId);

    // Publish the test directly
    await db
      .updateTable("mockTests")
      .set({
        isPublished: true,
        wasEverPublished: true,
      })
      .where("id", "=", input.testId)
      .execute();

    console.log(`Mock test ${input.testId} published by teacher ${test.teacherId}`);

    const output: OutputType = {
      success: true,
      message: "Your test has been published successfully.",
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error publishing test:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}