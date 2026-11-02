import type { Kysely, Transaction } from "kysely";
import type { DB } from "./schema";

/** Questions across a series' tests, trashed tests left out (as in syncMockTestAggregates). */
export async function countSeriesQuestions(
  executor: Kysely<DB> | Transaction<DB>,
  mockTestId: number
): Promise<number> {
  const row = await executor
    .selectFrom("testQuestions")
    .innerJoin("mockTestItems", "mockTestItems.id", "testQuestions.testId")
    .select(executor.fn.countAll<string>().as("count"))
    .where("mockTestItems.packageId", "=", mockTestId)
    .where("mockTestItems.deletedAt", "is", null)
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

/** Whether a test in the series has questions and is open now (not scheduled for later), as helpers/testSchedule defines it. */
export async function hasTestAvailableNow(
  executor: Kysely<DB> | Transaction<DB>,
  mockTestId: number
): Promise<boolean> {
  const now = new Date();
  const row = await executor
    .selectFrom("mockTestItems")
    .select("mockTestItems.id")
    .where("mockTestItems.packageId", "=", mockTestId)
    .where("mockTestItems.deletedAt", "is", null)
    .where((eb) => eb.or([eb("mockTestItems.scheduledDate", "is", null), eb("mockTestItems.scheduledDate", "<=", now)]))
    .where((eb) =>
      eb.exists(
        eb.selectFrom("testQuestions").select("testQuestions.id").whereRef("testQuestions.testId", "=", "mockTestItems.id")
      )
    )
    .limit(1)
    .executeTakeFirst();
  return Boolean(row);
}
