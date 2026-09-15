import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./analytics_GET.schema";
import superjson from "superjson";
import { z } from "zod";
import { sql } from "kysely";

const inputSchema = z.object({
  liveTestId: z.coerce.number().int().positive(),
});

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

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
      .select(["teacherId", "mockTestId", "enrolledCount", "startTime", "endTime"])
      .where("id", "=", validatedLiveTestId)
      .executeTakeFirst();

    if (!liveTest) {
      return new Response(
        superjson.stringify({ error: "Live test not found." }),
        { status: 404 }
      );
    }
    if (liveTest.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this live test." }),
        { status: 403 }
      );
    }

    const attemptsQuery = db
      .selectFrom("testAttempts")
      .where("testId", "in", (qb) =>
        qb
          .selectFrom("mockTestItems")
          .select("mockTestItems.id")
          .where("mockTestItems.packageId", "=", liveTest.mockTestId)
      )
      .where("completedAt", "is not", null)
      .where("completedAt", ">=", liveTest.startTime)
      .where("completedAt", "<=", liveTest.endTime);

    const stats = await attemptsQuery
      .select([
        db.fn.count("id").as("completedCount"),
        db.fn.avg("score").as("averageScore"),
      ])
      .executeTakeFirst();

    const topScorers = await attemptsQuery
      .innerJoin("users", "users.id", "testAttempts.studentId")
      .select([
        "users.displayName as studentName",
        "testAttempts.score",
        sql<number>`EXTRACT(EPOCH FROM (completed_at - started_at)) / 60`.as("timeTakenMinutes"),
      ])
      .orderBy("score", "desc")
      .orderBy("timeTakenMinutes", "asc")
      .execute();

    const responseData: OutputType = {
      enrolledCount: liveTest.enrolledCount,
      completedCount: Number(stats?.completedCount ?? 0),
      averageScore: stats?.averageScore ? parseFloat(stats.averageScore as string) : 0,
            topScorers: topScorers.map(s => ({
        studentName: s.studentName,
        score: parseFloat(s.score as string),
        timeTaken: parseFloat(parseFloat(String(s.timeTakenMinutes)).toFixed(2)),
      })),
    };

    return new Response(superjson.stringify(responseData));
  } catch (error) {
    console.error("Failed to fetch live test analytics:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch analytics.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}