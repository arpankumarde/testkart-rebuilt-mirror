import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { ISSUE_REPORT_WINDOW_HOURS } from "../../../helpers/liveLessonConfig";
import { schema, OutputType } from "./report_POST.schema";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const { bookingId, note } = schema.parse(superjson.parse(await request.text()));
    const b = await db
      .selectFrom("mentorshipBookings")
      .select(["studentId", "status", "scheduledAt", "durationMinutes", "creditId", "issueReportedAt"])
      .where("id", "=", bookingId)
      .executeTakeFirst();
    if (!b || b.studentId !== user.id) return fail("Class not found.", 404);
    if (!b.creditId) return fail("This class cannot be reported here. Contact support.");
    if (b.issueReportedAt) return fail("You have already reported this class.");
    if (b.status === "cancelled") return fail("This class was cancelled.");
    const start = new Date(b.scheduledAt).getTime();
    const end = start + b.durationMinutes * 60000;
    if (Date.now() < start) return fail("You can report a class once it has started.");
    if (Date.now() > end + ISSUE_REPORT_WINDOW_HOURS * 60 * 60000) {
      return fail(`Reports close ${ISSUE_REPORT_WINDOW_HOURS} hours after the class.`);
    }

    await db
      .updateTable("mentorshipBookings")
      .set({ issueReportedAt: new Date(), issueNote: note, updatedAt: new Date() })
      .where("id", "=", bookingId)
      .execute();
    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Booking report failed:", error);
    return fail(error instanceof Error ? error.message : "Could not send the report.");
  }
}
