import { db } from "../../helpers/db";
import { schema, OutputType } from "./teacher-offerings_GET.schema";
import { MENTORSHIP_SESSION_DURATIONS, MENTORSHIP_RATE_UNIT_MINUTES, MENTORSHIP_MIN_RATE_PER_UNIT } from "../../helpers/liveLessonConfig";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const input = schema.parse({ teacherId: url.searchParams.get("teacherId") });

    const teacher = await db
      .selectFrom("users")
      .select([
        "id",
        "displayName",
        "avatarUrl",
        "bio",
        "tagline",
        "timezone",
        "role",
        "mentorshipEnabled",
        "mentorshipRatePerUnit",
        "liveTeachingStatus",
        "introVideoUrl",
      ])
      .where("id", "=", input.teacherId)
      .executeTakeFirst();

    if (!teacher || teacher.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Teacher not found" }), { status: 404 });
    }

    const approved = teacher.liveTeachingStatus === "approved";
    const rate = Math.max(Number(teacher.mentorshipRatePerUnit ?? 0), MENTORSHIP_MIN_RATE_PER_UNIT);
    const enabled =
      approved && !!teacher.mentorshipEnabled && Number(teacher.mentorshipRatePerUnit ?? 0) >= MENTORSHIP_MIN_RATE_PER_UNIT;

    let isTrialEligible = false;
    try {
      const { user } = await getServerUserSession(request);
      if (user.role === "student") {
        const priorBooking = await db
          .selectFrom("mentorshipBookings")
          .select("id")
          .where("teacherId", "=", input.teacherId)
          .where("studentId", "=", user.id)
          .where("status", "!=", "cancelled")
          .executeTakeFirst();
        isTrialEligible = !priorBooking;
      }
    } catch (error) {
      if (!(error instanceof NotAuthenticatedError)) throw error;
    }

    const output: OutputType = {
      teacher: {
        id: teacher.id,
        displayName: teacher.displayName,
        avatarUrl: teacher.avatarUrl,
        bio: teacher.bio,
        tagline: teacher.tagline,
        timezone: teacher.timezone,
      },
      enabled,
      introVideoUrl: approved ? teacher.introVideoUrl : null,
      durations: enabled
        ? MENTORSHIP_SESSION_DURATIONS.map((minutes) => ({
            durationMinutes: minutes,
            price: Math.round((rate * minutes) / MENTORSHIP_RATE_UNIT_MINUTES),
          }))
        : [],
      isTrialEligible,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching mentorship teacher offerings:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
