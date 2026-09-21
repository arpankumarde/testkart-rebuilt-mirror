import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { buildTeacherSaleRowsSql } from "../../../helpers/teacherEarningsSql";
import { Row, get, num, str, analyticsWindow } from "../../../helpers/teacherAnalyticsTime";
import {
  analyticsJson,
  analyticsErrorResponse,
  resolveAnalyticsTeacher,
} from "../../../helpers/teacherAnalyticsAccess";
import { TeacherMixKind, TeacherMixKindValues } from "../dashboard/overview_GET.schema";
import {
  schema,
  OutputType,
  AnalyticsProductRow,
  AnalyticsProductKind,
  AnalyticsProductSort,
  ANALYTICS_PRODUCTS_PAGE_SIZE,
} from "./products_GET.schema";

const KINDS = new Set<string>(TeacherMixKindValues);

type Entry = AnalyticsProductRow & {
  ratingSum: number;
  progressSum: number;
  progressCount: number;
  started: number;
  finished: number;
};

const sortValue = (row: AnalyticsProductRow, sort: AnalyticsProductSort): number | string | null => {
  if (sort === "title") return row.title.toLowerCase();
  return row[sort];
};

export async function handle(request: Request): Promise<Response> {
  try {
    const access = await resolveAnalyticsTeacher(request);
    if (access.denied) return access.denied;
    const { teacherId } = access;

    const url = new URL(request.url);
    const input = schema.parse({
      range: url.searchParams.get("range") ?? undefined,
      kind: url.searchParams.get("kind") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      dir: url.searchParams.get("dir") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
    });
    const window = analyticsWindow(input.range);
    const start = window.currentStart;

    const [catalogueRows, saleRows, metricRows] = await Promise.all([
      // Everything that has ever been on sale. Drafts are left out; anything
      // sold in the range is added from its sale rows even if it has since
      // been deleted.
      sql<Row>`
        SELECT 'mock_test'::text AS kind, mt.id, mt.title::text AS title, NULL::int AS mock_test_id, mt.is_published AS live,
               mt.views AS lifetime_views
        FROM mock_tests mt
        WHERE mt.teacher_id = ${teacherId} AND mt.deleted_at IS NULL AND (mt.is_published OR mt.was_ever_published)
          AND NOT EXISTS (SELECT 1 FROM live_tests lt WHERE lt.mock_test_id = mt.id)
        UNION ALL
        SELECT 'live_test', lt.id, lt.title::text, lt.mock_test_id, lt.is_active, lt.view_count
        FROM live_tests lt
        WHERE lt.teacher_id = ${teacherId}
        UNION ALL
        SELECT 'course', c.id, c.title::text, NULL, c.status = 'published', c.views
        FROM courses c
        WHERE c.teacher_id = ${teacherId} AND c.status <> 'draft'
        UNION ALL
        SELECT 'digital_product', dp.id, dp.title::text, NULL, dp.status = 'published', dp.views
        FROM digital_products dp
        WHERE dp.teacher_id = ${teacherId} AND dp.status <> 'draft'
        UNION ALL
        SELECT 'bundle', cb.id, cb.title::text, NULL, cb.is_published, NULL
        FROM course_bundles cb
        WHERE cb.teacher_id = ${teacherId} AND cb.is_published
      `.execute(db),

      sql<Row>`
        SELECT kind, item_id, title, gross, earnings
        FROM ${buildTeacherSaleRowsSql(teacherId, { start })} sales
      `.execute(db),

      // Per-item counts in one round trip, as (metric, kind, item_id, a, b).
      // Mock-test ids behind a live test are remapped to the live test in JS.
      sql<Row>`
        SELECT 'refund'::text AS metric,
               (CASE WHEN oi.mock_test_id IS NOT NULL THEN 'mock_test'
                     WHEN oi.course_id IS NOT NULL THEN 'course'
                     ELSE 'digital_product' END)::text AS kind,
               COALESCE(oi.mock_test_id, oi.course_id, oi.digital_product_id) AS item_id,
               count(DISTINCT o.id)::numeric AS a, 0::numeric AS b
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN mock_tests mt ON mt.id = oi.mock_test_id
        LEFT JOIN courses c ON c.id = oi.course_id
        LEFT JOIN digital_products dp ON dp.id = oi.digital_product_id
        WHERE o.status = 'refunded' AND o.created_at >= ${start}
          AND (mt.teacher_id = ${teacherId} OR c.teacher_id = ${teacherId} OR dp.teacher_id = ${teacherId})
        GROUP BY 2, 3
        UNION ALL
        SELECT 'refund', 'bundle', cb.id, count(*), 0
        FROM orders o JOIN course_bundles cb ON cb.id = o.bundle_id
        WHERE o.status = 'refunded' AND o.created_at >= ${start} AND cb.teacher_id = ${teacherId}
        GROUP BY cb.id
        UNION ALL
        SELECT 'review',
               (CASE WHEN r.mock_test_id IS NOT NULL THEN 'mock_test'
                     WHEN r.course_id IS NOT NULL THEN 'course'
                     ELSE 'digital_product' END)::text,
               COALESCE(r.mock_test_id, r.course_id, r.digital_product_id),
               sum(r.rating), count(*)
        FROM reviews r
        LEFT JOIN mock_tests mt ON mt.id = r.mock_test_id
        LEFT JOIN courses c ON c.id = r.course_id
        LEFT JOIN digital_products dp ON dp.id = r.digital_product_id
        WHERE mt.teacher_id = ${teacherId} OR c.teacher_id = ${teacherId} OR dp.teacher_id = ${teacherId}
        GROUP BY 2, 3
        UNION ALL
        SELECT 'enrol', 'mock_test', mte.mock_test_id, count(*), 0
        FROM mock_test_enrollments mte JOIN mock_tests mt ON mt.id = mte.mock_test_id
        WHERE mt.teacher_id = ${teacherId} AND mte.enrolled_at >= ${start}
        GROUP BY mte.mock_test_id
        UNION ALL
        SELECT 'enrol', 'live_test', lte.live_test_id, count(*), 0
        FROM live_test_enrollments lte JOIN live_tests lt ON lt.id = lte.live_test_id
        WHERE lt.teacher_id = ${teacherId} AND lte.enrolled_at >= ${start}
        GROUP BY lte.live_test_id
        UNION ALL
        SELECT 'enrol', 'course', ce.course_id, count(*), 0
        FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id
        WHERE c.teacher_id = ${teacherId} AND ce.enrolled_at >= ${start}
        GROUP BY ce.course_id
        UNION ALL
        SELECT 'enrol', 'bundle', be.bundle_id, count(*), 0
        FROM bundle_enrollments be JOIN course_bundles cb ON cb.id = be.bundle_id
        WHERE cb.teacher_id = ${teacherId} AND (be.enrolled_at AT TIME ZONE 'UTC') >= ${start}
        GROUP BY be.bundle_id
        UNION ALL
        SELECT 'progress', 'course', ce.course_id, sum(ce.completion_percentage), count(*)
        FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id
        WHERE c.teacher_id = ${teacherId}
        GROUP BY ce.course_id
        UNION ALL
        -- Tracked visits in the range: distinct browsers, then page views.
        SELECT 'visit', se.entity_type, se.entity_id, count(DISTINCT se.session_id), count(*)
        FROM storefront_events se
        WHERE se.teacher_id = ${teacherId} AND se.event_type = 'view' AND se.created_at >= ${start}
          AND se.entity_type <> 'teacher_profile'
        GROUP BY se.entity_type, se.entity_id
        UNION ALL
        -- One per student and paper, so attempt rows duplicated by a reload
        -- do not count twice.
        SELECT 'finish', 'mock_test', mti.package_id,
               count(DISTINCT (ta.student_id, ta.test_id)) FILTER (WHERE ta.completed_at IS NOT NULL),
               count(DISTINCT (ta.student_id, ta.test_id))
        FROM test_attempts ta
        JOIN mock_test_items mti ON mti.id = ta.test_id
        JOIN mock_tests mt ON mt.id = mti.package_id
        WHERE mt.teacher_id = ${teacherId}
        GROUP BY mti.package_id
      `.execute(db),
    ]);

    const entries = new Map<string, Entry>();
    const liveByMockTest = new Map<number, number>();

    const ensure = (
      kind: TeacherMixKind,
      id: number,
      title: string,
      live: boolean,
      lifetimeViews: number | null = null
    ): Entry => {
      const key = `${kind}:${id}`;
      let entry = entries.get(key);
      if (!entry) {
        entry = {
          kind,
          id,
          title,
          live,
          visitors: 0,
          views: 0,
          lifetimeViews,
          conversion: null,
          paidUnits: 0,
          freeUnits: 0,
          gross: 0,
          net: 0,
          refunds: 0,
          enrolments: kind === "digital_product" ? null : 0,
          rating: null,
          ratingCount: 0,
          completion: null,
          ratingSum: 0,
          progressSum: 0,
          progressCount: 0,
          started: 0,
          finished: 0,
        };
        entries.set(key, entry);
      }
      return entry;
    };

    for (const row of catalogueRows.rows) {
      const kind = str(get(row, "kind"));
      if (!KINDS.has(kind)) continue;
      const id = num(get(row, "id"));
      const lifetime = get(row, "lifetime_views");
      ensure(
        kind as TeacherMixKind,
        id,
        str(get(row, "title"), "Untitled").trim() || "Untitled",
        get(row, "live") === true,
        lifetime === null || lifetime === undefined ? null : num(lifetime)
      );
      const mockTestId = get(row, "mock_test_id");
      if (kind === "live_test" && mockTestId !== null && mockTestId !== undefined) {
        liveByMockTest.set(num(mockTestId), id);
      }
    }

    // Sales, reviews and attempts on a mock test that backs a live test
    // belong to the live test's row.
    const resolve = (rawKind: string, rawId: unknown): { kind: TeacherMixKind; id: number } | null => {
      if (!KINDS.has(rawKind) || rawId === null || rawId === undefined) return null;
      const id = num(rawId);
      if (rawKind === "mock_test" || rawKind === "live_test") {
        const liveId = liveByMockTest.get(id);
        if (liveId !== undefined) return { kind: "live_test", id: liveId };
        return { kind: "mock_test", id };
      }
      return { kind: rawKind as TeacherMixKind, id };
    };

    for (const row of saleRows.rows) {
      const target = resolve(str(get(row, "kind")), get(row, "item_id"));
      if (!target) continue;
      const entry = ensure(target.kind, target.id, str(get(row, "title"), "Untitled").trim() || "Untitled", false);
      const gross = num(get(row, "gross"));
      entry.gross += gross;
      entry.net += num(get(row, "earnings"));
      if (gross > 0) entry.paidUnits += 1;
      else entry.freeUnits += 1;
    }

    for (const row of metricRows.rows) {
      const metric = str(get(row, "metric"));
      const rawKind = str(get(row, "kind"));
      // Enrolment and visit rows for live tests are keyed by the live test id already.
      const target =
        (metric === "enrol" || metric === "visit") && rawKind === "live_test"
          ? { kind: "live_test" as TeacherMixKind, id: num(get(row, "item_id")) }
          : resolve(rawKind, get(row, "item_id"));
      if (!target) continue;
      const entry = entries.get(`${target.kind}:${target.id}`);
      // Items that are neither on sale nor sold in the range stay out.
      if (!entry) continue;
      const a = num(get(row, "a"));
      const b = num(get(row, "b"));
      if (metric === "refund") entry.refunds += a;
      else if (metric === "review") {
        entry.ratingSum += a;
        entry.ratingCount += b;
      } else if (metric === "enrol") entry.enrolments = (entry.enrolments ?? 0) + a;
      else if (metric === "progress") {
        entry.progressSum += a;
        entry.progressCount += b;
      } else if (metric === "finish") {
        entry.finished += a;
        entry.started += b;
      } else if (metric === "visit") {
        entry.visitors += a;
        entry.views += b;
      }
    }

    const all: AnalyticsProductRow[] = [...entries.values()].map((entry) => {
      const { ratingSum, progressSum, progressCount, started, finished, ...row } = entry;
      let completion: number | null = null;
      if (row.kind === "course" && progressCount > 0) completion = progressSum / progressCount;
      if ((row.kind === "mock_test" || row.kind === "live_test") && started > 0) {
        completion = (finished / started) * 100;
      }
      return {
        ...row,
        rating: row.ratingCount > 0 ? ratingSum / row.ratingCount : null,
        completion,
        // Everything bought or claimed per hundred visitors; blank until tracked visits exist.
        conversion: row.visitors > 0 ? ((row.paidUnits + row.freeUnits) / row.visitors) * 100 : null,
      };
    });

    const kindCounts = Object.fromEntries(
      ["all", ...TeacherMixKindValues].map((kind) => [
        kind,
        kind === "all" ? all.length : all.filter((row) => row.kind === kind).length,
      ])
    ) as Record<AnalyticsProductKind, number>;

    const filtered = input.kind === "all" ? all : all.filter((row) => row.kind === input.kind);
    const direction = input.dir === "asc" ? 1 : -1;
    filtered.sort((x, y) => {
      const a = sortValue(x, input.sort);
      const b = sortValue(y, input.sort);
      // Blanks (no rating, no completion) always sink, whichever way the column runs.
      if (a === null && b === null) return y.net - x.net;
      if (a === null) return 1;
      if (b === null) return -1;
      if (a < b) return -direction;
      if (a > b) return direction;
      return y.net - x.net || x.title.localeCompare(y.title);
    });

    const pageSize = ANALYTICS_PRODUCTS_PAGE_SIZE;
    const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(input.page, lastPage);

    const top = [...all]
      .filter((row) => row.net > 0)
      .sort((x, y) => y.net - x.net)
      .slice(0, 10)
      .map(({ kind, id, title, net, gross }) => ({ kind, id, title, net, gross }));

    const output: OutputType = {
      range: input.range,
      generatedAt: new Date(),
      kind: input.kind,
      sort: input.sort,
      dir: input.dir,
      page,
      pageSize,
      total: filtered.length,
      kindCounts,
      rows: filtered.slice((page - 1) * pageSize, page * pageSize),
      top,
    };

    return analyticsJson(output);
  } catch (error) {
    return analyticsErrorResponse("products", error);
  }
}