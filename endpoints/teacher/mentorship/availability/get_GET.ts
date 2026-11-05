import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { OutputType } from "./get_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const [teacher, windows, blockedDates] = await Promise.all([
      db.selectFrom("users").select(["timezone"]).where("id", "=", effectiveTeacherId).executeTakeFirst(),
      db
        .selectFrom("mentorshipAvailability")
        .select(["id", "dayOfWeek", "startTime", "endTime", "isActive"])
        .where("teacherId", "=", effectiveTeacherId)
        .orderBy("dayOfWeek", "asc")
        .orderBy("startTime", "asc")
        .execute(),
      db
        .selectFrom("mentorshipBlockedDates")
        .select(["id", "blockedDate", "reason"])
        .where("teacherId", "=", effectiveTeacherId)
        .where("blockedDate", ">=", new Date())
        .orderBy("blockedDate", "asc")
        .execute(),
    ]);

    const output: OutputType = {
      timezone: teacher?.timezone ?? "Asia/Kolkata",
      windows: windows.map((w) => ({ ...w, isActive: !!w.isActive })),
      blockedDates,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching mentorship availability:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
