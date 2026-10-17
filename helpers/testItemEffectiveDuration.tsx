import { db } from "./db";

type TimedTestItem = {
  id: number;
  durationMinutes: number;
  subjectWiseTiming: boolean;
  questionWiseTiming: boolean;
};

/**
 * Minutes a student actually gets for each test item, keyed by item id. Under
 * subject-wise timing the item's own duration is saved as 0 and the subjects
 * carry the time; under question-wise timing the questions do. Same rules as
 * fetchTestDetailsServer and syncMockTestAggregates.
 */
export async function loadEffectiveDurations(items: TimedTestItem[]): Promise<Map<number, number>> {
  const minutes = new Map(items.map((item) => [item.id, item.durationMinutes]));

  const subjectTimed = items.filter((item) => item.subjectWiseTiming).map((item) => item.id);
  if (subjectTimed.length > 0) {
    const rows = await db
      .selectFrom("testItemSubjects")
      .select("testItemId")
      .select((eb) => eb.fn.sum<string | number | null>("durationMinutes").as("total"))
      .where("testItemId", "in", subjectTimed)
      .groupBy("testItemId")
      .execute();
    for (const id of subjectTimed) minutes.set(id, 0);
    for (const row of rows) minutes.set(row.testItemId, Number(row.total ?? 0));
  }

  const questionTimed = items
    .filter((item) => !item.subjectWiseTiming && item.questionWiseTiming)
    .map((item) => item.id);
  if (questionTimed.length > 0) {
    const rows = await db
      .selectFrom("testQuestions")
      .select("testId")
      .select((eb) => eb.fn.sum<string | number | null>("durationSeconds").as("total"))
      .where("testId", "in", questionTimed)
      .groupBy("testId")
      .execute();
    for (const id of questionTimed) minutes.set(id, 0);
    for (const row of rows) minutes.set(row.testId, Math.ceil(Number(row.total ?? 0) / 60));
  }

  return minutes;
}
