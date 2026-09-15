import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import { countMockTestEnrollments } from "../../../helpers/enrollmentCounters";
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

    const existingTest = await db
      .selectFrom("mockTests")
      .select(["teacherId", "isPublished", "deletedAt"])
      .where("id", "=", testId)
      .executeTakeFirst();

    if (!existingTest) {
      return new Response(
        superjson.stringify({ error: "Test not found" }),
        { status: 404 }
      );
    }

    if (existingTest.deletedAt) {
      return new Response(
        superjson.stringify({ error: "Test is already in trash" }),
        { status: 400 }
      );
    }

    // Admins can delete any test, teachers can only delete their own
    if (user.role === "teacher" && existingTest.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this test" }),
        { status: 403 }
      );
    }

    // Check deletion rules based on publish status and enrollments.
    // Counted off mockTestEnrollments, never off mockTests.studentsEnrolled:
    // that column is an increment-maintained counter that drifts (hand-made
    // and cascaded-away enrollments never touch it), so a package with live
    // students can read 0 and walk straight through this guard.
    // See helpers/enrollmentCounters.tsx.
    const enrollmentCount = await countMockTestEnrollments(testId);

    if (existingTest.isPublished && enrollmentCount > 0) {
      return new Response(
        superjson.stringify({
          error: "Cannot delete a test with enrollments. Please unpublish it instead.",
        }),
        { status: 400 }
      );
    }

    // Use a transaction to ensure atomic soft delete and cart cleanup
    await db.transaction().execute(async (trx) => {
      // 1. Remove test from any carts
      await trx
        .deleteFrom("cartItems")
        .where("mockTestId", "=", testId)
        .execute();

      // 2. Soft delete the test by setting deletedAt and unpublishing
      await trx
        .updateTable("mockTests")
        .set({ 
          deletedAt: new Date(),
          isPublished: false,
        })
        .where("id", "=", testId)
        .execute();
    });

    console.log(`[Test Soft Delete] Moved test ${testId} to trash`);

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error deleting mock test:", error);
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