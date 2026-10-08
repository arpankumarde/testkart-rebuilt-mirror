import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./deactivate_POST.schema";
import { unpublishBundlesContaining } from "../../../helpers/bundleDependencies";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { courseId } = schema.parse(json);

    // The published bundles holding the course go down with it, in the same transaction.
    const result = await db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable("courses")
        .set({
          status: "archived",
          publishedAt: null,
        })
        .where("id", "=", courseId)
        .where("status", "=", "published")
        .executeTakeFirst();

      await trx
        .deleteFrom("cartItems")
        .where("courseId", "=", courseId)
        .execute();

      if (updated.numUpdatedRows > 0n) {
        await unpublishBundlesContaining(trx, "course", [courseId]);
      }
      return updated;
    });

    if (result.numUpdatedRows === 0n) {
      const course = await db
        .selectFrom("courses")
        .select("status")
        .where("id", "=", courseId)
        .executeTakeFirst();
      
      if (!course) {
        throw new Error("Course not found.");
      }
      if (course.status !== 'published') {
        throw new Error("Course is not published and cannot be deactivated.");
      }
      throw new Error("Failed to deactivate course.");
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("Error deactivating course:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}