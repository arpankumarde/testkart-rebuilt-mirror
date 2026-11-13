import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { recordSessionEvent } from "../../../../helpers/liveSessionLifecycle";
import { LiveCourseError, errorResponse, getManagedCourse, syncCourseDates } from "../../../../helpers/liveCourseServer";
import { sendClassChangeNotices } from "../../../../helpers/liveCourseNotices";
import { schema, type OutputType } from "./cancel_POST.schema";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const cls = await db.selectFrom("groupLessons").selectAll().where("id", "=", input.classId).executeTakeFirst();
    if (!cls?.liveCourseId) throw new LiveCourseError("Class not found.", 404);
    const course = await getManagedCourse(cls.liveCourseId, user, effectiveTeacherId);
    if (cls.status !== "scheduled") throw new LiveCourseError(`This class is already ${cls.status}.`);

    if (course.status === "draft") {
      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom("groupLessons").where("id", "=", cls.id).execute();
        await syncCourseDates(trx, course.id);
      });
      const output: OutputType = { result: "deleted" };
      return new Response(superjson.stringify(output));
    }

    const byAdmin = user.role === "admin";
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("groupLessons")
        .set({
          status: "cancelled",
          cancellationReason: input.reason || null,
          cancelledAt: new Date(),
          cancelledBy: byAdmin ? "admin" : "teacher",
          updatedAt: new Date(),
        })
        .where("id", "=", cls.id)
        .execute();
      await recordSessionEvent(trx, {
        kind: "group",
        id: cls.id,
        from: "scheduled",
        to: "cancelled",
        actor: { type: byAdmin ? "admin" : "teacher", id: user.id, label: user.displayName ?? null },
        reason: input.reason ?? null,
      });
      await syncCourseDates(trx, course.id);
    });

    if (course.status === "published") {
      await sendClassChangeNotices(course.id, [{ kind: "cancelled", title: cls.title, startTime: cls.startTime, reason: input.reason }]);
    }

    const output: OutputType = { result: "cancelled" };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error cancelling live course class:", error);
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
