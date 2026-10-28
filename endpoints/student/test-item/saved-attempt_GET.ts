import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getLiveTestForTestItem } from "../../../helpers/liveTestAttemptWindow";
import { findResumableLiveAttempt } from "../../../helpers/liveTestAttemptResume";
import { parseStoredProgressState } from "../../../helpers/testAttemptProgressState";
import { schema, OutputType } from "./saved-attempt_GET.schema";
import superjson from "superjson";

// The student's latest paused attempt on a mock test paper, or their open
// attempt on a live test paper while it can still be submitted, or null.
export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Only students can resume a test." }), { status: 403 });
    }

    const url = new URL(request.url);
    const input = schema.parse({ testItemId: Number(url.searchParams.get("testItemId")) });

    const livePaper = await getLiveTestForTestItem(input.testItemId);
    if (livePaper) {
      const live = await findResumableLiveAttempt(user.id, input.testItemId, livePaper);
      return new Response(
        superjson.stringify({
          attempt: live
            ? {
                attemptId: live.attemptId,
                startedAt: live.startedAt,
                savedAt: live.savedAt,
                answeredCount: live.answeredCount,
                totalQuestions: live.totalQuestions,
                elapsedSeconds: live.elapsedSeconds,
                state: live.state,
                liveSecondsLeft: live.secondsLeft,
              }
            : null,
        } satisfies OutputType)
      );
    }

    const row = await db
      .selectFrom("testAttemptProgress")
      .innerJoin("testAttempts", "testAttempts.id", "testAttemptProgress.attemptId")
      .select([
        "testAttempts.id",
        "testAttempts.startedAt",
        "testAttempts.totalQuestions",
        "testAttemptProgress.state",
        "testAttemptProgress.elapsedSeconds",
        "testAttemptProgress.answeredCount",
        "testAttemptProgress.updatedAt",
      ])
      .where("testAttemptProgress.studentId", "=", user.id)
      .where("testAttemptProgress.testId", "=", input.testItemId)
      .where("testAttempts.studentId", "=", user.id)
      .where("testAttempts.completedAt", "is", null)
      .orderBy("testAttemptProgress.updatedAt", "desc")
      .limit(1)
      .executeTakeFirst();

    const state = row ? parseStoredProgressState(row.state) : null;
    if (!row || !state) {
      return new Response(superjson.stringify({ attempt: null } satisfies OutputType));
    }

    return new Response(
      superjson.stringify({
        attempt: {
          attemptId: row.id,
          startedAt: row.startedAt,
          savedAt: row.updatedAt,
          answeredCount: row.answeredCount,
          totalQuestions: row.totalQuestions,
          elapsedSeconds: row.elapsedSeconds,
          state,
          liveSecondsLeft: null,
        },
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error loading saved attempt:", error);
    return new Response(superjson.stringify({ error: "Could not load your saved test." }), { status: 400 });
  }
}