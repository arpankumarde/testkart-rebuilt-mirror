import { db } from "./db";
import { sql } from "kysely";

/**
 * Server-side helper to recalculate and sync aggregate fields on the mock_tests table.
 * It calculates total tests, free tests, total questions, and the effective total duration
 * based on the package's mock_test_items and associated tables.
 */
export async function syncMockTestAggregates(mockTestId: number): Promise<void> {
  try {
    // 1. Get total tests and free tests count for the mock test package
    const testItemsStats = await db
      .selectFrom("mockTestItems")
      .select([
        sql<number>`count(*)::int`.as("totalTests"),
        sql<number>`count(*) filter (where is_free = true)::int`.as(
          "freeTestsCount"
        ),
      ])
      .where("packageId", "=", mockTestId)
      .where("deletedAt", "is", null)
      .executeTakeFirst();

    const totalTests = testItemsStats?.totalTests || 0;
    const freeTestsCount = testItemsStats?.freeTestsCount || 0;

    // 2. Get total questions across all test items in the package
    const questionsStats = await db
      .selectFrom("testQuestions")
      .innerJoin("mockTestItems", "mockTestItems.id", "testQuestions.testId")
      .select([sql<number>`count(*)::int`.as("totalQuestions")])
      .where("mockTestItems.packageId", "=", mockTestId)
      .where("mockTestItems.deletedAt", "is", null)
      .executeTakeFirst();

    const totalQuestions = questionsStats?.totalQuestions || 0;

    // 3. Calculate effective duration
    const items = await db
      .selectFrom("mockTestItems")
      .select([
        "id",
        "durationMinutes",
        "subjectWiseTiming",
        "questionWiseTiming",
      ])
      .where("packageId", "=", mockTestId)
      .where("deletedAt", "is", null)
      .execute();

    let totalDurationMinutes = 0;

    for (const item of items) {
      if (item.subjectWiseTiming) {
        // Sum duration from test_item_subjects
        const subjectStats = await db
          .selectFrom("testItemSubjects")
          .select([
            sql<number>`sum(duration_minutes)::int`.as("subjectDuration"),
          ])
          .where("testItemId", "=", item.id)
          .executeTakeFirst();
        totalDurationMinutes += subjectStats?.subjectDuration || 0;
      } else if (item.questionWiseTiming) {
        // Sum duration from test_questions in seconds, convert to minutes and ceil
        const qStats = await db
          .selectFrom("testQuestions")
          .select([
            sql<number>`sum(duration_seconds)::int`.as("questionDuration"),
          ])
          .where("testId", "=", item.id)
          .executeTakeFirst();
        totalDurationMinutes += Math.ceil((qStats?.questionDuration || 0) / 60);
      } else {
        // Use the item's own duration
        totalDurationMinutes += item.durationMinutes || 0;
      }
    }

    // 4. Update the mock_tests row with the calculated aggregates
    await db
      .updateTable("mockTests")
      .set({
        totalTests,
        freeTestsCount,
        totalQuestions,
        durationMinutes: totalDurationMinutes,
        updatedAt: new Date(),
      })
      .where("id", "=", mockTestId)
      .execute();
  } catch (error) {
    console.error("Failed to sync mock test aggregates:", error);
  }
}