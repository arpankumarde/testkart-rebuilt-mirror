import superjson from "superjson";
import { sql, RawBuilder } from "kysely";
import { db } from "./db";
import { getServerUserSession } from "./getServerUserSession";
import { Row, get } from "./teacherAnalyticsTime";
import { calculateMaxPossibleMarksWithLimits, QuestionDataWithLimits } from "./testScoringLogic";

export const performanceJson = (body: unknown, status = 200): Response =>
  new Response(superjson.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Student performance is open to the academy owner and team managers: it shows
 * names, scores and progress, never money or contact details. An admin
 * impersonating a teacher works through effectiveTeacherId.
 */
export async function resolvePerformanceTeacher(
  request: Request
): Promise<{ teacherId: number; denied?: undefined } | { teacherId?: undefined; denied: Response }> {
  const { user, effectiveTeacherId } = await getServerUserSession(request);
  if (user.role !== "teacher" && user.role !== "admin") {
    return { denied: performanceJson({ error: "Unauthorized" }, 403) };
  }
  return { teacherId: effectiveTeacherId };
}

export function performanceErrorResponse(label: string, error: unknown): Response {
  console.error(`Error building teacher performance ${label}:`, error);
  if (error instanceof Error && error.name === "NotAuthenticatedError") {
    return performanceJson({ error: "Not authenticated" }, 401);
  }
  if (error instanceof Error && error.name === "ZodError") {
    return performanceJson({ error: "Invalid request" }, 400);
  }
  const message = error instanceof Error ? error.message : "An unknown error occurred";
  return performanceJson({ error: message }, 500);
}

/**
 * Every paper of the teacher's test series, trashed series and removed papers
 * included: those attempts are real student work, so a student's history keeps
 * them and labels them. live_test_id marks the package behind a live test,
 * which is ranked by the live rules instead. Pass an extra condition to narrow
 * the set (it is ANDed onto the WHERE).
 */
export const teacherPapersSql = (teacherId: number, extra: RawBuilder<unknown> = sql`true`) => sql`
  SELECT mti.id AS item_id, mti.title AS paper_title, mti.order_index, mti.duration_minutes,
         (mti.deleted_at IS NOT NULL) AS removed,
         mt.id AS series_id, mt.title AS series_title, (mt.deleted_at IS NOT NULL) AS in_trash,
         lt.id AS live_test_id
  FROM mock_test_items mti
  JOIN mock_tests mt ON mt.id = mti.package_id
  LEFT JOIN LATERAL (
    SELECT l.id FROM live_tests l WHERE l.mock_test_id = mt.id ORDER BY l.id LIMIT 1
  ) lt ON true
  WHERE mt.teacher_id = ${teacherId} AND ${extra}
`;

/** Lessons of the teacher's courses as they stand today; progress is counted against these. */
export const teacherLessonsSql = (teacherId: number, extra: RawBuilder<unknown> = sql`true`) => sql`
  SELECT cs.course_id, cl.id AS lesson_id
  FROM course_sections cs
  JOIN course_lessons cl ON cl.section_id = cs.id
  JOIN courses c ON c.id = cs.course_id
  WHERE c.teacher_id = ${teacherId} AND ${extra}
`;

/**
 * One row per purchase of the teacher's study notes, with how much of it the
 * buyer has read. The web reader logs every page it serves (since 29-09-2026,
 * kept 90 days); reading in the app is not logged. Pages are counted per file,
 * and a page view without a file is the note's main PDF. Pass an extra
 * condition on dp to narrow the notes.
 */
export const teacherNoteReadsSql = (teacherId: number, extra: RawBuilder<unknown> = sql`true`) => sql`
  WITH notes AS (
    SELECT dp.id, dp.title, dp.status::text AS status,
           coalesce(
             nullif((SELECT sum(coalesce(f.page_count, 0)) FROM digital_product_files f WHERE f.product_id = dp.id), 0),
             dp.page_count, 0
           ) AS pages_total,
           (SELECT f.id FROM digital_product_files f
             WHERE f.product_id = dp.id AND f.file_url = dp.pdf_url
             ORDER BY f.order_index, f.id LIMIT 1) AS main_file_id
    FROM digital_products dp
    WHERE dp.teacher_id = ${teacherId} AND ${extra}
  ),
  reads AS (
    SELECT v.user_id, v.document_id,
           count(DISTINCT (coalesce(v.item_id, n.main_file_id, 0), v.page_number)) AS pages_read,
           max(v.created_at) AS last_read_at
    FROM document_page_views v JOIN notes n ON n.id = v.document_id
    WHERE v.document_type = 'note' AND v.user_id IS NOT NULL
    GROUP BY 1, 2
  )
  SELECT dpp.student_id, n.id AS product_id, n.title, n.status, n.pages_total,
         (dpp.purchased_at AT TIME ZONE 'UTC') AS purchased_at,
         coalesce(r.pages_read, 0) AS pages_read, r.last_read_at
  FROM digital_product_purchases dpp
  JOIN notes n ON n.id = dpp.product_id
  LEFT JOIN reads r ON r.user_id = dpp.student_id AND r.document_id = n.id
`;

export type NoteReadingStatus = "not_opened" | "reading" | "finished";

export const noteReadingStatus = (pagesRead: number, pagesTotal: number): NoteReadingStatus =>
  pagesRead <= 0 ? "not_opened" : pagesTotal > 0 && pagesRead >= pagesTotal ? "finished" : "reading";

export const notePercent = (pagesRead: number, pagesTotal: number): number =>
  pagesTotal > 0 ? Math.round(Math.min(1, pagesRead / pagesTotal) * 1000) / 10 : 0;

/** A finished attempt with a usable score. NaN scores exist from an old submit bug. */
export const scoredAttemptSql = (alias: string) =>
  sql.raw(`${alias}.completed_at IS NOT NULL AND ${alias}.score IS NOT NULL AND ${alias}.score <> 'NaN'`);

/** Minutes taken, capped at the paper's duration as the public leaderboard does. */
export const minutesTakenSql = (attempt: string, paperDuration: string) =>
  sql.raw(
    `LEAST(EXTRACT(EPOCH FROM (${attempt}.completed_at - ${attempt}.started_at)) / 60, ${paperDuration})::float8`
  );

/** users.avatar_url holds full links (Google photo, generated avatar or our CDN); blanks and paths become null. */
export const avatarOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return /^https:\/\//i.test(url) ? url : null;
};

export const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const round2 = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 100) / 100;

export const toDateOrNull = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const progressStatus = (done: number, total: number): "not_started" | "in_progress" | "completed" =>
  done <= 0 ? "not_started" : total > 0 && done >= total ? "completed" : "in_progress";

/**
 * Marks one saved answer earned. Answers saved before 02-2026 can lack
 * marks_obtained; those fall back to the question's marks by correctness.
 * Some questions store negative_marks as a negative number, so the magnitude is used.
 */
export const answerMarksSql = (answer: string, question: string) =>
  sql.raw(
    `CASE WHEN ${answer}.marks_obtained IS NOT NULL THEN ${answer}.marks_obtained::float8
          WHEN ${answer}.is_correct THEN coalesce(${question}.positive_marks, 1)::float8
          ELSE -abs(coalesce(${question}.negative_marks, 0))::float8 END`
  );

export type AttemptMarks = { gained: number; lost: number; net: number };

/** Marks gained, lost to negative marking, and net, for each attempt id. Unsubmitted attempts have no answers. */
export async function getAttemptMarks(attemptIds: number[]): Promise<Map<number, AttemptMarks>> {
  const marks = new Map<number, AttemptMarks>();
  const ids = [...new Set(attemptIds)];
  if (ids.length === 0) return marks;
  const result = await sql<Row>`
    SELECT x.test_attempt_id AS attempt_id,
           coalesce(sum(m.v) FILTER (WHERE m.v > 0), 0) AS gained,
           coalesce(-sum(m.v) FILTER (WHERE m.v < 0), 0) AS lost,
           coalesce(sum(m.v), 0) AS net
    FROM test_attempt_answers x
    LEFT JOIN test_questions q ON q.id = x.question_id
    CROSS JOIN LATERAL (SELECT ${answerMarksSql("x", "q")} AS v) m
    WHERE x.test_attempt_id IN (${sql.join(ids.map((id) => sql`${id}`))})
    GROUP BY 1
  `.execute(db);
  for (const row of result.rows) {
    marks.set(Number(get(row, "attempt_id")), {
      gained: round2(Number(get(row, "gained"))) ?? 0,
      lost: round2(Number(get(row, "lost"))) ?? 0,
      net: round2(Number(get(row, "net"))) ?? 0,
    });
  }
  return marks;
}

export type PaperQuestionLimitRow = {
  id: number;
  testId: number;
  positiveMarks: string | number | null;
  subjectId: number | null;
  sectionId: number | null;
  subjectMaxAttemptsAllowed: number | null;
  sectionMaxAttemptsAllowed: number | null;
};

/** Maximum marks as the submit endpoint scores them: subject and section attempt limits count only the top questions. */
export const paperMaxMarks = (questions: PaperQuestionLimitRow[]): number =>
  round2(
    calculateMaxPossibleMarksWithLimits(
      questions.map(
        (q): QuestionDataWithLimits => ({
          id: q.id,
          questionType: null,
          correctOption: null,
          correctOptions: null,
          numericalAnswer: null,
          numericalTolerance: null,
          positiveMarks: q.positiveMarks,
          negativeMarks: null,
          partialMarking: null,
          matchData: null,
          explanation: null,
          subjectId: q.subjectId,
          sectionId: q.sectionId,
          subjectMaxAttemptsAllowed: q.subjectMaxAttemptsAllowed,
          sectionMaxAttemptsAllowed: q.sectionMaxAttemptsAllowed,
        })
      )
    )
  ) ?? 0;

/** Today's maximum marks for each paper, by item id. */
export async function getPaperMaxMarks(itemIds: number[]): Promise<Map<number, number>> {
  const max = new Map<number, number>();
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) return max;
  const rows = await db
    .selectFrom("testQuestions")
    .leftJoin("testItemSubjects", "testItemSubjects.id", "testQuestions.subjectId")
    .leftJoin("subjectSections", "subjectSections.id", "testQuestions.sectionId")
    .select([
      "testQuestions.id",
      "testQuestions.testId",
      "testQuestions.positiveMarks",
      "testQuestions.subjectId",
      "testQuestions.sectionId",
      "testItemSubjects.maxAttemptsAllowed as subjectMaxAttemptsAllowed",
      "subjectSections.maxAttemptsAllowed as sectionMaxAttemptsAllowed",
    ])
    .where("testQuestions.testId", "in", ids)
    .execute();
  const byPaper = new Map<number, PaperQuestionLimitRow[]>();
  for (const row of rows) {
    const list = byPaper.get(row.testId) ?? [];
    list.push(row);
    byPaper.set(row.testId, list);
  }
  for (const [itemId, questions] of byPaper) max.set(itemId, paperMaxMarks(questions));
  return max;
}
