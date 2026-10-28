import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getLiveTestForTestItem } from "../../../helpers/liveTestAttemptWindow";
import { findResumableLiveAttempt } from "../../../helpers/liveTestAttemptResume";
import type { Json } from "../../../helpers/schema";
import { schema, OutputType } from "./save-progress_POST.schema";
import superjson from "superjson";

// Saves the web player's state for an open attempt so it can be resumed later:
// a paused mock test, or a live test in progress (its clock keeps running, so
// the elapsed time is taken from startedAt). Submitting removes the saved state.
export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Only students can save a test." }), { status: 403 });
    }

    const input = schema.parse(superjson.parse(await request.text()));

    const attempt = await db
      .selectFrom("testAttempts")
      .select(["id", "studentId", "testId", "completedAt"])
      .where("id", "=", input.attemptId)
      .executeTakeFirst();

    if (!attempt || attempt.studentId !== user.id) {
      return new Response(superjson.stringify({ error: "Test attempt not found." }), { status: 404 });
    }
    if (attempt.completedAt) {
      return new Response(superjson.stringify({ error: "This test has already been submitted." }), { status: 400 });
    }

    let elapsedSeconds = input.elapsedSeconds;
    const livePaper = await getLiveTestForTestItem(attempt.testId);
    if (livePaper) {
      const live = await findResumableLiveAttempt(user.id, attempt.testId, livePaper, attempt.id);
      if (!live) {
        return new Response(
          superjson.stringify({ error: "This live test attempt can no longer be saved." }),
          { status: 400 }
        );
      }
      elapsedSeconds = live.elapsedSeconds;
    }

    const savedAt = new Date();
    const values = {
      state: input.state as unknown as Json,
      elapsedSeconds,
      answeredCount: input.state.answers.length,
      updatedAt: savedAt,
    };

    await db
      .insertInto("testAttemptProgress")
      .values({ attemptId: attempt.id, studentId: user.id, testId: attempt.testId, ...values })
      .onConflict((oc) => oc.column("attemptId").doUpdateSet(values))
      .execute();

    return new Response(superjson.stringify({ ok: true, savedAt } satisfies OutputType));
  } catch (error) {
    console.error("Error saving test progress:", error);
    return new Response(superjson.stringify({ error: "Could not save your progress." }), { status: 400 });
  }
}