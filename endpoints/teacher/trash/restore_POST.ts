import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./restore_POST.schema";
import superjson from "superjson";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    if (input.testId) {
      const { testId } = input;

      const existingTest = await db
        .selectFrom("mockTests")
        .select(["teacherId", "deletedAt"])
        .where("id", "=", testId)
        .executeTakeFirst();

      if (!existingTest) {
        return new Response(
          superjson.stringify({ error: "Test not found" }),
          { status: 404 }
        );
      }

      if (user.role === "teacher" && existingTest.teacherId !== effectiveTeacherId) {
        return new Response(
          superjson.stringify({ error: "You do not own this test" }),
          { status: 403 }
        );
      }

      if (!existingTest.deletedAt) {
        return new Response(
          superjson.stringify({ error: "Test is not in the trash" }),
          { status: 400 }
        );
      }

      await db
        .updateTable("mockTests")
        .set({ deletedAt: null })
        .where("id", "=", testId)
        .execute();

      const output: OutputType = { 
        success: true, 
        message: "Test restored successfully" 
      };

      return new Response(superjson.stringify(output));
    } else if (input.testItemId) {
      const { testItemId } = input;

      const testItem = await db
        .selectFrom("mockTestItems")
        .innerJoin("mockTests", "mockTests.id", "mockTestItems.packageId")
        .select([
          "mockTestItems.id as itemId",
          "mockTestItems.title as itemTitle",
          "mockTestItems.deletedAt as itemDeletedAt",
          "mockTestItems.packageId as packageId",
          "mockTests.teacherId as teacherId",
        ])
        .where("mockTestItems.id", "=", testItemId)
        .executeTakeFirst();

      if (!testItem) {
        return new Response(
          superjson.stringify({ error: "Test item not found" }),
          { status: 404 }
        );
      }

      if (user.role === "teacher" && testItem.teacherId !== effectiveTeacherId) {
        return new Response(
          superjson.stringify({ error: "You do not own this test item" }),
          { status: 403 }
        );
      }

      if (!testItem.itemDeletedAt) {
        return new Response(
          superjson.stringify({ error: "Test item is not in the trash" }),
          { status: 400 }
        );
      }

      let newTitle = testItem.itemTitle;
      
      // Check for title conflicts with active test items in the same package
      const conflictingItems = await db
        .selectFrom("mockTestItems")
        .select("title")
        .where("packageId", "=", testItem.packageId)
        .where("deletedAt", "is", null)
        .where("title", "like", `${testItem.itemTitle}%`)
        .execute();

      const existingTitles = new Set(conflictingItems.map((item) => item.title));
      
      if (existingTitles.has(testItem.itemTitle)) {
        if (!existingTitles.has(`${testItem.itemTitle} (Restored)`)) {
          newTitle = `${testItem.itemTitle} (Restored)`;
        } else {
          let counter = 2;
          while (existingTitles.has(`${testItem.itemTitle} (Restored ${counter})`)) {
            counter++;
          }
          newTitle = `${testItem.itemTitle} (Restored ${counter})`;
        }
      }

      await db
        .updateTable("mockTestItems")
        .set({ 
          deletedAt: null,
          title: newTitle,
        })
        .where("id", "=", testItemId)
        .execute();

      await syncMockTestAggregates(testItem.packageId);

      const output: OutputType = { 
        success: true, 
        message: "Test item restored successfully" 
      };

      return new Response(superjson.stringify(output));
    }

    return new Response(
      superjson.stringify({ error: "Invalid input" }),
      { status: 400 }
    );
  } catch (error) {
    console.error("Error restoring from trash:", error);
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