import { sql, RawBuilder } from "kysely";
import { db } from "../../../helpers/db";
import { Row, get, num, str } from "../../../helpers/teacherAnalyticsTime";
import {
  performanceJson,
  performanceErrorResponse,
  resolvePerformanceTeacher,
  teacherPapersSql,
  teacherLessonsSql,
  teacherNoteReadsSql,
  scoredAttemptSql,
  toNumberOrNull,
  toDateOrNull,
  round2,
  avatarOrNull,
} from "../../../helpers/teacherPerformance";
import { schema, OutputType, PerformanceScope, PerformanceStudentRow } from "./students_GET.schema";

type Filters = {
  papers: RawBuilder<unknown>;
  courses: RawBuilder<unknown>;
  mockTestEnrolments: RawBuilder<unknown>;
  liveEnrolments: RawBuilder<unknown>;
  /** Narrows the study notes by dp; their reading counts in every scope that includes them. */
  notes: RawBuilder<unknown>;
  /** Bundles and note orders belong to no single item, so they count only on the full roster. */
  other: RawBuilder<unknown>;
  /** One note's roster is its buyers, bundle grants included. */
  notePurchases: RawBuilder<unknown>;
};

const ALL = sql`true`;
const NONE = sql`false`;

async function resolveScope(
  teacherId: number,
  input: { seriesId?: number; liveTestId?: number; courseId?: number; productId?: number }
): Promise<{ scope: PerformanceScope | null; filters: Filters } | null> {
  if (input.seriesId) {
    const row = await db
      .selectFrom("mockTests")
      .select("title")
      .where("id", "=", input.seriesId)
      .where("teacherId", "=", teacherId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      scope: { kind: "series", id: input.seriesId, title: row.title },
      filters: {
        papers: sql`mt.id = ${input.seriesId}`,
        courses: NONE,
        mockTestEnrolments: sql`mt.id = ${input.seriesId}`,
        liveEnrolments: NONE,
        notes: NONE,
        other: NONE,
        notePurchases: NONE,
      },
    };
  }
  if (input.liveTestId) {
    const row = await db
      .selectFrom("liveTests")
      .select(["title", "mockTestId"])
      .where("id", "=", input.liveTestId)
      .where("teacherId", "=", teacherId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      scope: { kind: "live_test", id: input.liveTestId, title: row.title },
      filters: {
        papers: sql`mt.id = ${row.mockTestId}`,
        courses: NONE,
        mockTestEnrolments: NONE,
        liveEnrolments: sql`lt.id = ${input.liveTestId}`,
        notes: NONE,
        other: NONE,
        notePurchases: NONE,
      },
    };
  }
  if (input.courseId) {
    const row = await db
      .selectFrom("courses")
      .select("title")
      .where("id", "=", input.courseId)
      .where("teacherId", "=", teacherId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      scope: { kind: "course", id: input.courseId, title: row.title },
      filters: {
        papers: NONE,
        courses: sql`c.id = ${input.courseId}`,
        mockTestEnrolments: NONE,
        liveEnrolments: NONE,
        notes: NONE,
        other: NONE,
        notePurchases: NONE,
      },
    };
  }
  if (input.productId) {
    const row = await db
      .selectFrom("digitalProducts")
      .select("title")
      .where("id", "=", input.productId)
      .where("teacherId", "=", teacherId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      scope: { kind: "note", id: input.productId, title: row.title },
      filters: {
        papers: NONE,
        courses: NONE,
        mockTestEnrolments: NONE,
        liveEnrolments: NONE,
        notes: sql`dp.id = ${input.productId}`,
        other: NONE,
        notePurchases: sql`dp.id = ${input.productId}`,
      },
    };
  }
  return {
    scope: null,
    filters: {
      papers: ALL,
      courses: ALL,
      mockTestEnrolments: ALL,
      liveEnrolments: ALL,
      notes: ALL,
      other: ALL,
      notePurchases: NONE,
    },
  };
}

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolvePerformanceTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const input = schema.parse({
      seriesId: url.searchParams.get("seriesId") ?? undefined,
      liveTestId: url.searchParams.get("liveTestId") ?? undefined,
      courseId: url.searchParams.get("courseId") ?? undefined,
      productId: url.searchParams.get("productId") ?? undefined,
    });

    const resolved = await resolveScope(teacherId, input);
    if (!resolved) return performanceJson({ error: "That item is not one of yours." }, 404);
    const { scope, filters } = resolved;

    // test_attempts and bundle_enrollments hold naive UTC timestamps.
    const result = await sql<Row>`
      WITH papers AS (${teacherPapersSql(teacherId, filters.papers)}),
      attempts AS (
        SELECT ta.student_id, ta.test_id, ta.score, ta.started_at, ta.completed_at
        FROM test_attempts ta JOIN papers p ON p.item_id = ta.test_id
      ),
      best AS (
        SELECT ta.student_id, ta.test_id, max(ta.score)::float8 AS best
        FROM attempts ta
        WHERE ${scoredAttemptSql("ta")}
        GROUP BY 1, 2
      ),
      test_stats AS (
        SELECT student_id, count(DISTINCT test_id) AS started,
               (max(coalesce(completed_at, started_at)) AT TIME ZONE 'UTC') AS last_at
        FROM attempts GROUP BY 1
      ),
      score_stats AS (
        SELECT student_id, count(*) AS finished, avg(best) AS avg_best, max(best) AS top
        FROM best GROUP BY 1
      ),
      lessons AS (${teacherLessonsSql(teacherId, filters.courses)}),
      course_rows AS (
        SELECT ce.student_id,
               (SELECT count(*) FROM lessons l WHERE l.course_id = ce.course_id) AS total,
               (SELECT count(DISTINCT cp.lesson_id)
                  FROM course_progress cp
                  JOIN lessons l ON l.lesson_id = cp.lesson_id AND l.course_id = ce.course_id
                 WHERE cp.enrollment_id = ce.id) AS done,
               (SELECT max(cp.completed_at) FROM course_progress cp WHERE cp.enrollment_id = ce.id) AS last_at
        FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id
        WHERE c.teacher_id = ${teacherId} AND ${filters.courses}
      ),
      course_stats AS (
        SELECT student_id, count(*) AS courses, sum(done) AS lessons_done,
               avg(CASE WHEN total > 0 THEN least(100, 100.0 * done / total) ELSE 0 END) AS avg_progress,
               max(last_at) AS last_at
        FROM course_rows GROUP BY 1
      ),
      note_rows AS (${teacherNoteReadsSql(teacherId, filters.notes)}),
      note_stats AS (
        SELECT student_id, count(*) AS notes,
               sum(CASE WHEN pages_total > 0 THEN least(pages_read, pages_total) ELSE pages_read END) AS pages_read,
               CASE WHEN sum(pages_total) > 0
                    THEN least(100, 100.0 * sum(least(pages_read, pages_total)) / sum(pages_total))
                    ELSE 0 END AS progress,
               max(last_read_at) AS last_at
        FROM note_rows GROUP BY 1
      ),
      enrolments AS (
        SELECT mte.student_id, mte.enrolled_at AS at
        FROM mock_test_enrollments mte JOIN mock_tests mt ON mt.id = mte.mock_test_id
        WHERE mt.teacher_id = ${teacherId} AND ${filters.mockTestEnrolments}
        UNION ALL
        SELECT ce.student_id, ce.enrolled_at
        FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id
        WHERE c.teacher_id = ${teacherId} AND ${filters.courses}
        UNION ALL
        SELECT lte.student_id, lte.enrolled_at
        FROM live_test_enrollments lte JOIN live_tests lt ON lt.id = lte.live_test_id
        WHERE lt.teacher_id = ${teacherId} AND ${filters.liveEnrolments}
        UNION ALL
        SELECT be.student_id, (be.enrolled_at AT TIME ZONE 'UTC')
        FROM bundle_enrollments be JOIN course_bundles cb ON cb.id = be.bundle_id
        WHERE cb.teacher_id = ${teacherId} AND ${filters.other}
        UNION ALL
        SELECT o.user_id, o.created_at
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN digital_products dp ON dp.id = oi.digital_product_id
        WHERE dp.teacher_id = ${teacherId} AND o.status = 'completed' AND ${filters.other}
        UNION ALL
        SELECT dpp.student_id, (dpp.purchased_at AT TIME ZONE 'UTC')
        FROM digital_product_purchases dpp JOIN digital_products dp ON dp.id = dpp.product_id
        WHERE dp.teacher_id = ${teacherId} AND ${filters.notePurchases}
      ),
      enrol_stats AS (
        SELECT student_id, count(*) AS n, min(at) AS first_at FROM enrolments GROUP BY 1
      ),
      roster AS (
        SELECT student_id FROM enrol_stats
        UNION SELECT student_id FROM test_stats
        UNION SELECT student_id FROM course_stats
        UNION SELECT student_id FROM note_stats
      )
      SELECT r.student_id, coalesce(nullif(trim(u.display_name), ''), 'Student') AS name, u.avatar_url,
             coalesce(es.n, 0) AS enrolments, es.first_at,
             coalesce(ts.started, 0) AS papers_started, coalesce(ss.finished, 0) AS papers_finished,
             ss.avg_best, ss.top,
             coalesce(cs.courses, 0) AS courses, coalesce(cs.lessons_done, 0) AS lessons_done, cs.avg_progress,
             coalesce(ns.notes, 0) AS notes, coalesce(ns.pages_read, 0) AS note_pages_read, ns.progress AS note_progress,
             GREATEST(ts.last_at, cs.last_at, ns.last_at) AS last_active_at
      FROM roster r
      JOIN users u ON u.id = r.student_id
      LEFT JOIN enrol_stats es ON es.student_id = r.student_id
      LEFT JOIN test_stats ts ON ts.student_id = r.student_id
      LEFT JOIN score_stats ss ON ss.student_id = r.student_id
      LEFT JOIN course_stats cs ON cs.student_id = r.student_id
      LEFT JOIN note_stats ns ON ns.student_id = r.student_id
      ORDER BY GREATEST(ts.last_at, cs.last_at, ns.last_at) DESC NULLS LAST, es.first_at DESC NULLS LAST
    `.execute(db);

    const students: PerformanceStudentRow[] = result.rows.map((row) => ({
      studentId: num(get(row, "student_id")),
      name: str(get(row, "name"), "Student"),
      avatarUrl: avatarOrNull(get(row, "avatar_url")),
      enrolments: num(get(row, "enrolments")),
      firstEnrolledAt: toDateOrNull(get(row, "first_at")),
      papersStarted: num(get(row, "papers_started")),
      papersFinished: num(get(row, "papers_finished")),
      averageScore: round2(toNumberOrNull(get(row, "avg_best"))),
      bestScore: round2(toNumberOrNull(get(row, "top"))),
      courses: num(get(row, "courses")),
      lessonsDone: num(get(row, "lessons_done")),
      courseProgress: round2(toNumberOrNull(get(row, "avg_progress"))),
      notes: num(get(row, "notes")),
      notePagesRead: num(get(row, "note_pages_read")),
      noteProgress: num(get(row, "notes")) > 0 ? round2(toNumberOrNull(get(row, "note_progress"))) : null,
      lastActiveAt: toDateOrNull(get(row, "last_active_at")),
    }));

    const scored = students.filter((s) => s.averageScore !== null);
    const learners = students.filter((s) => s.courses > 0);
    const noteReaders = students.filter((s) => s.notePagesRead > 0);
    const mean = (values: number[]) =>
      values.length === 0 ? null : round2(values.reduce((sum, v) => sum + v, 0) / values.length);

    const output: OutputType = {
      generatedAt: new Date(),
      scope,
      totals: {
        students: students.length,
        testTakers: students.filter((s) => s.papersStarted > 0).length,
        papersFinished: students.reduce((sum, s) => sum + s.papersFinished, 0),
        averageScore: mean(scored.map((s) => s.averageScore as number)),
        courseLearners: learners.length,
        averageProgress: mean(learners.map((s) => s.courseProgress ?? 0)),
        noteOwners: students.filter((s) => s.notes > 0).length,
        noteReaders: noteReaders.length,
        averageNoteProgress: mean(noteReaders.map((s) => s.noteProgress ?? 0)),
      },
      students,
    };

    return performanceJson(output);
  } catch (error) {
    return performanceErrorResponse("students", error);
  }
}
