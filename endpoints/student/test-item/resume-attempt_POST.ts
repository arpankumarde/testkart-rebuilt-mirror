import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { hasStudentAccessToTestItem } from "../../../helpers/hasStudentPurchasedTestItem";
import { getLiveTestForTestItem, liveTestWindowError } from "../../../helpers/liveTestAttemptWindow";
import { findResumableLiveAttempt } from "../../../helpers/liveTestAttemptResume";
import { parseStoredProgressState } from "../../../helpers/testAttemptProgressState";
import { schema, OutputType } from "./resume-attempt_POST.schema";
import superjson from "superjson";

// Reopens an open attempt. A paused mock test moves startedAt forward by the
// time it sat paused, so the time taken recorded on submit counts only the time
// actually spent in the test. A live test never pauses: startedAt stays put and
// the clock resumes from wherever it has run to.
export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Only students can resume a test." }), { status: 403 });
    }

    const input = schema.parse(superjson.parse(await request.text()));

    const attempt = await db
      .selectFrom("testAttempts")
      .select(["id", "testId", "studentId", "completedAt"])
      .where("id", "=", input.attemptId)
      .executeTakeFirst();

    if (!attempt || attempt.studentId !== user.id) {
      return new Response(superjson.stringify({ error: "There is no saved test to resume." }), { status: 404 });
    }
    if (attempt.completedAt) {
      return new Response(superjson.stringify({ error: "This test has already been submitted." }), { status: 400 });
    }
    if (!(await hasStudentAccessToTestItem(user.id, attempt.testId))) {
      return new Response(
        superjson.stringify({ error: "You have not purchased this test or it is not available." }),
        { status: 403 }
      );
    }

    const livePaper = await getLiveTestForTestItem(attempt.testId);
    if (livePaper) {
      const windowError = liveTestWindowError(livePaper, "continue");
      if (windowError) {
        return new Response(superjson.stringify({ error: windowError }), { status: 403 });
      }
      const live = await findResumableLiveAttempt(user.id, attempt.testId, livePaper, attempt.id);
      if (!live) {
        return new Response(
          superjson.stringify({ error: "This live test attempt cannot be resumed." }),
          { status: 404 }
        );
      }
      return new Response(
        superjson.stringify({
          attemptId: live.attemptId,
          startedAt: live.startedAt,
          elapsedSeconds: live.elapsedSeconds,
          state: live.state,
          liveSecondsLeft: live.secondsLeft,
        } satisfies OutputType)
      );
    }

    const progress = await db
      .selectFrom("testAttemptProgress")
      .select(["state", "elapsedSeconds"])
      .where("attemptId", "=", attempt.id)
      .executeTakeFirst();
    if (!progress) {
      return new Response(superjson.stringify({ error: "There is no saved test to resume." }), { status: 404 });
    }

    const state = parseStoredProgressState(progress.state);
    if (!state) {
      return new Response(superjson.stringify({ error: "Your saved test could not be read." }), { status: 400 });
    }

    const startedAt = new Date(Date.now() - progress.elapsedSeconds * 1000);
    await db
      .updateTable("testAttempts")
      .set({ startedAt })
      .where("id", "=", attempt.id)
      .where("completedAt", "is", null)
      .execute();

    return new Response(
      superjson.stringify({
        attemptId: attempt.id,
        startedAt,
        elapsedSeconds: progress.elapsedSeconds,
        state,
        liveSecondsLeft: null,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error resuming test attempt:", error);
    return new Response(superjson.stringify({ error: "Could not resume your test." }), { status: 400 });
  }
}