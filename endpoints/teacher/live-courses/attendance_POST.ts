import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { actorStamp } from "../../../helpers/liveSessionLifecycle";
import { LiveCourseError, errorResponse, getManagedCourse } from "../../../helpers/liveCourseServer";
import { schema, type OutputType } from "./attendance_POST.schema";

/** Teacher (or admin) marks; a mark here overrides the automatic one made when a student joined. */
export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const cls = await db
      .selectFrom("groupLessons")
      .select(["id", "liveCourseId", "startTime"])
      .where("id", "=", input.classId)
      .executeTakeFirst();
    if (!cls?.liveCourseId) throw new LiveCourseError("Class not found.", 404);
    await getManagedCourse(cls.liveCourseId, user, effectiveTeacherId);
    if (new Date(cls.startTime).getTime() > Date.now()) throw new LiveCourseError("Attendance opens once the class starts.");

    const studentIds = input.marks.map((m) => m.studentId);
    const enrolled = await db
      .selectFrom("liveCourseEnrollments")
      .select("studentId")
      .where("liveCourseId", "=", cls.liveCourseId)
      .where("studentId", "in", studentIds)
      .execute();
    const allowed = new Set(enrolled.map((e) => e.studentId));
    const marks = input.marks.filter((m) => allowed.has(m.studentId));
    if (marks.length === 0) throw new LiveCourseError("None of these students are in this course.");

    const by = actorStamp({ type: user.role === "admin" ? "admin" : "teacher", label: user.displayName ?? null });
    await db
      .insertInto("liveCourseAttendance")
      .values(marks.map((m) => ({ groupLessonId: cls.id, studentId: m.studentId, present: m.present, source: "teacher", markedBy: by })))
      .onConflict((oc) =>
        oc.columns(["groupLessonId", "studentId"]).doUpdateSet((eb) => ({
          present: eb.ref("excluded.present"),
          source: "teacher",
          markedBy: by,
          markedAt: new Date(),
        }))
      )
      .execute();

    const output: OutputType = { saved: marks.length };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error saving live course attendance:", error);
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
