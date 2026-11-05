import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./leave_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const updated = await db
      .updateTable("liveLessonAttendance")
      .set({ leftAt: new Date() })
      .where("id", "=", input.attendanceId)
      .where("userId", "=", user.id)
      .where("leftAt", "is", null)
      .executeTakeFirst();

    if (updated.numUpdatedRows === 0n) {
      // Idempotent: calling leave twice, or after the session already recorded it, is not an error.
      const output: OutputType = { success: true };
      return new Response(superjson.stringify(output));
    }

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error leaving classroom:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
