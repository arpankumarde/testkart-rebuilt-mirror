import { db } from "../../helpers/db";
import { generateTeacherSlots } from "../../helpers/mentorshipSlots";
import { schema, OutputType } from "./slots_GET.schema";
import { MENTORSHIP_SESSION_DURATIONS } from "../../helpers/liveLessonConfig";
import superjson from "superjson";

const MAX_RANGE_DAYS = 21;

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const input = schema.parse({
      teacherId: url.searchParams.get("teacherId"),
      durationMinutes: url.searchParams.get("durationMinutes"),
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    if (!(MENTORSHIP_SESSION_DURATIONS as readonly number[]).includes(input.durationMinutes)) {
      return new Response(superjson.stringify({ error: "Unsupported session duration" }), { status: 400 });
    }

    const teacher = await db
      .selectFrom("users")
      .select(["timezone", "mentorshipEnabled"])
      .where("id", "=", input.teacherId)
      .executeTakeFirst();

    if (!teacher || !teacher.mentorshipEnabled) {
      return new Response(superjson.stringify({ error: "This teacher does not offer 1:1 sessions" }), { status: 404 });
    }

    const now = new Date();
    const from = input.from && input.from > now ? input.from : now;
    const maxTo = new Date(from.getTime() + MAX_RANGE_DAYS * 24 * 60 * 60000);
    const to = input.to && input.to < maxTo ? input.to : maxTo;

    const slots = await generateTeacherSlots(input.teacherId, input.durationMinutes, from, to);

    const output: OutputType = {
      teacherTimezone: teacher.timezone,
      durationMinutes: input.durationMinutes,
      slots,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error generating mentorship slots:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
