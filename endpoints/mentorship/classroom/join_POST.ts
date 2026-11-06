import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getLessonAccessContext, LessonAccessError } from "../../../helpers/mentorshipLessonAccess";
import { getVideoProvider } from "../../../helpers/videoProvider";
import { JOIN_WINDOW_MINUTES_BEFORE, JOIN_WINDOW_MINUTES_AFTER } from "../../../helpers/liveLessonConfig";
import { schema, OutputType } from "./join_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Re-resolve membership and timing from the database on every join call - never trust a client
    // claim about role or whether "now" is inside the window.
    const ctx = await getLessonAccessContext(input.kind, input.id, user, effectiveTeacherId);

    if (ctx.status === "cancelled") {
      return new Response(superjson.stringify({ error: "This lesson was cancelled." }), { status: 400 });
    }

    const opensAt = new Date(ctx.startTime.getTime() - JOIN_WINDOW_MINUTES_BEFORE * 60000);
    const closesAt = new Date(ctx.startTime.getTime() + ctx.durationMinutes * 60000 + JOIN_WINDOW_MINUTES_AFTER * 60000);
    const now = new Date();
    if (now < opensAt) {
      return new Response(
        superjson.stringify({ error: `The room opens ${JOIN_WINDOW_MINUTES_BEFORE} minutes before the start time.` }),
        { status: 400 }
      );
    }
    if (now > closesAt) {
      return new Response(superjson.stringify({ error: "This session's join window has closed." }), { status: 400 });
    }

    const roomName = `${ctx.kind}-${ctx.id}`;
    const credentials = await getVideoProvider().issueRoomCredentials({
      roomName,
      identity: `user-${user.id}`,
      displayName: user.displayName,
      role: ctx.viewerRole,
      audience: ctx.kind === "group" ? "group" : "one_to_one",
      ttlSeconds: (ctx.durationMinutes + JOIN_WINDOW_MINUTES_AFTER) * 60,
    });

    const attendanceValues =
      ctx.kind === "booking"
        ? { mentorshipBookingId: ctx.id, groupLessonId: null }
        : { mentorshipBookingId: null, groupLessonId: ctx.id };

    const attendance = await db
      .insertInto("liveLessonAttendance")
      .values({ ...attendanceValues, userId: user.id, role: ctx.viewerRole, joinedAt: now })
      .returning("id")
      .executeTakeFirstOrThrow();

    const output: OutputType = {
      roomId: credentials.roomId,
      token: credentials.token,
      url: credentials.url,
      expiresAt: credentials.expiresAt,
      provider: credentials.provider,
      role: ctx.viewerRole,
      attendanceId: attendance.id,
      title: ctx.title,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof LessonAccessError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error joining classroom:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
