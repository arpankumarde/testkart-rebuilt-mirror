import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./unpublish_POST.schema";
import {
  bundleConfirmationResponse,
  findPublishedBundlesContaining,
  unpublishBundles,
} from "../../../helpers/bundleDependencies";
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
    const { courseId, confirmBundleUnpublish } = schema.parse(json);

    const course = await db
      .selectFrom("courses")
      .select(["teacherId", "status"])
      .where("id", "=", courseId)
      .executeTakeFirst();

    if (!course) {
      return new Response(
        superjson.stringify({ error: "Course not found" }),
        { status: 404 }
      );
    }

    if (course.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "You do not own this course" }),
        { status: 403 }
      );
    }

    if (course.status !== "published") {
      return new Response(
        superjson.stringify({ error: "Course is not published" }),
        { status: 400 }
      );
    }

    // One transaction, so the course, its cart rows and the bundles holding it
    // change together or not at all. The status guard on the update makes a
    // second, concurrent unpublish a no-op rather than a double write.
    const result = await db.transaction().execute(async (trx) => {
      const bundles = await findPublishedBundlesContaining(trx, "course", [courseId]);
      if (bundles.length > 0 && !confirmBundleUnpublish) {
        return { kind: "needs-confirmation" as const, bundles };
      }

      const now = new Date();
      const updatedCourse = await trx
        .updateTable("courses")
        .set({ status: "draft", updatedAt: now })
        .where("id", "=", courseId)
        .where("status", "=", "published")
        .returningAll()
        .executeTakeFirst();

      if (!updatedCourse) return { kind: "not-published" as const };

      const deletedCartItems = await trx
        .deleteFrom("cartItems")
        .where("courseId", "=", courseId)
        .executeTakeFirst();
      console.log(`Deleted ${deletedCartItems.numDeletedRows} cart item(s) for unpublished course ${courseId}`);

      await unpublishBundles(trx, bundles, now);
      return { kind: "done" as const, updatedCourse, bundles };
    });

    if (result.kind === "needs-confirmation") {
      return bundleConfirmationResponse(result.bundles);
    }

    if (result.kind === "not-published") {
      return new Response(
        superjson.stringify({ error: "Course is not published" }),
        { status: 400 }
      );
    }

    const output: OutputType = {
      ...result.updatedCourse,
      price: Number(result.updatedCourse.price),
      unpublishedBundles: result.bundles,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error unpublishing course:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to unpublish course", details: errorMessage }),
      { status: 500 }
    );
  }
}