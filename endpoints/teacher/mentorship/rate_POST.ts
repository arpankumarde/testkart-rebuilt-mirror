import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./rate_POST.schema";
import { MENTORSHIP_MIN_RATE_PER_UNIT } from "../../../helpers/liveLessonConfig";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Only teachers can set this." }), { status: 403 });
    }
    if (user.role === "teacher" && user.teacherRole === "manager") {
      return new Response(superjson.stringify({ error: "Only the account owner can change 1:1 pricing." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    if (input.enabled && (input.ratePerUnit === undefined || input.ratePerUnit < MENTORSHIP_MIN_RATE_PER_UNIT)) {
      return new Response(
        superjson.stringify({ error: `Set a rate of at least ₹${MENTORSHIP_MIN_RATE_PER_UNIT} per 25 minutes to enable 1:1 sessions.` }),
        { status: 400 }
      );
    }

    await db
      .updateTable("users")
      .set({
        mentorshipEnabled: input.enabled,
        ...(input.ratePerUnit !== undefined ? { mentorshipRatePerUnit: input.ratePerUnit.toFixed(2) } : {}),
      })
      .where("id", "=", effectiveTeacherId)
      .execute();

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error setting teacher mentorship rate:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
