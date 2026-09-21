import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { buildTeacherSaleRowsSql } from "../../../helpers/teacherEarningsSql";
import { IST, Row, get, num, str, analyticsWindow } from "../../../helpers/teacherAnalyticsTime";
import {
  analyticsJson,
  analyticsErrorResponse,
  resolveAnalyticsTeacher,
} from "../../../helpers/teacherAnalyticsAccess";
import {
  schema,
  OutputType,
  AnalyticsStudentPoint,
  AnalyticsCourseCompletion,
  AnalyticsSeriesFinish,
} from "./students_GET.schema";

const MAX_COURSES = 10;
const MAX_SERIES = 20;

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolveAnalyticsTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const { range } = schema.parse({ range: url.searchParams.get("range") ?? undefined });
    const window = analyticsWindow(range);
    const start = window.currentStart;

    const [activityRows, buyerRows, contentRows] = await Promise.all([
      // Enrolment counts per day, plus one row per student and day of
      // activity so month buckets can count each learner once.
      // bundle_enrollments and test_attempts hold naive UTC timestamps.
      sql<Row>`
        WITH enrolments AS (
          SELECT mte.enrolled_at AS at
          FROM mock_test_enrollments mte JOIN mock_tests mt ON mt.id = mte.mock_test_id
          WHERE mt.teacher_id = ${teacherId} AND mte.enrolled_at >= ${start}
          UNION ALL
          SELECT ce.enrolled_at
          FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id
          WHERE c.teacher_id = ${teacherId} AND ce.enrolled_at >= ${start}
          UNION ALL
          SELECT lte.enrolled_at
          FROM live_test_enrollments lte JOIN live_tests lt ON lt.id = lte.live_test_id
          WHERE lt.teacher_id = ${teacherId} AND lte.enrolled_at >= ${start}
          UNION ALL
          SELECT (be.enrolled_at AT TIME ZONE 'UTC')
          FROM bundle_enrollments be JOIN course_bundles cb ON cb.id = be.bundle_id
          WHERE cb.teacher_id = ${teacherId} AND (be.enrolled_at AT TIME ZONE 'UTC') >= ${start}
        ),
        activity AS (
          SELECT ta.student_id, (ta.started_at AT TIME ZONE 'UTC') AS at
          FROM test_attempts ta
          JOIN mock_test_items mti ON mti.id = ta.test_id
          JOIN mock_tests mt ON mt.id = mti.package_id
          WHERE mt.teacher_id = ${teacherId} AND (ta.started_at AT TIME ZONE 'UTC') >= ${start}
          UNION ALL
          SELECT ce.student_id, cp.completed_at
          FROM course_progress cp
          JOIN course_enrollments ce ON ce.id = cp.enrollment_id
          JOIN courses c ON c.id = ce.course_id
          WHERE c.teacher_id = ${teacherId} AND cp.completed_at >= ${start}
        )
        SELECT 'enrol'::text AS metric, to_char((at AT TIME ZONE ${IST})::date, 'YYYY-MM-DD') AS day,
               count(*) AS n, NULL::int AS student_id
        FROM enrolments GROUP BY 2
        UNION ALL
        SELECT DISTINCT 'active', to_char((at AT TIME ZONE ${IST})::date, 'YYYY-MM-DD'), 0, student_id
        FROM activity
      `.execute(db),

      sql<Row>`
        SELECT buyer_id,
               count(DISTINCT order_id) FILTER (WHERE sold_at >= ${start}) AS in_range,
               count(DISTINCT order_id) AS all_time
        FROM ${buildTeacherSaleRowsSql(teacherId)} sales
        WHERE gross > 0 AND buyer_id IS NOT NULL
        GROUP BY buyer_id
        HAVING count(DISTINCT order_id) FILTER (WHERE sold_at >= ${start}) > 0
      `.execute(db),

      // Course completion (all time), then per test series the papers started
      // in the range, how many were finished, and score buckets of each
      // student's first finished attempt per paper among them. NaN scores
      // exist and are left out.
      sql<Row>`
        SELECT 'course'::text AS metric, c.id, c.title::text AS title, NULL::text AS kind,
               count(ce.id)::numeric AS a, count(ce.completed_at)::numeric AS b,
               coalesce(avg(ce.completion_percentage), 0)::numeric AS c
        FROM courses c JOIN course_enrollments ce ON ce.course_id = c.id
        WHERE c.teacher_id = ${teacherId}
        GROUP BY c.id, c.title
        UNION ALL
        SELECT 'series', mt.id,
               coalesce((SELECT lt.title FROM live_tests lt WHERE lt.mock_test_id = mt.id ORDER BY lt.id LIMIT 1), mt.title)::text,
               (SELECT lt.id FROM live_tests lt WHERE lt.mock_test_id = mt.id ORDER BY lt.id LIMIT 1)::text,
               count(DISTINCT (ta.student_id, ta.test_id)),
               count(DISTINCT (ta.student_id, ta.test_id)) FILTER (WHERE ta.completed_at IS NOT NULL),
               0
        FROM test_attempts ta
        JOIN mock_test_items mti ON mti.id = ta.test_id
        JOIN mock_tests mt ON mt.id = mti.package_id
        WHERE mt.teacher_id = ${teacherId} AND (ta.started_at AT TIME ZONE 'UTC') >= ${start}
        GROUP BY mt.id, mt.title
        UNION ALL
        SELECT 'score', first_scores.package_id, NULL, NULL, first_scores.bucket, count(*), 0
        FROM (
          SELECT DISTINCT ON (ta.student_id, ta.test_id)
                 mti.package_id,
                 (CASE WHEN ta.score < 0 THEN -1 ELSE LEAST(9, floor(ta.score / 10)) END)::numeric AS bucket
          FROM test_attempts ta
          JOIN mock_test_items mti ON mti.id = ta.test_id
          JOIN mock_tests mt ON mt.id = mti.package_id
          WHERE mt.teacher_id = ${teacherId}
            AND ta.completed_at IS NOT NULL
            AND ta.score IS NOT NULL AND ta.score <> 'NaN'
            AND (ta.started_at AT TIME ZONE 'UTC') >= ${start}
          ORDER BY ta.student_id, ta.test_id, ta.completed_at
        ) first_scores
        GROUP BY first_scores.package_id, first_scores.bucket
      `.execute(db),
    ]);

    const enrolByBucket = new Map<string, number>();
    const activeByBucket = new Map<string, Set<number>>();
    const activeInRange = new Set<number>();
    let enrolmentTotal = 0;
    for (const row of activityRows.rows) {
      const key = window.bucketOf(str(get(row, "day")));
      if (get(row, "metric") === "enrol") {
        const n = num(get(row, "n"));
        enrolByBucket.set(key, (enrolByBucket.get(key) ?? 0) + n);
        enrolmentTotal += n;
      } else {
        const studentId = num(get(row, "student_id"));
        const learners = activeByBucket.get(key) ?? new Set<number>();
        learners.add(studentId);
        activeByBucket.set(key, learners);
        activeInRange.add(studentId);
      }
    }

    const series: AnalyticsStudentPoint[] = window.buckets.map((key) => ({
      bucket: key,
      enrolments: enrolByBucket.get(key) ?? 0,
      activeLearners: activeByBucket.get(key)?.size ?? 0,
    }));

    const repeatBuyers = buyerRows.rows.filter((row) => num(get(row, "all_time")) >= 2).length;

    const courses: AnalyticsCourseCompletion[] = [];
    const seriesById = new Map<number, AnalyticsSeriesFinish>();
    const scoreRows: Row[] = [];
    for (const row of contentRows.rows) {
      const metric = get(row, "metric");
      if (metric === "course") {
        courses.push({
          id: num(get(row, "id")),
          title: str(get(row, "title"), "Untitled").trim() || "Untitled",
          enrolments: num(get(row, "a")),
          completed: num(get(row, "b")),
          averageProgress: num(get(row, "c")),
        });
      } else if (metric === "series") {
        const liveId = get(row, "kind");
        const mockTestId = num(get(row, "id"));
        seriesById.set(mockTestId, {
          kind: liveId ? "live_test" : "mock_test",
          id: liveId ? num(liveId) : mockTestId,
          title: str(get(row, "title"), "Untitled").trim() || "Untitled",
          started: num(get(row, "a")),
          finished: num(get(row, "b")),
          scores: Array.from({ length: 10 }, () => 0),
          belowZero: 0,
        });
      } else if (metric === "score") {
        scoreRows.push(row);
      }
    }

    for (const row of scoreRows) {
      const entry = seriesById.get(num(get(row, "id")));
      if (!entry) continue;
      const bucket = num(get(row, "a"));
      const count = num(get(row, "b"));
      if (bucket < 0) entry.belowZero += count;
      else entry.scores[Math.min(9, bucket)] += count;
    }

    const output: OutputType = {
      range,
      bucket: window.bucket,
      generatedAt: new Date(),
      totals: {
        enrolments: enrolmentTotal,
        activeLearners: activeInRange.size,
        buyers: buyerRows.rows.length,
        repeatBuyers,
      },
      series,
      courses: courses.sort((a, b) => b.enrolments - a.enrolments).slice(0, MAX_COURSES),
      testSeries: [...seriesById.values()].sort((a, b) => b.started - a.started).slice(0, MAX_SERIES),
    };

    return analyticsJson(output);
  } catch (error) {
    return analyticsErrorResponse("students", error);
  }
}