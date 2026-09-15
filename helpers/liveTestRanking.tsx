import { Kysely } from "kysely";
import { DB } from "./schema";
import { liveTestSubmissionsCloseAt } from "./liveTestAttemptWindow";

export type RankedLiveTestAttempt = {
  rank: number;
  studentId: number;
  studentName: string;
  score: number;
  timeTakenMinutes: number;
  completedAt: Date;
};

/**
 * The live test leaderboard, shared by the leaderboard endpoint and the prize
 * payout so the ranks shown are the ranks paid. Counts one attempt per enrolled
 * student - their first completed one - and only if it was started during the
 * live window and submitted before submissions closed. Ranked by score, then
 * time taken, then who finished first.
 */
export async function getRankedLiveTestAttempts(
  executor: Kysely<DB>,
  liveTest: { id: number; mockTestId: number; startTime: Date | null; endTime: Date }
): Promise<RankedLiveTestAttempt[]> {
  const rows = await executor
    .selectFrom("testAttempts")
    .innerJoin("mockTestItems", "mockTestItems.id", "testAttempts.testId")
    .innerJoin("users", "users.id", "testAttempts.studentId")
    .innerJoin("liveTestEnrollments", (join) =>
      join
        .onRef("liveTestEnrollments.studentId", "=", "testAttempts.studentId")
        .on("liveTestEnrollments.liveTestId", "=", liveTest.id)
    )
    .select([
      "testAttempts.studentId",
      "users.displayName as studentName",
      "testAttempts.score",
      "testAttempts.startedAt",
      "testAttempts.completedAt",
    ])
    .where("mockTestItems.packageId", "=", liveTest.mockTestId)
    .where("testAttempts.startedAt", "is not", null)
    .where("testAttempts.completedAt", "is not", null)
    .$if(liveTest.startTime != null, (qb) => qb.where("testAttempts.startedAt", ">=", liveTest.startTime!))
    .where("testAttempts.startedAt", "<=", liveTest.endTime)
    .where("testAttempts.completedAt", "<=", liveTestSubmissionsCloseAt(liveTest))
    .orderBy("testAttempts.completedAt", "asc")
    .execute();

  const seen = new Set<number>();
  const counted: Omit<RankedLiveTestAttempt, "rank">[] = [];
  for (const row of rows) {
    if (seen.has(row.studentId) || !row.startedAt || !row.completedAt) continue;
    seen.add(row.studentId);
    const completedAt = new Date(row.completedAt);
    counted.push({
      studentId: row.studentId,
      studentName: row.studentName,
      score: parseFloat(String(row.score ?? "0")),
      timeTakenMinutes: (completedAt.getTime() - new Date(row.startedAt).getTime()) / 60000,
      completedAt,
    });
  }

  counted.sort(
    (a, b) =>
      b.score - a.score ||
      a.timeTakenMinutes - b.timeTakenMinutes ||
      a.completedAt.getTime() - b.completedAt.getTime()
  );
  return counted.map((attempt, index) => ({ ...attempt, rank: index + 1 }));
}
