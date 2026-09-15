import { db } from "../../helpers/db";
import { OutputType } from "./leaderboard_GET.schema";
import superjson from "superjson";
import { z } from "zod";
import { sql } from "kysely";
import { getServerUserSession } from "../../helpers/getServerUserSession";

const inputSchema = z.object({
  testItemId: z.coerce.number().int().positive(),
});

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const testItemId = url.searchParams.get("testItemId");

    const validationResult = inputSchema.safeParse({ testItemId });
    if (!validationResult.success) {
      return new Response(
        superjson.stringify({ error: "A valid test item ID is required." }),
        { status: 400 }
      );
    }

    const validatedTestItemId = validationResult.data.testItemId;

    // Use a CTE to find the best attempt for each student
    const bestAttemptsSubquery = db
      .with('ranked_attempts', (db) => db
        .selectFrom('testAttempts')
        .innerJoin('mockTestItems', 'mockTestItems.id', 'testAttempts.testId')
        .select([
          'testAttempts.id',
          'testAttempts.studentId',
          'testAttempts.score',
          'testAttempts.completedAt',
          sql<number>`LEAST(EXTRACT(EPOCH FROM (test_attempts.completed_at - test_attempts.started_at)) / 60, mock_test_items.duration_minutes)`.as("timeTakenMinutes"),
          sql<number>`ROW_NUMBER() OVER (PARTITION BY test_attempts.student_id ORDER BY test_attempts.started_at ASC)`.as('attemptNumber'),
          sql<number>`ROW_NUMBER() OVER (PARTITION BY test_attempts.student_id ORDER BY test_attempts.score DESC, LEAST(EXTRACT(EPOCH FROM (test_attempts.completed_at - test_attempts.started_at)) / 60, mock_test_items.duration_minutes) ASC)`.as('bestRank')
        ])
        .where('testAttempts.testId', '=', validatedTestItemId)
        .where('testAttempts.completedAt', 'is not', null)
      )
      .selectFrom('ranked_attempts')
      .selectAll()
      .where('bestRank', '=', 1);

    const leaderboardData = await db
      .selectFrom(bestAttemptsSubquery.as('best_attempts'))
      .innerJoin("users", "users.id", "best_attempts.studentId")
      .select([
        "users.displayName as studentName",
        "users.id as studentId",
        "best_attempts.score",
        "best_attempts.completedAt",
        "best_attempts.timeTakenMinutes",
        "best_attempts.attemptNumber",
      ])
      .orderBy("best_attempts.score", "desc")
      .orderBy("best_attempts.timeTakenMinutes", "asc")
      .execute();

    const rankedLeaderboard = leaderboardData.map((entry, index) => ({
      rank: index + 1,
      studentName: entry.studentName,
      score: parseFloat(entry.score as string),
      timeTaken: parseFloat(parseFloat(entry.timeTakenMinutes as any).toFixed(2)),
      completedAt: entry.completedAt as Date,
      attemptNumber: Number(entry.attemptNumber),
      studentId: entry.studentId,
    }));

    let currentUserBestRank: OutputType["currentUserBestRank"] = null;
    try {
      const { user } = await getServerUserSession(request);
      const userEntry = rankedLeaderboard.find(
        (entry) => entry.studentId === user.id
      );
      if (userEntry) {
        currentUserBestRank = {
          rank: userEntry.rank,
          studentName: userEntry.studentName,
          score: userEntry.score,
          timeTaken: userEntry.timeTaken,
          completedAt: userEntry.completedAt,
          attemptNumber: userEntry.attemptNumber,
        };
      }
    } catch (error) {
      // User not authenticated, which is fine for this public endpoint
    }

    // Remove studentId from the final public response
    const finalLeaderboard = rankedLeaderboard.map(({ studentId, ...rest }) => rest);

    return new Response(
      superjson.stringify({
        leaderboard: finalLeaderboard,
        currentUserBestRank,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to fetch test leaderboard:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch leaderboard.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}