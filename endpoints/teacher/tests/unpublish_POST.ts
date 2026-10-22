import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./unpublish_POST.schema";
import {
  bundleConfirmationResponse,
  findPublishedBundlesContaining,
  unpublishBundles,
} from "../../../helpers/bundleDependencies";
import { clearOpenReviews } from "../../../helpers/contentReviewQueue";
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
    const { testId } = input;

    const test = await db
      .selectFrom("mockTests")
      .select(["teacherId", "isPublished"])
      .where("id", "=", testId)
      .executeTakeFirst();

    if (!test) {
      return new Response(
        superjson.stringify({ error: "Test not found" }),
        { status: 404 }
      );
    }

    // Admins can unpublish any test, teachers can only unpublish their own
    if (user.role === "teacher" && test.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this test" }),
        { status: 403 }
      );
    }

    if (!test.isPublished) {
      return new Response(
        superjson.stringify({ error: "Test is already unpublished" }),
        { status: 400 }
      );
    }

    // One transaction, so the series, its cart rows and the bundles holding it
    // change together or not at all. The isPublished guard on the update makes
    // a second, concurrent unpublish a no-op rather than a double write.
    const result = await db.transaction().execute(async (trx) => {
      const bundles = await findPublishedBundlesContaining(trx, "test", [testId]);
      if (bundles.length > 0 && !input.confirmBundleUnpublish) {
        return { kind: "needs-confirmation" as const, bundles };
      }

      const now = new Date();
      const updated = await trx
        .updateTable("mockTests")
        .set({ isPublished: false, updatedAt: now })
        .where("id", "=", testId)
        .where("isPublished", "=", true)
        .executeTakeFirst();

      if (Number(updated.numUpdatedRows) === 0) return { kind: "not-published" as const };

      // A live unlisted item's request to go public ends with it.
      await clearOpenReviews(trx, "mock_test", testId);

      await trx
        .deleteFrom("cartItems")
        .where("mockTestId", "=", testId)
        .execute();

      await unpublishBundles(trx, bundles, now);
      return { kind: "done" as const, bundles };
    });

    if (result.kind === "needs-confirmation") {
      return bundleConfirmationResponse(result.bundles);
    }

    if (result.kind === "not-published") {
      return new Response(
        superjson.stringify({ error: "Test is already unpublished" }),
        { status: 400 }
      );
    }

    const output: OutputType = { success: true, unpublishedBundles: result.bundles };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error unpublishing test:", error);
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