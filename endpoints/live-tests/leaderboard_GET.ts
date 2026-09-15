import { db } from "../../helpers/db";
import { CurrentUserStatus, OutputType } from "./leaderboard_GET.schema";
import superjson from "superjson";
import { z } from "zod";
import { sql } from "kysely";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { calcLiveTestPrizeAmounts } from "../../helpers/calcLiveTestPrizeAmounts";

const inputSchema = z.object({
  liveTestId: z.coerce.number().int().positive(),
});

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const liveTestId = url.searchParams.get("liveTestId");

    const validationResult = inputSchema.safeParse({ liveTestId });
    if (!validationResult.success) {
      return new Response(
        superjson.stringify({ error: "A valid live test ID is required." }),
        { status: 400 }
      );
    }

    const validatedLiveTestId = validationResult.data.liveTestId;

    const liveTest = await db
      .selectFrom("liveTests")
      .select(["mockTestId", "startTime", "endTime", "hasPrizes"])
      .where("id", "=", validatedLiveTestId)
      .executeTakeFirst();

    if (!liveTest) {
      return new Response(
        superjson.stringify({ error: "Live test not found." }),
        { status: 404 }
      );
    }

    // Determine test status
    const now = new Date();
    const startTime = liveTest.startTime ? new Date(liveTest.startTime) : null;
    const endTime = new Date(liveTest.endTime);

    let testStatus: "not_started" | "ongoing" | "completed";
    if (startTime && now < startTime) {
      testStatus = "not_started";
    } else if (now <= endTime) {
      testStatus = "ongoing";
    } else {
      testStatus = "completed";
    }

    // Calculate dynamic prizes (single source of truth)
    const prizeAmounts = await calcLiveTestPrizeAmounts(validatedLiveTestId);
    const dynamicPrizes = liveTest.hasPrizes
      ? {
          tiers: prizeAmounts.tiers,
          totalPrizePool: prizeAmounts.totalPrizePool,
          isReduced: prizeAmounts.multiplier < 1,
        }
      : null;

    // If test hasn't started yet, return empty leaderboard with status
    if (testStatus === "not_started") {
      // Still check enrollment status for authenticated users
      let currentUserStatus: CurrentUserStatus | null = null;
      try {
        const { user } = await getServerUserSession(request);
        const enrollment = await db
          .selectFrom("liveTestEnrollments")
          .select("id")
          .where("liveTestId", "=", validatedLiveTestId)
          .where("studentId", "=", user.id)
          .executeTakeFirst();

        currentUserStatus = enrollment ? "enrolled_not_attempted" : "not_enrolled";
      } catch {
        // User not authenticated
      }

      return new Response(
        superjson.stringify({
          leaderboard: [],
          currentUserRank: null,
          currentUserStatus,
          testStatus: "not_started",
          dynamicPrizes,
        } satisfies OutputType)
      );
    }

    const leaderboardData = await db
      .selectFrom("testAttempts")
      .innerJoin("users", "users.id", "testAttempts.studentId")
      .select([
        "users.displayName as studentName",
        "users.id as studentId",
        "testAttempts.score",
        "testAttempts.startedAt",
        "testAttempts.completedAt",
        sql<number>`EXTRACT(EPOCH FROM (completed_at - started_at)) / 60`.as("timeTakenMinutes"),
      ])
      .where("testAttempts.testId", "in", (qb) =>
        qb
          .selectFrom("mockTestItems")
          .select("mockTestItems.id")
          .where("mockTestItems.packageId", "=", liveTest.mockTestId)
      )
            .where("testAttempts.completedAt", "is not", null)
      .$if(liveTest.startTime != null, (qb) =>
        qb.where("testAttempts.completedAt", ">=", liveTest.startTime!)
      )
      .where("testAttempts.completedAt", "<=", liveTest.endTime)
      .orderBy("testAttempts.score", "desc")
      .orderBy("timeTakenMinutes", "asc")
      .execute();

    const rankedLeaderboard = leaderboardData.map((entry, index) => ({
      rank: index + 1,
      studentName: entry.studentName,
      score: parseFloat(entry.score as string),
      timeTaken: parseFloat(parseFloat(String(entry.timeTakenMinutes)).toFixed(2)),
      studentId: entry.studentId,
    }));

    let currentUserRank: OutputType["currentUserRank"] = null;
    let currentUserStatus: CurrentUserStatus | null = null;

    try {
      const { user } = await getServerUserSession(request);

      // Check enrollment status
      const enrollment = await db
        .selectFrom("liveTestEnrollments")
        .select("id")
        .where("liveTestId", "=", validatedLiveTestId)
        .where("studentId", "=", user.id)
        .executeTakeFirst();

      if (!enrollment) {
        currentUserStatus = "not_enrolled";
      } else {
        // Check if user has a completed attempt in the leaderboard
        const userEntry = rankedLeaderboard.find(
          (entry) => entry.studentId === user.id
        );

        if (userEntry) {
          currentUserStatus = "attempted";
          currentUserRank = {
            rank: userEntry.rank,
            studentName: userEntry.studentName,
            score: userEntry.score,
            timeTaken: userEntry.timeTaken,
          };
        } else {
          currentUserStatus = "enrolled_not_attempted";
        }
      }
    } catch {
      // User not authenticated, leave both as null
    }

    const finalLeaderboard = rankedLeaderboard.map(({ studentId, ...rest }) => rest);

    return new Response(
      superjson.stringify({
        leaderboard: finalLeaderboard,
        currentUserRank,
        currentUserStatus,
        testStatus,
        dynamicPrizes,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
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