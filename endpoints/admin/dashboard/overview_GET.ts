import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  schema,
  OutputType,
  AttentionCounts,
  OverviewKpis,
  DailyPoint,
  MixSlice,
  MixKind,
  TopSeller,
  TopTeacher,
  RecentOrder,
  PlatformTotals,
} from "./overview_GET.schema";

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

// The admin team works in India. IST has no daylight saving, so a fixed offset
// is exact and calendar days can be cut in JS without a timezone library.
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const IST = "Asia/Kolkata";

type Row = Record<string, unknown>;

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

// The db instance runs CamelCasePlugin, which rewrites result keys of raw sql
// queries too, so a column aliased stale_orders arrives as staleOrders.
const get = (row: Row, key: string): unknown => row[key] ?? row[toCamel(key)];

const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

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
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const { range } = schema.parse({ range: url.searchParams.get("range") ?? undefined });
    const days = RANGE_DAYS[range];
    const { currentStart, previousStart, currentStartDay, todayDay } = windowBounds(days);

    const [attentionRows, kpiRows, dailyRows, mixRows, sellerRows, teacherRows, orderRows, totalRows] =
      await Promise.all([
        sql<Row>`
          SELECT
            (SELECT count(*) FROM orders WHERE status = 'pending' AND created_at < now() - interval '1 hour') AS stale_orders,
            (SELECT count(*) FROM orders WHERE status = 'failed' AND created_at >= now() - interval '7 days') AS failed_orders_7d,
            (SELECT count(*) FROM teacher_withdrawals WHERE status = 'pending') AS teacher_withdrawals,
            (SELECT coalesce(sum(amount), 0) FROM teacher_withdrawals WHERE status = 'pending') AS teacher_withdrawals_amount,
            (SELECT count(*) FROM student_withdrawals WHERE status = 'pending') AS student_withdrawals,
            (SELECT coalesce(sum(amount), 0) FROM student_withdrawals WHERE status = 'pending') AS student_withdrawals_amount,
            (SELECT count(*) FROM teacher_bank_details WHERE verification_status = 'pending') AS teacher_bank_pending,
            (SELECT count(*) FROM student_bank_details WHERE verification_status = 'pending') AS student_bank_pending,
            (SELECT count(*) FROM support_threads WHERE status = 'open') AS support_open,
            (SELECT count(DISTINCT m.thread_id) FROM support_messages m
               JOIN support_threads t ON t.id = m.thread_id
               WHERE m.sender_type = 'teacher' AND m.is_read = false AND t.status = 'open') AS support_unread,
            (SELECT count(*) FROM teacher_inquiries WHERE status = 'pending') AS inquiries_pending,
            (SELECT count(*) FROM contact_submissions WHERE status = 'new') AS contact_new,
            (SELECT count(*) FROM content_reviews WHERE status = 'pending') AS reviews_pending,
            (SELECT count(*) FROM sales_contacts WHERE stage = 'new' AND source = 'demo_request') AS demo_requests_new,
            (SELECT count(*) FROM sales_contacts
               WHERE stage IN ('new', 'follow_up', 'qualified') AND follow_up_date < (now() AT TIME ZONE ${IST})::date) AS followups_overdue,
            (SELECT count(*) FROM live_tests
               WHERE has_prizes = true AND prize_distribution_status = 'pending' AND end_time < now()) AS prizes_undistributed,
            (SELECT count(*) FROM teacher_subscriptions
               WHERE status = 'active' AND end_date > now() AND end_date <= now() + interval '7 days') AS subscriptions_expiring_7d,
            (SELECT count(*) FROM ai_generation_logs WHERE status = 'failed' AND created_at >= now() - interval '7 days') AS ai_failed_7d,
            (SELECT count(*) FROM blog_comments WHERE status = 'pending') AS blog_comments_pending
        `.execute(db),

        sql<Row>`
          SELECT
            (SELECT coalesce(sum(total_amount), 0) FROM orders WHERE status = 'completed' AND created_at >= ${currentStart}) AS revenue_cur,
            (SELECT coalesce(sum(total_amount), 0) FROM orders WHERE status = 'completed' AND created_at >= ${previousStart} AND created_at < ${currentStart}) AS revenue_prev,
            (SELECT coalesce(sum(amount), 0) FROM subscription_transactions WHERE status = 'completed' AND transaction_date >= ${currentStart}) AS sub_cur,
            (SELECT coalesce(sum(amount), 0) FROM subscription_transactions WHERE status = 'completed' AND transaction_date >= ${previousStart} AND transaction_date < ${currentStart}) AS sub_prev,
            (SELECT count(*) FROM orders WHERE status = 'completed' AND created_at >= ${currentStart}) AS orders_cur,
            (SELECT count(*) FROM orders WHERE status = 'completed' AND created_at >= ${previousStart} AND created_at < ${currentStart}) AS orders_prev,
            (SELECT count(*) FROM orders WHERE status = 'completed' AND total_amount > 0 AND created_at >= ${currentStart}) AS paid_cur,
            (SELECT count(*) FROM orders WHERE status = 'completed' AND total_amount > 0 AND created_at >= ${previousStart} AND created_at < ${currentStart}) AS paid_prev,
            (SELECT count(*) FROM orders WHERE status = 'failed' AND created_at >= ${currentStart}) AS failed_cur,
            (SELECT count(*) FROM orders WHERE status = 'failed' AND created_at >= ${previousStart} AND created_at < ${currentStart}) AS failed_prev,
            (SELECT count(*) FROM users WHERE role = 'teacher' AND created_at >= ${currentStart}) AS teachers_cur,
            (SELECT count(*) FROM users WHERE role = 'teacher' AND created_at >= ${previousStart} AND created_at < ${currentStart}) AS teachers_prev,
            (SELECT count(*) FROM users WHERE role = 'student' AND created_at >= ${currentStart}) AS students_cur,
            (SELECT count(*) FROM users WHERE role = 'student' AND created_at >= ${previousStart} AND created_at < ${currentStart}) AS students_prev,
            (SELECT count(*) FROM test_attempts WHERE completed_at >= ${currentStart}) AS attempts_cur,
            (SELECT count(*) FROM test_attempts WHERE completed_at >= ${previousStart} AND completed_at < ${currentStart}) AS attempts_prev,
            (SELECT count(*) FROM mock_tests WHERE is_published = true AND deleted_at IS NULL AND created_at >= ${currentStart}) AS tests_cur,
            (SELECT count(*) FROM mock_tests WHERE is_published = true AND deleted_at IS NULL AND created_at >= ${previousStart} AND created_at < ${currentStart}) AS tests_prev
        `.execute(db),

        sql<Row>`
          WITH days AS (
            SELECT generate_series(${currentStartDay}::date, ${todayDay}::date, interval '1 day')::date AS d
          ),
          o AS (
            SELECT (created_at AT TIME ZONE ${IST})::date AS d, sum(total_amount) AS revenue, count(*) AS orders
            FROM orders WHERE status = 'completed' AND created_at >= ${currentStart} GROUP BY 1
          ),
          s AS (
            SELECT (transaction_date AT TIME ZONE ${IST})::date AS d, sum(amount) AS revenue
            FROM subscription_transactions WHERE status = 'completed' AND transaction_date >= ${currentStart} GROUP BY 1
          ),
          u AS (
            SELECT (created_at AT TIME ZONE ${IST})::date AS d,
                   count(*) FILTER (WHERE role = 'teacher') AS teachers,
                   count(*) FILTER (WHERE role = 'student') AS students
            FROM users WHERE created_at >= ${currentStart} GROUP BY 1
          ),
          a AS (
            SELECT ((completed_at AT TIME ZONE 'UTC') AT TIME ZONE ${IST})::date AS d, count(*) AS attempts
            FROM test_attempts WHERE completed_at >= ${currentStart} GROUP BY 1
          )
          SELECT to_char(days.d, 'YYYY-MM-DD') AS day,
                 coalesce(o.revenue, 0) + coalesce(s.revenue, 0) AS revenue,
                 coalesce(o.orders, 0) AS orders,
                 coalesce(u.teachers, 0) AS teachers,
                 coalesce(u.students, 0) AS students,
                 coalesce(a.attempts, 0) AS attempts
          FROM days
          LEFT JOIN o ON o.d = days.d
          LEFT JOIN s ON s.d = days.d
          LEFT JOIN u ON u.d = days.d
          LEFT JOIN a ON a.d = days.d
          ORDER BY days.d
        `.execute(db),

        sql<Row>`
          WITH win AS (
            SELECT o.id, o.total_amount, o.bundle_id,
                   EXISTS (SELECT 1 FROM live_test_enrollments e WHERE e.payment_order_id = o.id) AS is_live
            FROM orders o WHERE o.status = 'completed' AND o.created_at >= ${currentStart}
          ),
          items AS (
            SELECT oi.price_at_purchase * coalesce(oi.quantity, 1) AS amt,
                   CASE WHEN oi.mock_test_id IS NOT NULL THEN 'mock_test'
                        WHEN oi.course_id IS NOT NULL THEN 'course'
                        WHEN oi.digital_product_id IS NOT NULL THEN 'digital_product'
                        WHEN oi.mentorship_plan_id IS NOT NULL OR oi.mentorship_session_type_id IS NOT NULL OR oi.mentorship_booking_id IS NOT NULL THEN 'mentorship'
                        ELSE 'other' END AS kind
            FROM order_items oi JOIN win ON win.id = oi.order_id
            WHERE win.bundle_id IS NULL AND win.is_live = false
          )
          SELECT kind, coalesce(sum(amt), 0) AS revenue, count(*) AS units FROM items GROUP BY kind
          UNION ALL SELECT 'bundle', coalesce(sum(total_amount), 0), count(*) FROM win WHERE bundle_id IS NOT NULL
          UNION ALL SELECT 'live_test', coalesce(sum(total_amount), 0), count(*) FROM win WHERE is_live = true AND bundle_id IS NULL
          UNION ALL SELECT 'subscription', coalesce(sum(amount), 0), count(*)
                    FROM subscription_transactions WHERE status = 'completed' AND transaction_date >= ${currentStart}
        `.execute(db),

        sql<Row>`
          WITH win AS (
            SELECT o.id, o.total_amount, o.bundle_id,
                   EXISTS (SELECT 1 FROM live_test_enrollments e WHERE e.payment_order_id = o.id) AS is_live
            FROM orders o WHERE o.status = 'completed' AND o.created_at >= ${currentStart}
          ),
          items AS (
            SELECT oi.price_at_purchase * coalesce(oi.quantity, 1) AS amt,
                   CASE WHEN oi.mock_test_id IS NOT NULL THEN 'mock_test'
                        WHEN oi.course_id IS NOT NULL THEN 'course'
                        WHEN oi.digital_product_id IS NOT NULL THEN 'digital_product'
                        ELSE 'other' END AS kind,
                   coalesce(mt.title, c.title, dp.title, 'Other') AS title,
                   coalesce(mt.teacher_id, c.teacher_id, dp.teacher_id) AS teacher_id
            FROM order_items oi
            JOIN win ON win.id = oi.order_id
            LEFT JOIN mock_tests mt ON mt.id = oi.mock_test_id
            LEFT JOIN courses c ON c.id = oi.course_id
            LEFT JOIN digital_products dp ON dp.id = oi.digital_product_id
            WHERE win.bundle_id IS NULL AND win.is_live = false
          ),
          bundles AS (
            SELECT win.total_amount AS amt, 'bundle' AS kind, cb.title, cb.teacher_id
            FROM win JOIN course_bundles cb ON cb.id = win.bundle_id
          ),
          everything AS (
            SELECT amt, kind, title, teacher_id FROM items
            UNION ALL SELECT amt, kind, title, teacher_id FROM bundles
          )
          SELECT e.kind, e.title, u.display_name AS teacher_name, count(*) AS units, sum(e.amt) AS revenue
          FROM everything e LEFT JOIN users u ON u.id = e.teacher_id
          GROUP BY e.kind, e.title, u.display_name
          ORDER BY sum(e.amt) DESC, count(*) DESC
          LIMIT 6
        `.execute(db),

        sql<Row>`
          WITH win AS (
            SELECT o.id, o.total_amount, o.bundle_id,
                   EXISTS (SELECT 1 FROM live_test_enrollments e WHERE e.payment_order_id = o.id) AS is_live
            FROM orders o WHERE o.status = 'completed' AND o.created_at >= ${currentStart}
          ),
          items AS (
            SELECT oi.price_at_purchase * coalesce(oi.quantity, 1) AS amt,
                   coalesce(mt.teacher_id, c.teacher_id, dp.teacher_id) AS teacher_id
            FROM order_items oi
            JOIN win ON win.id = oi.order_id
            LEFT JOIN mock_tests mt ON mt.id = oi.mock_test_id
            LEFT JOIN courses c ON c.id = oi.course_id
            LEFT JOIN digital_products dp ON dp.id = oi.digital_product_id
            WHERE win.bundle_id IS NULL AND win.is_live = false
          ),
          bundles AS (
            SELECT win.total_amount AS amt, cb.teacher_id FROM win JOIN course_bundles cb ON cb.id = win.bundle_id
          ),
          live AS (
            SELECT win.total_amount AS amt, lt.teacher_id
            FROM win JOIN live_test_enrollments e ON e.payment_order_id = win.id
            JOIN live_tests lt ON lt.id = e.live_test_id
            WHERE win.is_live = true AND win.bundle_id IS NULL
          ),
          everything AS (
            SELECT amt, teacher_id FROM items
            UNION ALL SELECT amt, teacher_id FROM bundles
            UNION ALL SELECT amt, teacher_id FROM live
          )
          SELECT e.teacher_id, coalesce(u.display_name, u.email, 'Unknown teacher') AS name, count(*) AS units, sum(e.amt) AS revenue
          FROM everything e LEFT JOIN users u ON u.id = e.teacher_id
          GROUP BY e.teacher_id, u.display_name, u.email
          ORDER BY sum(e.amt) DESC, count(*) DESC
          LIMIT 5
        `.execute(db),

        sql<Row>`
          SELECT o.id, o.total_amount, o.status, o.created_at, o.payment_method,
                 coalesce(u.display_name, u.email, 'Guest') AS student_name,
                 (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
                 (SELECT coalesce(mt.title, c.title, dp.title)
                    FROM order_items oi
                    LEFT JOIN mock_tests mt ON mt.id = oi.mock_test_id
                    LEFT JOIN courses c ON c.id = oi.course_id
                    LEFT JOIN digital_products dp ON dp.id = oi.digital_product_id
                    WHERE oi.order_id = o.id ORDER BY oi.id LIMIT 1) AS first_item,
                 cb.title AS bundle_title
          FROM orders o
          LEFT JOIN users u ON u.id = o.user_id
          LEFT JOIN course_bundles cb ON cb.id = o.bundle_id
          ORDER BY o.created_at DESC
          LIMIT 8
        `.execute(db),

        sql<Row>`
          SELECT
            (SELECT count(*) FROM users WHERE role = 'teacher') AS teachers,
            (SELECT count(*) FROM users WHERE role = 'student') AS students,
            (SELECT count(*) FROM mock_tests WHERE is_published = true AND deleted_at IS NULL) AS published_tests,
            (SELECT count(*) FROM courses WHERE status = 'published') AS published_courses,
            (SELECT count(*) FROM digital_products WHERE status = 'published') AS published_products,
            (SELECT count(*) FROM course_bundles WHERE is_published = true) AS published_bundles,
            (SELECT count(*) FROM live_tests WHERE is_active = true AND end_time > now()) AS active_live_tests,
            (SELECT count(*) FROM teacher_subscriptions WHERE status = 'active' AND end_date > now()) AS active_subscriptions,
            (SELECT count(*) FROM orders WHERE status = 'completed') AS completed_orders,
            (SELECT coalesce(sum(total_amount), 0) FROM orders WHERE status = 'completed')
              + (SELECT coalesce(sum(amount), 0) FROM subscription_transactions WHERE status = 'completed') AS lifetime_revenue
        `.execute(db),
      ]);

    const a = attentionRows.rows[0] ?? {};
    const attention: AttentionCounts = {
      staleOrders: num(get(a, "stale_orders")),
      failedOrders7d: num(get(a, "failed_orders_7d")),
      teacherWithdrawals: num(get(a, "teacher_withdrawals")),
      teacherWithdrawalsAmount: num(get(a, "teacher_withdrawals_amount")),
      studentWithdrawals: num(get(a, "student_withdrawals")),
      studentWithdrawalsAmount: num(get(a, "student_withdrawals_amount")),
      teacherBankPending: num(get(a, "teacher_bank_pending")),
      studentBankPending: num(get(a, "student_bank_pending")),
      supportOpen: num(get(a, "support_open")),
      supportUnread: num(get(a, "support_unread")),
      inquiriesPending: num(get(a, "inquiries_pending")),
      contactNew: num(get(a, "contact_new")),
      reviewsPending: num(get(a, "reviews_pending")),
      demoRequestsNew: num(get(a, "demo_requests_new")),
      followupsOverdue: num(get(a, "followups_overdue")),
      prizesUndistributed: num(get(a, "prizes_undistributed")),
      subscriptionsExpiring7d: num(get(a, "subscriptions_expiring_7d")),
      aiFailed7d: num(get(a, "ai_failed_7d")),
      blogCommentsPending: num(get(a, "blog_comments_pending")),
    };

    const k = kpiRows.rows[0] ?? {};
    const pair = (key: string) => ({ current: num(get(k, `${key}_cur`)), previous: num(get(k, `${key}_prev`)) });
    const orderRevenue = pair("revenue");
    const subscriptionRevenue = pair("sub");
    const kpis: OverviewKpis = {
      revenue: {
        current: orderRevenue.current + subscriptionRevenue.current,
        previous: orderRevenue.previous + subscriptionRevenue.previous,
      },
      subscriptionRevenue,
      orders: pair("orders"),
      paidOrders: pair("paid"),
      failedOrders: pair("failed"),
      newTeachers: pair("teachers"),
      newStudents: pair("students"),
      attempts: pair("attempts"),
      testsPublished: pair("tests"),
    };

    const daily: DailyPoint[] = dailyRows.rows.map((row) => ({
      day: str(get(row, "day")),
      revenue: num(get(row, "revenue")),
      orders: num(get(row, "orders")),
      teachers: num(get(row, "teachers")),
      students: num(get(row, "students")),
      attempts: num(get(row, "attempts")),
    }));

    const mix: MixSlice[] = mixRows.rows
      .map((row) => ({
        kind: str(get(row, "kind"), "other") as MixKind,
        revenue: num(get(row, "revenue")),
        units: num(get(row, "units")),
      }))
      .filter((slice) => slice.units > 0 || slice.revenue > 0)
      .sort((x, y) => y.revenue - x.revenue || y.units - x.units);

    const topSellers: TopSeller[] = sellerRows.rows.map((row) => ({
      kind: str(get(row, "kind"), "other") as MixKind,
      title: str(get(row, "title"), "Untitled").trim(),
      teacherName: get(row, "teacher_name") ? str(get(row, "teacher_name")) : null,
      units: num(get(row, "units")),
      revenue: num(get(row, "revenue")),
    }));

    const topTeachers: TopTeacher[] = teacherRows.rows.map((row) => {
      const teacherId = get(row, "teacher_id");
      return {
        teacherId: teacherId === null || teacherId === undefined ? null : num(teacherId),
        name: str(get(row, "name"), "Unknown teacher"),
        units: num(get(row, "units")),
        revenue: num(get(row, "revenue")),
      };
    });

    const recentOrders: RecentOrder[] = orderRows.rows.map((row) => {
      const itemCount = num(get(row, "item_count"));
      const bundleTitle = get(row, "bundle_title") ? str(get(row, "bundle_title")) : null;
      const firstItem = get(row, "first_item") ? str(get(row, "first_item")) : null;
      let summary = bundleTitle ?? firstItem ?? "No items";
      if (!bundleTitle && itemCount > 1) summary = `${summary} and ${itemCount - 1} more`;
      return {
        id: num(get(row, "id")),
        amount: num(get(row, "total_amount")),
        status: str(get(row, "status"), "pending"),
        createdAt: date(get(row, "created_at")),
        studentName: str(get(row, "student_name"), "Guest"),
        itemCount,
        summary,
        paymentMethod: get(row, "payment_method") ? str(get(row, "payment_method")) : null,
      };
    });

    const t = totalRows.rows[0] ?? {};
    const totals: PlatformTotals = {
      teachers: num(get(t, "teachers")),
      students: num(get(t, "students")),
      publishedTests: num(get(t, "published_tests")),
      publishedCourses: num(get(t, "published_courses")),
      publishedProducts: num(get(t, "published_products")),
      publishedBundles: num(get(t, "published_bundles")),
      activeLiveTests: num(get(t, "active_live_tests")),
      activeSubscriptions: num(get(t, "active_subscriptions")),
      completedOrders: num(get(t, "completed_orders")),
      lifetimeRevenue: num(get(t, "lifetime_revenue")),
    };

    const output: OutputType = {
      range,
      days,
      generatedAt: new Date(),
      attention,
      kpis,
      daily,
      mix,
      topSellers,
      topTeachers,
      recentOrders,
      totals,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error building admin dashboard overview:", error);
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
