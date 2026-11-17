import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getLessonAccessContext, LessonAccessError } from "../../../helpers/mentorshipLessonAccess";
import { JOIN_WINDOW_MINUTES_BEFORE, JOIN_WINDOW_MINUTES_AFTER } from "../../../helpers/liveLessonConfig";
import { getVideoProviderKind } from "../../../helpers/videoProvider";
import { getLivePackageFor, getTrialState } from "../../../helpers/livePackages";
import { schema, OutputType, ClassroomRosterMember } from "./details_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const url = new URL(request.url);
    const input = schema.parse({ kind: url.searchParams.get("kind"), id: url.searchParams.get("id") });

    const ctx = await getLessonAccessContext(input.kind, input.id, user, effectiveTeacherId);

    const teacher = await db.selectFrom("teachers").select(["avatarUrl"]).where("id", "=", ctx.teacherId).executeTakeFirst();

    let roster: ClassroomRosterMember[] = [
      { id: ctx.teacherId, name: ctx.teacherName, avatarUrl: teacher?.avatarUrl ?? null, role: "teacher" },
    ];
    let materialsCount = 0;

    if (ctx.kind === "booking") {
      const booking = await db
        .selectFrom("mentorshipBookings")
        .innerJoin("students as student", "student.id", "mentorshipBookings.studentId")
        .select(["student.id as id", "student.displayName as name", "student.avatarUrl as avatarUrl"])
        .where("mentorshipBookings.id", "=", ctx.id)
        .executeTakeFirst();
      if (booking) roster.push({ id: booking.id, name: booking.name, avatarUrl: booking.avatarUrl, role: "learner" });

      materialsCount = Number(
        (
          await db
            .selectFrom("liveLessonMaterials")
            .select((eb) => eb.fn.countAll().as("count"))
            .where("mentorshipBookingId", "=", ctx.id)
            .executeTakeFirst()
        )?.count ?? 0
      );
    } else {
      const learners = await db
        .selectFrom("groupLessonEnrollments")
        .innerJoin("students as student", "student.id", "groupLessonEnrollments.studentId")
        .select(["student.id as id", "student.displayName as name", "student.avatarUrl as avatarUrl"])
        .where("groupLessonEnrollments.groupLessonId", "=", ctx.id)
        .where("groupLessonEnrollments.status", "=", "enrolled")
        .execute();
      roster = roster.concat(learners.map((l) => ({ ...l, role: "learner" as const })));

      materialsCount = Number(
        (
          await db
            .selectFrom("liveLessonMaterials")
            .select((eb) => eb.fn.countAll().as("count"))
            .where("groupLessonId", "=", ctx.id)
            .executeTakeFirst()
        )?.count ?? 0
      );
    }

    let trialFollowUp: OutputType["trialFollowUp"] = null;
    if (ctx.kind === "booking" && ctx.viewerRole === "learner") {
      const trial = await db
        .selectFrom("mentorshipBookings")
        .innerJoin("liveClassCredits", "liveClassCredits.id", "mentorshipBookings.creditId")
        .innerJoin("teachers as teacher", "teacher.id", "mentorshipBookings.teacherId")
        .select(["mentorshipBookings.studentId", "teacher.slug as teacherSlug"])
        .where("mentorshipBookings.id", "=", ctx.id)
        .where("liveClassCredits.kind", "=", "trial")
        .executeTakeFirst();
      if (trial) {
        const [state, pkg] = await Promise.all([
          getTrialState(trial.studentId, ctx.teacherId),
          getLivePackageFor(trial.studentId, ctx.teacherId),
        ]);
        if (state === "done" && !pkg) trialFollowUp = { teacherSlug: trial.teacherSlug };
      }
    }

    const opensAt = new Date(ctx.startTime.getTime() - JOIN_WINDOW_MINUTES_BEFORE * 60000);
    const closesAt = new Date(ctx.startTime.getTime() + ctx.durationMinutes * 60000 + JOIN_WINDOW_MINUTES_AFTER * 60000);
    const now = new Date();

    const output: OutputType = {
      kind: ctx.kind,
      id: ctx.id,
      title: ctx.title,
      teacherId: ctx.teacherId,
      teacherName: ctx.teacherName,
      teacherAvatarUrl: teacher?.avatarUrl ?? null,
      startTime: ctx.startTime,
      durationMinutes: ctx.durationMinutes,
      status: ctx.status,
      viewerRole: ctx.viewerRole,
      roster,
      materialsCount,
      joinWindow: { isOpen: now >= opensAt && now <= closesAt && ctx.status !== "cancelled", opensAt, closesAt },
      videoProvider: getVideoProviderKind(),
      trialFollowUp,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof LessonAccessError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error fetching classroom details:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
