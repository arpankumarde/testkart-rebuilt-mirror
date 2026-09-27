import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { Row, get, num, str } from "../../../helpers/teacherAnalyticsTime";
import { getRankedLiveTestAttempts } from "../../../helpers/liveTestRanking";
import {
  performanceJson,
  performanceErrorResponse,
  resolvePerformanceTeacher,
  teacherPapersSql,
  teacherLessonsSql,
  teacherNoteReadsSql,
  noteReadingStatus,
  notePercent,
  scoredAttemptSql,
  minutesTakenSql,
  toNumberOrNull,
  toDateOrNull,
  round2,
  progressStatus,
  avatarOrNull,
  getAttemptMarks,
  getPaperMaxMarks,
} from "../../../helpers/teacherPerformance";
import {
  schema,
  OutputType,
  StudentPaperResult,
  StudentLiveResult,
  StudentCourseProgress,
  StudentNoteReading,
  StudentEnrolment,
} from "./student_GET.schema";

const MAX_LIVE_TESTS = 30;

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolvePerformanceTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const { studentId } = schema.parse({ studentId: url.searchParams.get("studentId") ?? undefined });

    const user = await db
      .selectFrom("users")
      .select(["id", "displayName", "avatarUrl"])
      .where("id", "=", studentId)
      .executeTakeFirst();
    if (!user) return performanceJson({ error: "Student not found." }, 404);

    // The pool has one connection, so these run one after another anyway.
    const paperRows = await sql<Row>`
      WITH papers AS (${teacherPapersSql(teacherId, sql`NOT EXISTS (SELECT 1 FROM live_tests l WHERE l.mock_test_id = mt.id)`)}),
      mine AS (
        SELECT ta.test_id, count(*) AS attempts, count(ta.completed_at) AS finished,
               (array_agg(ta.score::float8 ORDER BY ta.completed_at) FILTER (WHERE ${scoredAttemptSql("ta")}))[1] AS first_score,
               (array_agg(ta.score::float8 ORDER BY ta.completed_at DESC) FILTER (WHERE ${scoredAttemptSql("ta")}))[1] AS latest_score,
               (max(coalesce(ta.completed_at, ta.started_at)) AT TIME ZONE 'UTC') AS last_at
        FROM test_attempts ta JOIN papers p ON p.item_id = ta.test_id
        WHERE ta.student_id = ${studentId}
        GROUP BY ta.test_id
      ),
      best AS (
        SELECT DISTINCT ON (ta.student_id, ta.test_id)
               ta.id AS attempt_id, ta.student_id, ta.test_id, ta.score::float8 AS score,
               ${minutesTakenSql("ta", "p.duration_minutes")} AS minutes, ta.completed_at
        FROM test_attempts ta JOIN papers p ON p.item_id = ta.test_id
        WHERE ta.test_id IN (SELECT test_id FROM mine) AND ${scoredAttemptSql("ta")}
        ORDER BY ta.student_id, ta.test_id, ta.score DESC, minutes ASC, ta.completed_at ASC
      ),
      ranked AS (
        SELECT best.*,
               row_number() OVER (PARTITION BY test_id ORDER BY score DESC, minutes ASC, completed_at ASC) AS rank,
               count(*) OVER (PARTITION BY test_id) AS ranked_of
        FROM best
      )
      SELECT p.item_id, p.paper_title, p.series_id, p.series_title, p.in_trash, p.removed,
             m.attempts, m.finished, m.first_score, m.latest_score, m.last_at,
             r.score AS best_score, r.minutes, r.rank, r.ranked_of, r.attempt_id AS best_attempt_id
      FROM mine m
      JOIN papers p ON p.item_id = m.test_id
      LEFT JOIN ranked r ON r.test_id = m.test_id AND r.student_id = ${studentId}
      ORDER BY m.last_at DESC NULLS LAST
    `.execute(db);

    const courseRows = await sql<Row>`
      WITH lessons AS (${teacherLessonsSql(teacherId)})
      SELECT c.id, c.title, ce.enrolled_at,
             (SELECT count(*) FROM lessons l WHERE l.course_id = c.id) AS total,
             (SELECT count(DISTINCT cp.lesson_id)
                FROM course_progress cp
                JOIN lessons l ON l.lesson_id = cp.lesson_id AND l.course_id = c.id
               WHERE cp.enrollment_id = ce.id) AS done,
             (SELECT max(cp.completed_at) FROM course_progress cp WHERE cp.enrollment_id = ce.id) AS last_at
      FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id
      WHERE c.teacher_id = ${teacherId} AND ce.student_id = ${studentId}
      ORDER BY ce.enrolled_at DESC
    `.execute(db);

    const noteRows = await sql<Row>`
      WITH reads AS (${teacherNoteReadsSql(teacherId)})
      SELECT * FROM reads WHERE student_id = ${studentId}
      ORDER BY last_read_at DESC NULLS LAST, purchased_at DESC
    `.execute(db);

    const enrolmentRows = await sql<Row>`
      SELECT 'test_series'::text AS kind, mt.title::text AS title, mte.enrolled_at AS at
      FROM mock_test_enrollments mte JOIN mock_tests mt ON mt.id = mte.mock_test_id
      WHERE mt.teacher_id = ${teacherId} AND mte.student_id = ${studentId}
      UNION ALL
      SELECT 'course', c.title::text, ce.enrolled_at
      FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id
      WHERE c.teacher_id = ${teacherId} AND ce.student_id = ${studentId}
      UNION ALL
      SELECT 'live_test', lt.title::text, lte.enrolled_at
      FROM live_test_enrollments lte JOIN live_tests lt ON lt.id = lte.live_test_id
      WHERE lt.teacher_id = ${teacherId} AND lte.student_id = ${studentId}
      UNION ALL
      SELECT 'bundle', cb.title::text, (be.enrolled_at AT TIME ZONE 'UTC')
      FROM bundle_enrollments be JOIN course_bundles cb ON cb.id = be.bundle_id
      WHERE cb.teacher_id = ${teacherId} AND be.student_id = ${studentId}
      UNION ALL
      SELECT DISTINCT ON (dp.id) 'study_notes', dp.title::text, o.created_at
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN digital_products dp ON dp.id = oi.digital_product_id
      WHERE dp.teacher_id = ${teacherId} AND o.user_id = ${studentId} AND o.status = 'completed'
      ORDER BY 3 DESC
    `.execute(db);

    const liveTests = await db
      .selectFrom("liveTests")
      .select(["liveTests.id", "liveTests.title", "liveTests.mockTestId", "liveTests.startTime", "liveTests.endTime"])
      .where("liveTests.teacherId", "=", teacherId)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("liveTestEnrollments")
            .select("liveTestEnrollments.id")
            .whereRef("liveTestEnrollments.liveTestId", "=", "liveTests.id")
            .where("liveTestEnrollments.studentId", "=", studentId)
        )
      )
      .orderBy("liveTests.endTime", "desc")
      .limit(MAX_LIVE_TESTS)
      .execute();

    const now = Date.now();
    const liveResults: StudentLiveResult[] = [];
    for (const live of liveTests) {
      const startTime = live.startTime ? new Date(live.startTime) : null;
      const endTime = new Date(live.endTime);
      const status: StudentLiveResult["status"] =
        startTime && now < startTime.getTime() ? "upcoming" : now <= endTime.getTime() ? "live" : "ended";
      const ranked =
        status === "upcoming"
          ? []
          : await getRankedLiveTestAttempts(db, {
              id: live.id,
              mockTestId: live.mockTestId,
              startTime: live.startTime,
              endTime: live.endTime,
            });
      const mine = ranked.find((entry) => entry.studentId === studentId);
      liveResults.push({
        liveTestId: live.id,
        title: live.title,
        startTime,
        endTime,
        status,
        rank: mine?.rank ?? null,
        rankedOf: ranked.length,
        score: mine && Number.isFinite(mine.score) ? round2(mine.score) : null,
        timeTakenMinutes: mine ? round2(mine.timeTakenMinutes) : null,
        itemId: mine?.testId ?? null,
        attemptId: mine?.attemptId ?? null,
        marks: null,
        maxMarks: null,
      });
    }

    const bestAttemptIds = paperRows.rows
      .map((row) => toNumberOrNull(get(row, "best_attempt_id")))
      .filter((id): id is number => id !== null);
    const liveAttemptIds = liveResults.map((l) => l.attemptId).filter((id): id is number => id !== null);
    const marks = await getAttemptMarks([...bestAttemptIds, ...liveAttemptIds]);
    const maxMarks = await getPaperMaxMarks([
      ...paperRows.rows.map((row) => num(get(row, "item_id"))),
      ...liveResults.map((l) => l.itemId).filter((id): id is number => id !== null),
    ]);
    for (const live of liveResults) {
      if (live.attemptId === null || live.itemId === null) continue;
      live.marks = marks.get(live.attemptId) ?? { gained: 0, lost: 0, net: 0 };
      live.maxMarks = maxMarks.get(live.itemId) ?? null;
    }

    const papers: StudentPaperResult[] = paperRows.rows.map((row) => {
      const itemId = num(get(row, "item_id"));
      const bestAttemptId = toNumberOrNull(get(row, "best_attempt_id"));
      return {
      itemId,
      paperTitle: str(get(row, "paper_title"), "Untitled paper").trim() || "Untitled paper",
      seriesId: num(get(row, "series_id")),
      seriesTitle: str(get(row, "series_title"), "Untitled").trim() || "Untitled",
      inTrash: get(row, "in_trash") === true,
      removed: get(row, "removed") === true,
      attempts: num(get(row, "attempts")),
      finished: num(get(row, "finished")),
      firstScore: round2(toNumberOrNull(get(row, "first_score"))),
      bestScore: round2(toNumberOrNull(get(row, "best_score"))),
      latestScore: round2(toNumberOrNull(get(row, "latest_score"))),
      timeTakenMinutes: round2(toNumberOrNull(get(row, "minutes"))),
      rank: toNumberOrNull(get(row, "rank")),
      rankedOf: toNumberOrNull(get(row, "ranked_of")),
      lastAttemptAt: toDateOrNull(get(row, "last_at")),
      bestAttemptId,
      bestMarks: bestAttemptId === null ? null : marks.get(bestAttemptId) ?? { gained: 0, lost: 0, net: 0 },
      maxMarks: maxMarks.get(itemId) ?? null,
      };
    });

    const courses: StudentCourseProgress[] = courseRows.rows.map((row) => {
      const total = num(get(row, "total"));
      const done = Math.min(num(get(row, "done")), total || Infinity);
      return {
        courseId: num(get(row, "id")),
        title: str(get(row, "title"), "Untitled").trim() || "Untitled",
        enrolledAt: toDateOrNull(get(row, "enrolled_at")),
        lessonsDone: done,
        lessonsTotal: total,
        progress: total > 0 ? Math.round((done / total) * 1000) / 10 : 0,
        status: progressStatus(done, total),
        lastLessonAt: toDateOrNull(get(row, "last_at")),
      };
    });

    const enrolments: StudentEnrolment[] = enrolmentRows.rows.map((row) => ({
      kind: str(get(row, "kind")) as StudentEnrolment["kind"],
      title: str(get(row, "title"), "Untitled").trim() || "Untitled",
      enrolledAt: toDateOrNull(get(row, "at")),
    }));

    const notes: StudentNoteReading[] = noteRows.rows.map((row) => {
      const pagesTotal = num(get(row, "pages_total"));
      const pagesRead = pagesTotal > 0 ? Math.min(num(get(row, "pages_read")), pagesTotal) : num(get(row, "pages_read"));
      return {
        productId: num(get(row, "product_id")),
        title: str(get(row, "title"), "Untitled").trim() || "Untitled",
        boughtAt: toDateOrNull(get(row, "purchased_at")),
        pagesRead,
        pagesTotal,
        progress: notePercent(pagesRead, pagesTotal),
        status: noteReadingStatus(pagesRead, pagesTotal),
        lastOpenedAt: toDateOrNull(get(row, "last_read_at")),
      };
    });

    if (
      papers.length === 0 &&
      liveResults.length === 0 &&
      courses.length === 0 &&
      notes.length === 0 &&
      enrolments.length === 0
    ) {
      return performanceJson({ error: "This student has not enrolled in or attempted any of your content." }, 404);
    }

    const output: OutputType = {
      student: { id: user.id, name: user.displayName?.trim() || "Student", avatarUrl: avatarOrNull(user.avatarUrl) },
      papers,
      liveTests: liveResults,
      courses,
      notes,
      enrolments,
    };
    return performanceJson(output);
  } catch (error) {
    return performanceErrorResponse("student", error);
  }
}
