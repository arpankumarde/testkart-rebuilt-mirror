import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { isTeacherSlotFree } from "../../../../helpers/mentorshipSlots";
import { recordSessionEvent } from "../../../../helpers/liveSessionLifecycle";
import { LiveCourseError, errorResponse, getManagedCourse, syncCourseDates } from "../../../../helpers/liveCourseServer";
import { sendClassChangeNotices } from "../../../../helpers/liveCourseNotices";
import { schema, type OutputType } from "./update_POST.schema";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const cls = await db.selectFrom("groupLessons").selectAll().where("id", "=", input.classId).executeTakeFirst();
    if (!cls?.liveCourseId) throw new LiveCourseError("Class not found.", 404);
    const course = await getManagedCourse(cls.liveCourseId, user, effectiveTeacherId);
    if (cls.status !== "scheduled") throw new LiveCourseError(`A ${cls.status} class cannot be edited.`);

    const moved =
      new Date(cls.startTime).getTime() !== input.startTime.getTime() || cls.durationMinutes !== input.durationMinutes;
    if (moved) {
      if (new Date(cls.startTime).getTime() <= Date.now()) throw new LiveCourseError("This class has already started.");
      if (input.startTime.getTime() <= Date.now()) throw new LiveCourseError("Pick a time that has not passed yet.");
      const free = await isTeacherSlotFree(course.teacherId, input.startTime, input.durationMinutes, undefined, cls.id);
      if (!free) throw new LiveCourseError("You already have a class at that time.");
    }
    if (input.topicId) {
      const topic = await db
        .selectFrom("liveCourseTopics")
        .innerJoin("liveCourseModules", "liveCourseModules.id", "liveCourseTopics.moduleId")
        .select("liveCourseTopics.id")
        .where("liveCourseTopics.id", "=", input.topicId)
        .where("liveCourseModules.liveCourseId", "=", course.id)
        .executeTakeFirst();
      if (!topic) throw new LiveCourseError("That topic is not in this course's syllabus.");
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("groupLessons")
        .set({
          title: input.title,
          startTime: input.startTime,
          durationMinutes: input.durationMinutes,
          topicId: input.topicId ?? null,
          ...(moved ? { reminder24hSentAt: null, reminder1hSentAt: null, awaitingCompletionAt: null, completionOverdueAt: null } : {}),
          updatedAt: new Date(),
        })
        .where("id", "=", cls.id)
        .execute();
      if (moved) {
        await recordSessionEvent(trx, {
          kind: "group",
          id: cls.id,
          from: "scheduled",
          to: "scheduled",
          actor: { type: user.role === "admin" ? "admin" : "teacher", id: user.id, label: user.displayName ?? null },
          reason: `Rescheduled from ${new Date(cls.startTime).toISOString()}`,
        });
        await syncCourseDates(trx, course.id);
      }
    });

    if (moved && course.status === "published") {
      await sendClassChangeNotices(course.id, [{ kind: "rescheduled", title: input.title, from: cls.startTime, to: input.startTime }]);
    }

    const output: OutputType = { success: true, rescheduled: moved };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error updating live course class:", error);
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
