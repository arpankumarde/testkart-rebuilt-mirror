import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { schema, OutputType } from "./delete_POST.schema";
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

    const itemAndPackage = await db
      .selectFrom("mockTestItems")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select(["mockTests.teacherId", "mockTestItems.packageId as packageId"])
      .where("mockTestItems.id", "=", input.itemId)
      .executeTakeFirst();

    if (!itemAndPackage) {
      return new Response(
        superjson.stringify({ error: "Test item not found" }),
        { status: 404 }
      );
    }

    if (itemAndPackage.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this test item" }),
        { status: 403 }
      );
    }

    // Soft delete: mark the test item as deleted
    const result = await db
      .updateTable("mockTestItems")
      .set({ deletedAt: new Date() })
      .where("id", "=", input.itemId)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      return new Response(
        superjson.stringify({ error: "Test item not found or already deleted" }),
        { status: 404 }
      );
    }

    console.log(`[Test Item Soft Delete] Moved test item ${input.itemId} to trash`);

        await syncMockTestAggregates(itemAndPackage.packageId).catch(err => console.error("Failed to sync aggregates:", err));

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error deleting test item:", error);
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