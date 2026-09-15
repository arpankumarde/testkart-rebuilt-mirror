import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import type { AdminRole } from "../../../helpers/AdminTypes";
import {
  schema,
  OutputType,
  ContentQueues,
  ContentKpis,
  ContentKind,
  PipelineRow,
  ContentDailyPoint,
  CoverageRow,
  TopContentRow,
  TopCreatorRow,
  RecentContentRow,
  ContentTotals,
} from "./dashboard_GET.schema";

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

const CONTENT_ROLES: AdminRole[] = ["super_admin", "admin", "manager"];

// The admin team works in India. IST has no daylight saving, so a fixed offset
// is exact and calendar days can be cut in JS without a timezone library.
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const IST = "Asia/Kolkata";

// A draft nobody has touched in this long counts as stalled.
const STALE_DRAFT_DAYS = 30;

type Row = Record<string, unknown>;

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

// The db instance runs CamelCasePlugin, which rewrites result keys of raw sql
// queries too, so a column aliased empty_series arrives as emptySeries.
const get = (row: Row, key: string): unknown => row[key] ?? row[toCamel(key)];

const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const nullableNum = (value: unknown): number | null =>
  value === null || value === undefined ? null : num(value);

const str = (value: unknown, fallback = ""): string =>
  value === null || value === undefined ? fallback : String(value);

const date = (value: unknown): Date => {
  const parsed = value instanceof Date ? value : new Date(str(value));
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

const isoDay = (utcMs: number): string => new Date(utcMs + IST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * Local-midnight boundaries for "the last N calendar days including today" and
 * the N days before that. Returned as UTC instants for timestamptz comparisons,
 * plus the ISO day strings the daily series is generated over.
 */
function windowBounds(days: number) {
  const nowLocal = new Date(Date.now() + IST_OFFSET_MS);
  const todayLocalMidnightUtcMs =
    Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) - IST_OFFSET_MS;
  const currentStartMs = todayLocalMidnightUtcMs - (days - 1) * DAY_MS;
  const previousStartMs = currentStartMs - days * DAY_MS;
  return {
    currentStart: new Date(currentStartMs),
    previousStart: new Date(previousStartMs),
    currentStartDay: isoDay(currentStartMs),
    todayDay: isoDay(todayLocalMidnightUtcMs),
  };
}

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, CONTENT_ROLES);

    const url = new URL(request.url);
    const { range } = schema.parse({ range: url.searchParams.get("range") ?? undefined });
    const days = RANGE_DAYS[range];
    const { currentStart, previousStart, currentStartDay, todayDay } = windowBounds(days);

    // Half of the content tables store naive timestamps in UTC, the other half
    // store timestamptz. The nv fragments turn a boundary instant into the
    // naive UTC value the first group compares against.
    const curTz = sql`${currentStart}::timestamptz`;
    const prevTz = sql`${previousStart}::timestamptz`;
    const curNv = sql`(${currentStart}::timestamptz AT TIME ZONE 'UTC')`;
    const prevNv = sql`(${previousStart}::timestamptz AT TIME ZONE 'UTC')`;
    const staleAge = sql`(${STALE_DRAFT_DAYS}::int * interval '1 day')`;
    const staleBefore = sql`(now() - ${staleAge})`;
    const staleBeforeNv = sql`((now() - ${staleAge}) AT TIME ZONE 'UTC')`;

    const [queueRows, kpiRows, pipelineRows, dailyRows, coverageRows, contentRows, creatorRows, recentRows, totalRows] =
      await Promise.all([
        sql<Row>`
          SELECT
            (SELECT count(*) FROM content_reviews WHERE status = 'pending') AS reviews_pending,
            (SELECT coalesce(max(extract(epoch FROM now() - created_at)), 0) / 86400
               FROM content_reviews WHERE status = 'pending') AS reviews_oldest_days,
            (SELECT count(*) FROM live_tests
               WHERE has_prizes = true AND prize_distribution_status = 'pending' AND end_time < now()) AS prizes_undistributed,
            (SELECT count(*) FROM mock_tests mt
               WHERE mt.is_published = true AND mt.deleted_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM mock_test_items i WHERE i.package_id = mt.id AND i.deleted_at IS NULL)) AS empty_series,
            (SELECT count(*) FROM mock_test_items i
               JOIN mock_tests mt ON mt.id = i.package_id
               WHERE i.deleted_at IS NULL AND mt.deleted_at IS NULL AND mt.is_published = true
               AND NOT EXISTS (SELECT 1 FROM test_questions q WHERE q.test_id = i.id)) AS tests_without_questions,
            (SELECT count(*) FROM courses c
               WHERE c.status = 'published'
               AND NOT EXISTS (
                 SELECT 1 FROM course_sections s JOIN course_lessons l ON l.section_id = s.id WHERE s.course_id = c.id
               )) AS courses_without_lessons,
            -- The real-file rule from digitalProductRules, identical to hasRealFile on admin/products/list:
            -- with file rows one must be real, otherwise pdf_url must be, and a placeholder URL never is.
            (SELECT count(*) FROM digital_products dp
               WHERE dp.status = 'published'
               AND NOT (CASE
                 WHEN EXISTS (SELECT 1 FROM digital_product_files f WHERE f.product_id = dp.id)
                 THEN EXISTS (SELECT 1 FROM digital_product_files f WHERE f.product_id = dp.id
                   AND btrim(f.file_url) <> '' AND strpos(lower(f.file_url), 'placeholder') = 0)
                 ELSE btrim(dp.pdf_url) <> '' AND strpos(lower(dp.pdf_url), 'placeholder') = 0
               END)) AS notes_without_file,
            (SELECT count(*) FROM live_tests
               WHERE is_active = true AND start_time > now() AND start_time <= now() + interval '7 days') AS live_tests_upcoming_7d
        `.execute(db),

        sql<Row>`
          SELECT
            (SELECT count(*) FROM mock_tests WHERE deleted_at IS NULL AND created_at >= ${curNv})
            + (SELECT count(*) FROM courses WHERE created_at >= ${curTz})
            + (SELECT count(*) FROM digital_products WHERE created_at >= ${curNv})
            + (SELECT count(*) FROM live_tests WHERE created_at >= ${curTz})
            + (SELECT count(*) FROM course_bundles WHERE created_at >= ${curNv}) AS created_cur,

            (SELECT count(*) FROM mock_tests WHERE deleted_at IS NULL AND created_at >= ${prevNv} AND created_at < ${curNv})
            + (SELECT count(*) FROM courses WHERE created_at >= ${prevTz} AND created_at < ${curTz})
            + (SELECT count(*) FROM digital_products WHERE created_at >= ${prevNv} AND created_at < ${curNv})
            + (SELECT count(*) FROM live_tests WHERE created_at >= ${prevTz} AND created_at < ${curTz})
            + (SELECT count(*) FROM course_bundles WHERE created_at >= ${prevNv} AND created_at < ${curNv}) AS created_prev,

            (SELECT count(*) FROM courses WHERE published_at >= ${curTz})
            + (SELECT count(*) FROM digital_products WHERE published_at >= ${curNv})
            + (SELECT count(*) FROM course_bundles WHERE published_at >= ${curNv}) AS published_cur,

            (SELECT count(*) FROM courses WHERE published_at >= ${prevTz} AND published_at < ${curTz})
            + (SELECT count(*) FROM digital_products WHERE published_at >= ${prevNv} AND published_at < ${curNv})
            + (SELECT count(*) FROM course_bundles WHERE published_at >= ${prevNv} AND published_at < ${curNv}) AS published_prev,

            (SELECT count(*) FROM test_questions WHERE created_at >= ${curNv}) AS questions_cur,
            (SELECT count(*) FROM test_questions WHERE created_at >= ${prevNv} AND created_at < ${curNv}) AS questions_prev,
            (SELECT count(*) FROM question_bank WHERE created_at >= ${curTz}) AS bank_questions_cur,
            (SELECT count(*) FROM question_bank WHERE created_at >= ${prevTz} AND created_at < ${curTz}) AS bank_questions_prev,
            (SELECT count(*) FROM test_attempts WHERE completed_at >= ${curNv}) AS attempts_cur,
            (SELECT count(*) FROM test_attempts WHERE completed_at >= ${prevNv} AND completed_at < ${curNv}) AS attempts_prev,

            (SELECT count(*) FROM mock_test_enrollments WHERE enrolled_at >= ${curTz})
            + (SELECT count(*) FROM course_enrollments WHERE enrolled_at >= ${curTz})
            + (SELECT count(*) FROM live_test_enrollments WHERE enrolled_at >= ${curTz})
            + (SELECT count(*) FROM bundle_enrollments WHERE enrolled_at >= ${curNv}) AS enrollments_cur,

            (SELECT count(*) FROM mock_test_enrollments WHERE enrolled_at >= ${prevTz} AND enrolled_at < ${curTz})
            + (SELECT count(*) FROM course_enrollments WHERE enrolled_at >= ${prevTz} AND enrolled_at < ${curTz})
            + (SELECT count(*) FROM live_test_enrollments WHERE enrolled_at >= ${prevTz} AND enrolled_at < ${curTz})
            + (SELECT count(*) FROM bundle_enrollments WHERE enrolled_at >= ${prevNv} AND enrolled_at < ${curNv}) AS enrollments_prev
        `.execute(db),

        sql<Row>`
          SELECT 'mock_test' AS kind, count(*) AS total,
                 count(*) FILTER (WHERE is_published = false) AS draft,
                 count(*) FILTER (WHERE is_published = true) AS published,
                 0::bigint AS archived,
                 count(*) FILTER (WHERE created_at >= ${curNv}) AS created_in_range,
                 NULL::bigint AS published_in_range,
                 count(*) FILTER (WHERE is_published = false AND updated_at < ${staleBeforeNv}) AS stale_drafts
          FROM mock_tests WHERE deleted_at IS NULL
          UNION ALL
          SELECT 'course', count(*),
                 count(*) FILTER (WHERE status = 'draft'),
                 count(*) FILTER (WHERE status = 'published'),
                 count(*) FILTER (WHERE status = 'archived'),
                 count(*) FILTER (WHERE created_at >= ${curTz}),
                 count(*) FILTER (WHERE published_at >= ${curTz}),
                 count(*) FILTER (WHERE status = 'draft' AND updated_at < ${staleBefore})
          FROM courses
          UNION ALL
          SELECT 'digital_product', count(*),
                 count(*) FILTER (WHERE status = 'draft'),
                 count(*) FILTER (WHERE status = 'published'),
                 count(*) FILTER (WHERE status = 'archived'),
                 count(*) FILTER (WHERE created_at >= ${curNv}),
                 count(*) FILTER (WHERE published_at >= ${curNv}),
                 count(*) FILTER (WHERE status = 'draft' AND updated_at < ${staleBeforeNv})
          FROM digital_products
          UNION ALL
          SELECT 'live_test', count(*),
                 count(*) FILTER (WHERE is_active = false),
                 count(*) FILTER (WHERE is_active = true),
                 0::bigint,
                 count(*) FILTER (WHERE created_at >= ${curTz}),
                 NULL::bigint,
                 count(*) FILTER (WHERE is_active = false AND updated_at < ${staleBefore})
          FROM live_tests
          UNION ALL
          SELECT 'course_bundle', count(*),
                 count(*) FILTER (WHERE is_published = false),
                 count(*) FILTER (WHERE is_published = true),
                 0::bigint,
                 count(*) FILTER (WHERE created_at >= ${curNv}),
                 count(*) FILTER (WHERE published_at >= ${curNv}),
                 count(*) FILTER (WHERE is_published = false AND updated_at < ${staleBeforeNv})
          FROM course_bundles
        `.execute(db),

        sql<Row>`
          WITH days AS (
            SELECT generate_series(${currentStartDay}::date, ${todayDay}::date, interval '1 day')::date AS d
          ),
          mt AS (
            SELECT ((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${IST})::date AS d, count(*) AS n
            FROM mock_tests WHERE deleted_at IS NULL AND created_at >= ${curNv} GROUP BY 1
          ),
          co AS (
            SELECT (created_at AT TIME ZONE ${IST})::date AS d, count(*) AS n
            FROM courses WHERE created_at >= ${curTz} GROUP BY 1
          ),
          dp AS (
            SELECT ((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${IST})::date AS d, count(*) AS n
            FROM digital_products WHERE created_at >= ${curNv} GROUP BY 1
          ),
          lt AS (
            SELECT (created_at AT TIME ZONE ${IST})::date AS d, count(*) AS n
            FROM live_tests WHERE created_at >= ${curTz} GROUP BY 1
          ),
          cb AS (
            SELECT ((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${IST})::date AS d, count(*) AS n
            FROM course_bundles WHERE created_at >= ${curNv} GROUP BY 1
          ),
          q AS (
            SELECT ((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${IST})::date AS d, count(*) AS n
            FROM test_questions WHERE created_at >= ${curNv} GROUP BY 1
          ),
          att AS (
            SELECT ((completed_at AT TIME ZONE 'UTC') AT TIME ZONE ${IST})::date AS d, count(*) AS n
            FROM test_attempts WHERE completed_at >= ${curNv} GROUP BY 1
          ),
          pub AS (
            SELECT d, sum(n) AS n FROM (
              SELECT (published_at AT TIME ZONE ${IST})::date AS d, count(*) AS n
              FROM courses WHERE published_at >= ${curTz} GROUP BY 1
              UNION ALL
              SELECT ((published_at AT TIME ZONE 'UTC') AT TIME ZONE ${IST})::date, count(*)
              FROM digital_products WHERE published_at >= ${curNv} GROUP BY 1
              UNION ALL
              SELECT ((published_at AT TIME ZONE 'UTC') AT TIME ZONE ${IST})::date, count(*)
              FROM course_bundles WHERE published_at >= ${curNv} GROUP BY 1
            ) x GROUP BY d
          )
          SELECT to_char(days.d, 'YYYY-MM-DD') AS day,
                 coalesce(mt.n, 0) AS mock_test,
                 coalesce(co.n, 0) AS course,
                 coalesce(dp.n, 0) AS digital_product,
                 coalesce(lt.n, 0) AS live_test,
                 coalesce(cb.n, 0) AS course_bundle,
                 coalesce(q.n, 0) AS questions,
                 coalesce(pub.n, 0) AS published,
                 coalesce(att.n, 0) AS attempts
          FROM days
          LEFT JOIN mt ON mt.d = days.d
          LEFT JOIN co ON co.d = days.d
          LEFT JOIN dp ON dp.d = days.d
          LEFT JOIN lt ON lt.d = days.d
          LEFT JOIN cb ON cb.d = days.d
          LEFT JOIN q ON q.d = days.d
          LEFT JOIN pub ON pub.d = days.d
          LEFT JOIN att ON att.d = days.d
          ORDER BY days.d
        `.execute(db),

        sql<Row>`
          WITH items AS (
            SELECT exam_id FROM mock_tests WHERE is_published = true AND deleted_at IS NULL AND exam_id IS NOT NULL
            UNION ALL SELECT exam_id FROM courses WHERE status = 'published' AND exam_id IS NOT NULL
            UNION ALL SELECT exam_id FROM digital_products WHERE status = 'published' AND exam_id IS NOT NULL
          ),
          per_exam AS (SELECT exam_id, count(*) AS n FROM items GROUP BY exam_id)
          SELECT ec.id AS category_id, ec.category_name,
                 count(e.id) AS exams,
                 count(pe.exam_id) AS covered,
                 coalesce(sum(pe.n), 0) AS published_items
          FROM exam_categories ec
          LEFT JOIN exams e ON e.category_id = ec.id
          LEFT JOIN per_exam pe ON pe.exam_id = e.id
          GROUP BY ec.id, ec.category_name
          ORDER BY count(e.id) DESC, ec.category_name
        `.execute(db),

        sql<Row>`
          WITH eng AS (
            SELECT 'mock_test'::text AS kind, mt.id, mt.title::text AS title, mt.teacher_id, count(*) AS n
            FROM test_attempts ta
            JOIN mock_test_items i ON i.id = ta.test_id
            JOIN mock_tests mt ON mt.id = i.package_id
            WHERE ta.completed_at >= ${curNv} AND mt.deleted_at IS NULL
            GROUP BY mt.id, mt.title, mt.teacher_id
            UNION ALL
            SELECT 'course', c.id, c.title, c.teacher_id, count(*)
            FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id
            WHERE ce.enrolled_at >= ${curTz} GROUP BY c.id, c.title, c.teacher_id
            UNION ALL
            SELECT 'digital_product', d.id, d.title::text, d.teacher_id, count(*)
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN digital_products d ON d.id = oi.digital_product_id
            WHERE o.status = 'completed' AND o.created_at >= ${curTz}
            GROUP BY d.id, d.title, d.teacher_id
            UNION ALL
            SELECT 'live_test', lt.id, lt.title::text, lt.teacher_id, count(*)
            FROM live_test_enrollments le JOIN live_tests lt ON lt.id = le.live_test_id
            WHERE le.enrolled_at >= ${curTz} GROUP BY lt.id, lt.title, lt.teacher_id
            UNION ALL
            SELECT 'course_bundle', cb.id, cb.title::text, cb.teacher_id, count(*)
            FROM bundle_enrollments be JOIN course_bundles cb ON cb.id = be.bundle_id
            WHERE be.enrolled_at >= ${curNv} GROUP BY cb.id, cb.title, cb.teacher_id
          )
          SELECT eng.kind, eng.id, eng.title, u.display_name AS teacher_name, eng.n AS engagement
          FROM eng LEFT JOIN users u ON u.id = eng.teacher_id
          ORDER BY eng.n DESC, eng.title
          LIMIT 8
        `.execute(db),

        sql<Row>`
          WITH made AS (
            SELECT teacher_id, count(*) AS n FROM mock_tests
            WHERE deleted_at IS NULL AND created_at >= ${curNv} GROUP BY 1
            UNION ALL SELECT teacher_id, count(*) FROM courses WHERE created_at >= ${curTz} GROUP BY 1
            UNION ALL SELECT teacher_id, count(*) FROM digital_products WHERE created_at >= ${curNv} GROUP BY 1
            UNION ALL SELECT teacher_id, count(*) FROM live_tests WHERE created_at >= ${curTz} GROUP BY 1
            UNION ALL SELECT teacher_id, count(*) FROM course_bundles WHERE created_at >= ${curNv} GROUP BY 1
          ),
          pub AS (
            SELECT teacher_id, count(*) AS n FROM courses WHERE published_at >= ${curTz} GROUP BY 1
            UNION ALL SELECT teacher_id, count(*) FROM digital_products WHERE published_at >= ${curNv} GROUP BY 1
            UNION ALL SELECT teacher_id, count(*) FROM course_bundles WHERE published_at >= ${curNv} GROUP BY 1
          ),
          qs AS (
            SELECT mt.teacher_id, count(*) AS n
            FROM test_questions q
            JOIN mock_test_items i ON i.id = q.test_id
            JOIN mock_tests mt ON mt.id = i.package_id
            WHERE q.created_at >= ${curNv} GROUP BY 1
          ),
          agg AS (
            SELECT teacher_id, n::bigint AS created, 0::bigint AS published, 0::bigint AS questions FROM made
            UNION ALL SELECT teacher_id, 0::bigint, n::bigint, 0::bigint FROM pub
            UNION ALL SELECT teacher_id, 0::bigint, 0::bigint, n::bigint FROM qs
          )
          SELECT a.teacher_id, coalesce(u.display_name, u.email, 'Unknown teacher') AS name,
                 sum(a.created) AS created, sum(a.published) AS published, sum(a.questions) AS questions
          FROM agg a LEFT JOIN users u ON u.id = a.teacher_id
          GROUP BY a.teacher_id, u.display_name, u.email
          ORDER BY sum(a.created) DESC, sum(a.questions) DESC
          LIMIT 8
        `.execute(db),

        sql<Row>`
          WITH recent AS (
            (SELECT 'mock_test'::text AS kind, id, title::text AS title, teacher_id,
                    (created_at AT TIME ZONE 'UTC') AS created_at,
                    CASE WHEN is_published THEN 'published' ELSE 'draft' END AS status
             FROM mock_tests WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10)
            UNION ALL
            (SELECT 'course', id, title, teacher_id, created_at, status::text
             FROM courses ORDER BY created_at DESC LIMIT 10)
            UNION ALL
            (SELECT 'digital_product', id, title::text, teacher_id, (created_at AT TIME ZONE 'UTC'), status::text
             FROM digital_products ORDER BY created_at DESC LIMIT 10)
            UNION ALL
            (SELECT 'live_test', id, title::text, teacher_id, created_at,
                    CASE WHEN is_active THEN 'published' ELSE 'draft' END
             FROM live_tests ORDER BY created_at DESC LIMIT 10)
            UNION ALL
            (SELECT 'course_bundle', id, title::text, teacher_id, (created_at AT TIME ZONE 'UTC'),
                    CASE WHEN is_published THEN 'published' ELSE 'draft' END
             FROM course_bundles ORDER BY created_at DESC LIMIT 10)
          )
          SELECT r.kind, r.id, r.title, r.status, r.created_at, u.display_name AS teacher_name
          FROM recent r LEFT JOIN users u ON u.id = r.teacher_id
          ORDER BY r.created_at DESC
          LIMIT 10
        `.execute(db),

        sql<Row>`
          SELECT
            (SELECT count(*) FROM exam_categories) AS exam_categories,
            (SELECT count(*) FROM exams) AS exams,
            (SELECT count(*) FROM mock_test_items WHERE deleted_at IS NULL) AS test_items,
            (SELECT count(*) FROM test_questions) AS questions,
            (SELECT count(*) FROM question_bank) AS bank_questions,
            (SELECT count(*) FROM course_sections) AS sections,
            (SELECT count(*) FROM course_lessons) AS lessons
        `.execute(db),
      ]);

    const q = queueRows.rows[0] ?? {};
    const queues: ContentQueues = {
      reviewsPending: num(get(q, "reviews_pending")),
      reviewsOldestDays: Math.floor(num(get(q, "reviews_oldest_days"))),
      prizesUndistributed: num(get(q, "prizes_undistributed")),
      emptySeries: num(get(q, "empty_series")),
      testsWithoutQuestions: num(get(q, "tests_without_questions")),
      coursesWithoutLessons: num(get(q, "courses_without_lessons")),
      notesWithoutFile: num(get(q, "notes_without_file")),
      liveTestsUpcoming7d: num(get(q, "live_tests_upcoming_7d")),
    };

    const k = kpiRows.rows[0] ?? {};
    const pair = (key: string) => ({ current: num(get(k, `${key}_cur`)), previous: num(get(k, `${key}_prev`)) });
    const kpis: ContentKpis = {
      created: pair("created"),
      published: pair("published"),
      questions: pair("questions"),
      bankQuestions: pair("bank_questions"),
      attempts: pair("attempts"),
      enrollments: pair("enrollments"),
    };

    const pipeline: PipelineRow[] = pipelineRows.rows.map((row) => ({
      kind: str(get(row, "kind"), "mock_test") as ContentKind,
      total: num(get(row, "total")),
      draft: num(get(row, "draft")),
      published: num(get(row, "published")),
      archived: num(get(row, "archived")),
      createdInRange: num(get(row, "created_in_range")),
      publishedInRange: nullableNum(get(row, "published_in_range")),
      staleDrafts: num(get(row, "stale_drafts")),
    }));

    const daily: ContentDailyPoint[] = dailyRows.rows.map((row) => ({
      day: str(get(row, "day")),
      mockTest: num(get(row, "mock_test")),
      course: num(get(row, "course")),
      digitalProduct: num(get(row, "digital_product")),
      liveTest: num(get(row, "live_test")),
      courseBundle: num(get(row, "course_bundle")),
      questions: num(get(row, "questions")),
      published: num(get(row, "published")),
      attempts: num(get(row, "attempts")),
    }));

    const coverage: CoverageRow[] = coverageRows.rows
      .map((row) => ({
        categoryId: num(get(row, "category_id")),
        categoryName: str(get(row, "category_name"), "Uncategorised"),
        exams: num(get(row, "exams")),
        covered: num(get(row, "covered")),
        publishedItems: num(get(row, "published_items")),
      }))
      .filter((row) => row.exams > 0);

    const topContent: TopContentRow[] = contentRows.rows.map((row) => ({
      kind: str(get(row, "kind"), "mock_test") as ContentKind,
      id: num(get(row, "id")),
      title: str(get(row, "title"), "Untitled").trim(),
      teacherName: get(row, "teacher_name") ? str(get(row, "teacher_name")) : null,
      engagement: num(get(row, "engagement")),
    }));

    const topCreators: TopCreatorRow[] = creatorRows.rows.map((row) => {
      const teacherId = get(row, "teacher_id");
      return {
        teacherId: teacherId === null || teacherId === undefined ? null : num(teacherId),
        name: str(get(row, "name"), "Unknown teacher"),
        created: num(get(row, "created")),
        published: num(get(row, "published")),
        questions: num(get(row, "questions")),
      };
    });

    const recent: RecentContentRow[] = recentRows.rows.map((row) => ({
      kind: str(get(row, "kind"), "mock_test") as ContentKind,
      id: num(get(row, "id")),
      title: str(get(row, "title"), "Untitled").trim(),
      teacherName: get(row, "teacher_name") ? str(get(row, "teacher_name")) : null,
      status: str(get(row, "status"), "draft"),
      createdAt: date(get(row, "created_at")),
    }));

    const t = totalRows.rows[0] ?? {};
    const totals: ContentTotals = {
      examCategories: num(get(t, "exam_categories")),
      exams: num(get(t, "exams")),
      testItems: num(get(t, "test_items")),
      questions: num(get(t, "questions")),
      bankQuestions: num(get(t, "bank_questions")),
      sections: num(get(t, "sections")),
      lessons: num(get(t, "lessons")),
    };

    const output: OutputType = {
      range,
      days,
      generatedAt: new Date(),
      queues,
      kpis,
      pipeline,
      daily,
      coverage,
      topContent,
      topCreators,
      recent,
      totals,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error building admin content dashboard:", error);
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return new Response(superjson.stringify({ error: error.message }), { status: 403 });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
