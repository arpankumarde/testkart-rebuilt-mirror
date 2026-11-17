import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, CLASSES_LIMIT, type OutputType } from "./classes_GET.schema";

const classEnd = sql<Date>`gl.start_time + make_interval(mins => gl.duration_minutes)`;

/* Live course classes across every course, for the admin schedule. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));

    let q = db
      .selectFrom("groupLessons as gl")
      .innerJoin("liveCourses as lc", "lc.id", "gl.liveCourseId")
      .innerJoin("teachers as t", "t.id", "gl.teacherId")
      .select([
        "gl.id",
        "gl.title",
        "gl.startTime",
        "gl.durationMinutes",
        "gl.status",
        "gl.missedAt",
        "gl.cancellationReason",
        "lc.id as courseId",
        "lc.title as courseTitle",
        "lc.status as courseStatus",
        "lc.enrolledCount",
        "t.id as teacherId",
        "t.displayName as teacherName",
      ])
      .where("gl.liveCourseId", "is not", null);

    if (input.view === "upcoming") {
      q = q.where("gl.status", "=", "scheduled").where(sql<boolean>`${classEnd} > now()`).orderBy("gl.startTime", "asc");
    } else if (input.view === "unmarked") {
      q = q.where("gl.status", "=", "scheduled").where(sql<boolean>`${classEnd} <= now()`).orderBy("gl.startTime", "asc");
    } else if (input.view === "past") {
      q = q
        .where(sql<boolean>`${classEnd} <= now()`)
        .where((eb) => eb.or([eb("gl.status", "!=", "cancelled"), eb("gl.missedAt", "is not", null)]))
        .orderBy("gl.startTime", "desc");
    } else {
      q = q.where("gl.status", "=", "cancelled").where("gl.missedAt", "is", null).orderBy("gl.startTime", "desc");
    }

    if (input.q) {
      const like = `%${input.q.replace(/[%_\\]/g, "\\$&")}%`;
      q = q.where((eb) => eb.or([eb("gl.title", "ilike", like), eb("lc.title", "ilike", like), eb("t.displayName", "ilike", like)]));
    }

    const rows = await q.limit(CLASSES_LIMIT + 1).execute();
    const shown = rows.slice(0, CLASSES_LIMIT);

    const present = shown.length
      ? await db
          .selectFrom("liveCourseAttendance")
          .select((eb) => ["groupLessonId", eb.fn.countAll<string>().as("n")])
          .where("groupLessonId", "in", shown.map((r) => r.id))
          .where("present", "=", true)
          .groupBy("groupLessonId")
          .execute()
      : [];
    const presentById = new Map(present.map((p) => [p.groupLessonId, Number(p.n)]));
    const now = Date.now();

    const output: OutputType = {
      truncated: rows.length > CLASSES_LIMIT,
      classes: shown.map((r) => {
        const ended = new Date(r.startTime).getTime() + r.durationMinutes * 60000 <= now;
        return {
          id: r.id,
          title: r.title,
          startTime: r.startTime,
          durationMinutes: r.durationMinutes,
          status: r.missedAt ? "missed" : r.status,
          unmarked: r.status === "scheduled" && ended,
          cancellationReason: r.cancellationReason,
          course: { id: r.courseId, title: r.courseTitle, status: r.courseStatus, enrolledCount: r.enrolledCount },
          teacher: { id: r.teacherId, name: r.teacherName?.trim() || `Teacher #${r.teacherId}` },
          presentCount: presentById.get(r.id) ?? 0,
        };
      }),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live course classes failed:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Could not load classes." }), { status: 400 });
  }
}
