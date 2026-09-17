import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { schema, OutputType } from "./update_POST.schema";
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

    const { itemId, ...updateData } = input;

    // The unique (package, title) constraint covers trashed items too.
    if (updateData.title) {
      const conflictingItem = await db
        .selectFrom("mockTestItems")
        .select(["id", "deletedAt"])
        .where("packageId", "=", itemAndPackage.packageId)
        .where("title", "=", updateData.title)
        .where("id", "!=", itemId)
        .executeTakeFirst();

      if (conflictingItem) {
        const error = conflictingItem.deletedAt
          ? `"${updateData.title}" is used by a test in Trash. Pick another name, or delete that test from Trash first.`
          : `A test item named "${updateData.title}" already exists in this test series.`;
        return new Response(superjson.stringify({ error }), { status: 400 });
      }
    }

    const updatedItem = await db
      .updateTable("mockTestItems")
      .set({
        ...updateData,
        subject: updateData.subject || "",
        description: updateData.description ?? null,
        ...(updateData.calculatorEnabled !== undefined && { calculatorEnabled: updateData.calculatorEnabled }),
        ...(updateData.subjectWiseTiming !== undefined && { subjectWiseTiming: updateData.subjectWiseTiming }),
        ...(updateData.questionWiseTiming !== undefined && { questionWiseTiming: updateData.questionWiseTiming }),
        ...(updateData.scheduledDate !== undefined && { scheduledDate: updateData.scheduledDate }),
      })
      .where("id", "=", itemId)
      .returningAll()
      .executeTakeFirstOrThrow();

        await syncMockTestAggregates(itemAndPackage.packageId).catch(err => console.error("Failed to sync aggregates:", err));

    return new Response(superjson.stringify(updatedItem satisfies OutputType));
  } catch (error) {
    console.error("Error updating test item:", error);
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