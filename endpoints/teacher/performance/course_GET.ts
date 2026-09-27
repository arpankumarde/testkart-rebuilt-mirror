import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { Row, get, num, str } from "../../../helpers/teacherAnalyticsTime";
import {
  performanceJson,
  performanceErrorResponse,
  resolvePerformanceTeacher,
  teacherLessonsSql,
  toDateOrNull,
  round2,
  progressStatus,
  avatarOrNull,
} from "../../../helpers/teacherPerformance";
import { schema, OutputType, CourseOption, CourseStudentRow } from "./course_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolvePerformanceTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const input = schema.parse({ courseId: url.searchParams.get("courseId") ?? undefined });

    const optionRows = await sql<Row>`
      WITH lessons AS (${teacherLessonsSql(teacherId)})
      SELECT c.id, c.title, c.status::text AS status,
             (SELECT count(*) FROM course_enrollments ce WHERE ce.course_id = c.id) AS enrolled,
             (SELECT count(*) FROM lessons l WHERE l.course_id = c.id) AS lessons
      FROM courses c
      WHERE c.teacher_id = ${teacherId}
      ORDER BY enrolled DESC, c.id DESC
    `.execute(db);

    const courses: CourseOption[] = optionRows.rows.map((row) => ({
      id: num(get(row, "id")),
      title: str(get(row, "title"), "Untitled").trim() || "Untitled",
      status: str(get(row, "status"), "draft"),
      enrolled: num(get(row, "enrolled")),
      lessons: num(get(row, "lessons")),
    }));

    const selected = input.courseId
      ? courses.find((course) => course.id === input.courseId)
      : courses.find((course) => course.enrolled > 0) ?? courses[0];
    if (input.courseId && !selected) return performanceJson({ error: "That course is not one of yours." }, 404);

    if (!selected) {
      const empty: OutputType = { courses, course: null };
      return performanceJson(empty);
    }

    const result = await sql<Row>`
      WITH lessons AS (${teacherLessonsSql(teacherId, sql`c.id = ${selected.id}`)})
      SELECT ce.student_id, coalesce(nullif(trim(u.display_name), ''), 'Student') AS name, u.avatar_url, ce.enrolled_at,
             (SELECT count(DISTINCT cp.lesson_id)
                FROM course_progress cp JOIN lessons l ON l.lesson_id = cp.lesson_id
               WHERE cp.enrollment_id = ce.id) AS done,
             (SELECT max(cp.completed_at) FROM course_progress cp WHERE cp.enrollment_id = ce.id) AS last_at
      FROM course_enrollments ce
      JOIN users u ON u.id = ce.student_id
      WHERE ce.course_id = ${selected.id}
      ORDER BY done DESC, last_at DESC NULLS LAST, ce.enrolled_at DESC
    `.execute(db);

    const total = selected.lessons;
    const rows: CourseStudentRow[] = result.rows.map((row) => {
      const done = total > 0 ? Math.min(num(get(row, "done")), total) : num(get(row, "done"));
      return {
        studentId: num(get(row, "student_id")),
        name: str(get(row, "name"), "Student"),
        avatarUrl: avatarOrNull(get(row, "avatar_url")),
        enrolledAt: toDateOrNull(get(row, "enrolled_at")),
        lessonsDone: done,
        lessonsTotal: total,
        progress: total > 0 ? Math.round((done / total) * 1000) / 10 : 0,
        status: progressStatus(done, total),
        lastLessonAt: toDateOrNull(get(row, "last_at")),
      };
    });

    const output: OutputType = {
      courses,
      course: {
        id: selected.id,
        title: selected.title,
        lessons: total,
        totals: {
          enrolled: rows.length,
          started: rows.filter((r) => r.status !== "not_started").length,
          completed: rows.filter((r) => r.status === "completed").length,
          averageProgress:
            rows.length === 0 ? null : round2(rows.reduce((sum, r) => sum + r.progress, 0) / rows.length),
        },
        rows,
      },
    };
    return performanceJson(output);
  } catch (error) {
    return performanceErrorResponse("course", error);
  }
}
