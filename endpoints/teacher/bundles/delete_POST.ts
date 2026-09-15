import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, type OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { deleteFromR2 } from "../../../helpers/r2Client";

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

    let thumbnailFileId: string | null = null;
    let introVideoFileId: string | null = null;

    await db.transaction().execute(async (trx) => {
      const bundle = await trx
        .selectFrom("courseBundles")
        .select(["id", "thumbnailFileId", "introVideoFileId"])
        .where("id", "=", input.bundleId)
        .where("teacherId", "=", effectiveTeacherId)
        .executeTakeFirst();

      if (!bundle) {
        throw new Error("Bundle not found or you do not have permission to delete it.");
      }

      const enrollment = await trx
        .selectFrom("bundleEnrollments")
        .select("id")
        .where("bundleId", "=", input.bundleId)
        .executeTakeFirst();

      if (enrollment) {
        throw new Error("Cannot delete a bundle that has student enrollments.");
      }

      // Store file IDs for R2 cleanup after transaction
      thumbnailFileId = bundle.thumbnailFileId;
      introVideoFileId = bundle.introVideoFileId;

      // Cascade delete should handle bundle items, but doing it explicitly is safer.
      await trx.deleteFrom("courseBundleItems").where("bundleId", "=", input.bundleId).execute();
      const deleteResult = await trx.deleteFrom("courseBundles").where("id", "=", input.bundleId).executeTakeFirst();

      if (deleteResult.numDeletedRows === 0n) {
        throw new Error("Failed to delete the bundle.");
      }
    });

    // Clean up R2 thumbnail file after successful transaction
    if (thumbnailFileId) {
      try {
        await deleteFromR2(thumbnailFileId);
        console.log(`[Bundle Delete] Successfully deleted R2 thumbnail file: ${thumbnailFileId}`);
      } catch (error) {
        console.error(`[Bundle Delete] Failed to delete R2 file ${thumbnailFileId}:`, error);
        // Don't block - database deletion already succeeded
      }
    }

    // Clean up R2 intro video file after successful transaction
    if (introVideoFileId) {
      try {
        await deleteFromR2(introVideoFileId);
        console.log(`[Bundle Delete] Successfully deleted R2 intro video file: ${introVideoFileId}`);
      } catch (error) {
        console.error(`[Bundle Delete] Failed to delete R2 file ${introVideoFileId}:`, error);
        // Don't block - database deletion already succeeded
      }
    }

    const output: OutputType = {
      success: true,
      message: "Course bundle deleted successfully.",
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error deleting course bundle:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to delete course bundle", details: errorMessage }),
      { status: 500 }
    );
  }
}