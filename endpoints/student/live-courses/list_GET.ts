import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { liveCourseSummaryQuery, toSummaries } from "../../../helpers/liveCourseData";
import type { MyLiveCourse, OutputType, TimetableEntry } from "./list_GET.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") return new Response(superjson.stringify({ courses: [], timetable: [] } satisfies OutputType));

    const enrollments = await db
      .selectFrom("liveCourseEnrollments")
      .select(["liveCourseId", "status", "enrolledAt"])
      .where("studentId", "=", user.id)
      .orderBy("enrolledAt", "desc")
      .execute();
    if (enrollments.length === 0) return new Response(superjson.stringify({ courses: [], timetable: [] } satisfies OutputType));

    // A student can re-enrol after a refund; the newest row per course wins.
    const latest = new Map<string, (typeof enrollments)[number]>();
    for (const e of enrollments) if (!latest.has(e.liveCourseId)) latest.set(e.liveCourseId, e);
    const courseIds = [...latest.keys()];
    const activeIds = courseIds.filter((id) => latest.get(id)?.status === "enrolled");

    const now = new Date();
    const [rows, classes, attended] = await Promise.all([
      liveCourseSummaryQuery().where("liveCourses.id", "in", courseIds).execute(),
      db
        .selectFrom("groupLessons")
        .select(["id", "title", "startTime", "durationMinutes", "status", "missedAt", "liveCourseId"])
        .where("liveCourseId", "in", courseIds)
        .orderBy("startTime", "asc")
        .execute(),
      db
        .selectFrom("liveCourseAttendance")
        .innerJoin("groupLessons", "groupLessons.id", "liveCourseAttendance.groupLessonId")
        .select(["groupLessons.liveCourseId", db.fn.countAll<string>().as("n")])
        .where("liveCourseAttendance.studentId", "=", user.id)
        .where("liveCourseAttendance.present", "=", true)
        .where("groupLessons.liveCourseId", "in", courseIds)
        .groupBy("groupLessons.liveCourseId")
        .execute(),
    ]);
    const attendedBy = new Map(attended.map((a) => [a.liveCourseId as string, Number(a.n)]));
    const summaries = await toSummaries(rows);

    const courses: MyLiveCourse[] = summaries.map((s) => {
      const own = classes.filter((c) => c.liveCourseId === s.id);
      const next = own.find(
        (c) => c.status === "scheduled" && new Date(c.startTime).getTime() + c.durationMinutes * 60000 > now.getTime()
      );
      const e = latest.get(s.id)!;
      return {
        ...s,
        enrollmentStatus: e.status as MyLiveCourse["enrollmentStatus"],
        enrolledAt: e.enrolledAt,
        classesHeld: own.filter((c) => c.status === "completed" || (c.status === "scheduled" && new Date(c.startTime) <= now)).length,
        classesAttended: attendedBy.get(s.id) ?? 0,
        nextClass: next ? { id: next.id, title: next.title, startTime: next.startTime, durationMinutes: next.durationMinutes } : null,
      };
    });
    courses.sort((a, b) => {
      const at = a.nextClass ? new Date(a.nextClass.startTime).getTime() : Infinity;
      const bt = b.nextClass ? new Date(b.nextClass.startTime).getTime() : Infinity;
      return at - bt;
    });

    const horizon = now.getTime() + 14 * 24 * 3600000;
    const byId = new Map(summaries.map((s) => [s.id, s]));
    const timetable: TimetableEntry[] = classes
      .filter(
        (c) =>
          activeIds.includes(c.liveCourseId as string) &&
          c.status === "scheduled" &&
          new Date(c.startTime).getTime() + c.durationMinutes * 60000 > now.getTime() &&
          new Date(c.startTime).getTime() < horizon
      )
      .map((c) => {
        const s = byId.get(c.liveCourseId as string)!;
        return {
          classId: c.id,
          title: c.title,
          startTime: c.startTime,
          durationMinutes: c.durationMinutes,
          courseId: s.id,
          courseTitle: s.title,
          teacherName: s.teacher.name,
        };
      });

    const output: OutputType = { courses, timetable };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing student live courses:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}
