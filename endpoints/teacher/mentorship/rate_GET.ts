import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./rate_GET.schema";
import { MENTORSHIP_SESSION_DURATIONS, MENTORSHIP_RATE_UNIT_MINUTES, MENTORSHIP_MIN_RATE_PER_UNIT } from "../../../helpers/liveLessonConfig";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Only teachers can view this." }), { status: 403 });
    }

    const row = await db
      .selectFrom("users")
      .select(["mentorshipEnabled", "mentorshipRatePerUnit"])
      .where("id", "=", effectiveTeacherId)
      .executeTakeFirst();

    const output: OutputType = {
      enabled: !!row?.mentorshipEnabled,
      ratePerUnit: row?.mentorshipRatePerUnit !== null && row?.mentorshipRatePerUnit !== undefined ? Number(row.mentorshipRatePerUnit) : null,
      rateUnitMinutes: MENTORSHIP_RATE_UNIT_MINUTES,
      minRatePerUnit: MENTORSHIP_MIN_RATE_PER_UNIT,
      durations: [...MENTORSHIP_SESSION_DURATIONS],
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching teacher mentorship rate:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
