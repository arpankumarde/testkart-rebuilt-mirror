import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { deleteOwnedR2Files } from "../../../helpers/r2FileOwnership";
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
        .select(["teacherId", "deletedAt", "thumbnailFileId"])
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
          superjson.stringify({
            error: "Test must be in the trash before it can be permanently deleted.",
          }),
          { status: 400 }
        );
      }

      await db.transaction().execute(async (trx) => {
        const testItems = await trx
          .selectFrom("mockTestItems")
          .select("id")
          .where("packageId", "=", testId)
          .execute();

        const testItemIds = testItems.map((item) => item.id);

        if (testItemIds.length > 0) {
          const itemSubjects = await trx
            .selectFrom("testItemSubjects")
            .select("id")
            .where("testItemId", "in", testItemIds)
            .execute();
            
          const subjectIds = itemSubjects.map((sub) => sub.id);

          if (subjectIds.length > 0) {
            await trx
              .deleteFrom("subjectSections")
              .where("subjectId", "in", subjectIds)
              .execute();
          }

          await trx
            .deleteFrom("testItemSubjects")
            .where("testItemId", "in", testItemIds)
            .execute();

          await trx
            .deleteFrom("testQuestions")
            .where("testId", "in", testItemIds)
            .execute();

          await trx
            .deleteFrom("mockTestItems")
            .where("packageId", "=", testId)
            .execute();
        }

        await trx
          .deleteFrom("cartItems")
          .where("mockTestId", "=", testId)
          .execute();

        await trx
          .deleteFrom("questionBank")
          .where("sourceMockTestId", "=", testId)
          .execute();

        await trx.deleteFrom("mockTests").where("id", "=", testId).execute();
      });

      // With the test gone, remove its thumbnail if the teacher uploaded it and nothing else uses it
      await deleteOwnedR2Files(existingTest.teacherId, [existingTest.thumbnailFileId]);

      console.log(`[Trash Permanent Delete] Successfully permanently deleted test ${testId}`);

      const output: OutputType = { success: true };
      return new Response(superjson.stringify(output));
    } else if (input.testItemId) {
      const { testItemId } = input;

      const testItem = await db
        .selectFrom("mockTestItems")
        .innerJoin("mockTests", "mockTests.id", "mockTestItems.packageId")
        .select([
          "mockTestItems.id as itemId",
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
          superjson.stringify({
            error: "Test item must be in the trash before it can be permanently deleted.",
          }),
          { status: 400 }
        );
      }

      await db.transaction().execute(async (trx) => {
        const itemSubjects = await trx
          .selectFrom("testItemSubjects")
          .select("id")
          .where("testItemId", "=", testItemId)
          .execute();

        const subjectIds = itemSubjects.map((sub) => sub.id);

        if (subjectIds.length > 0) {
          await trx
            .deleteFrom("subjectSections")
            .where("subjectId", "in", subjectIds)
            .execute();
        }

        await trx
          .deleteFrom("testItemSubjects")
          .where("testItemId", "=", testItemId)
          .execute();

        await trx
          .deleteFrom("testQuestions")
          .where("testId", "=", testItemId)
          .execute();

        await trx
          .deleteFrom("questionBank")
          .where("sourceTestItemId", "=", testItemId)
          .execute();

        await trx
          .deleteFrom("mockTestItems")
          .where("id", "=", testItemId)
          .execute();
      });

      await syncMockTestAggregates(testItem.packageId);

      console.log(`[Trash Permanent Delete] Successfully permanently deleted test item ${testItemId}`);

      const output: OutputType = { success: true };
      return new Response(superjson.stringify(output));
    }

    return new Response(
      superjson.stringify({ error: "Invalid input" }),
      { status: 400 }
    );
  } catch (error) {
    console.error("Error permanently deleting from trash:", error);
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