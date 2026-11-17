import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { schema, OutputType } from "./set_POST.schema";
import superjson from "superjson";

function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    if (!isValidTimeZone(input.timezone)) {
      return new Response(superjson.stringify({ error: "Unrecognised timezone" }), { status: 400 });
    }

    await db.transaction().execute(async (trx) => {
      await trx.updateTable("teachers").set({ timezone: input.timezone, updatedAt: new Date() }).where("id", "=", effectiveTeacherId).execute();
      await trx.deleteFrom("mentorshipAvailability").where("teacherId", "=", effectiveTeacherId).execute();
      if (input.windows.length > 0) {
        await trx
          .insertInto("mentorshipAvailability")
          .values(
            input.windows.map((w) => ({
              teacherId: effectiveTeacherId,
              dayOfWeek: w.dayOfWeek,
              startTime: w.startTime,
              endTime: w.endTime,
              isActive: w.isActive,
            }))
          )
          .execute();
      }
    });

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error saving mentorship availability:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
