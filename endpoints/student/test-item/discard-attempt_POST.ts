import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./discard-attempt_POST.schema";
import superjson from "superjson";

// Throws away a paused attempt when the student starts the test over. Only an
// unsubmitted attempt with saved web progress qualifies, so an attempt the
// mobile app has open (it saves no progress) is never touched.
export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Only students can do this." }), { status: 403 });
    }

    const input = schema.parse(superjson.parse(await request.text()));

    await db
      .deleteFrom("testAttempts")
      .where("id", "=", input.attemptId)
      .where("studentId", "=", user.id)
      .where("completedAt", "is", null)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("testAttemptProgress")
            .select("testAttemptProgress.attemptId")
            .whereRef("testAttemptProgress.attemptId", "=", "testAttempts.id")
        )
      )
      .execute();

    return new Response(superjson.stringify({ ok: true } satisfies OutputType));
  } catch (error) {
    console.error("Error discarding test attempt:", error);
    return new Response(superjson.stringify({ error: "Could not clear your saved test." }), { status: 400 });
  }
}