import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import {
  buildTeacherSaleRowsSql,
  buildTeacherNetEarningsSql,
  buildTeacherAvailableBalanceSql,
} from "../../../helpers/teacherEarningsSql";
import { IST, Row, get, num, str, date, isoDay, windowBounds } from "../../../helpers/teacherAnalyticsTime";
import {
  schema,
  OutputType,
  TeacherAttentionCounts,
  TeacherBankStatus,
  TeacherOverviewKpis,
  TeacherDailyPoint,
  TeacherMixKind,
  TeacherTopSeller,
  TeacherRecentSale,
  TeacherOverviewTotals,
} from "./overview_GET.schema";

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

const MIX_KINDS = new Set<string>(["mock_test", "live_test", "course", "digital_product", "bundle"]);
const asMixKind = (value: unknown): TeacherMixKind => {
  const kind = str(value);
  return (MIX_KINDS.has(kind) ? kind : "mock_test") as TeacherMixKind;
};

/**
 * Team managers run the catalogue but never see the owner's money: earnings,
 * sale amounts, balance, withdrawals, bank status, plan or support queue.
 */
function withoutOwnerMoney(output: OutputType): OutputType {
  return {
    ...output,
    attention: {
      ...output.attention,
      withdrawalsPending: 0,
      withdrawalsPendingAmount: 0,
      supportUnread: 0,
      subscriptionExpiring: 0,
      bankStatus: "verified",
    },
    kpis: {
      ...output.kpis,
      earnings: { current: 0, previous: 0 },
      grossSales: { current: 0, previous: 0 },
    },
    daily: output.daily.map((point) => ({ ...point, earnings: 0 })),
    topSellers: output.topSellers.map((seller) => ({ ...seller, earnings: 0 })),
    recentSales: output.recentSales.map((sale) => ({ ...sale, amount: 0 })),
    totals: { ...output.totals, lifetimeEarnings: 0, availableBalance: 0 },
  };
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    const isManager = teacherRole === "manager";

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const teacherId = effectiveTeacherId;
    const url = new URL(request.url);
    const { range } = schema.parse({ range: url.searchParams.get("range") ?? undefined });
    const days = RANGE_DAYS[range];
    const { currentStart, previousStart, currentStartDay, previousStartDay, todayDay } = windowBounds(days);

    // Sales and activity are both read across the FULL span (previous window
    // start through today) in one pass each, then split in JS on the current
    // window's first day. Day boundaries are local midnight, so the split is
    // exact — and it halves the number of times the earnings fragment and the
    // enrollment union have to run.
    const [attentionRows, saleRows, activityRows, recentRows, totalRows] = await Promise.all([
      sql<Row>`
        SELECT
          (SELECT count(*) FROM content_reviews WHERE teacher_id = ${teacherId} AND status = 'pending' AND content_type = 'mock_test') AS reviews_pending_tests,
          (SELECT count(*) FROM content_reviews WHERE teacher_id = ${teacherId} AND status = 'pending' AND content_type = 'course') AS reviews_pending_courses,
          (SELECT count(*) FROM content_reviews WHERE teacher_id = ${teacherId} AND status = 'pending' AND content_type = 'digital_product') AS reviews_pending_products,
          (SELECT count(*) FROM content_reviews WHERE teacher_id = ${teacherId} AND status = 'pending' AND content_type = 'course_bundle') AS reviews_pending_bundles,
          (SELECT count(*) FROM content_reviews WHERE teacher_id = ${teacherId} AND status = 'pending' AND content_type = 'live_test') AS reviews_pending_live_tests,
          (SELECT count(*) FROM teacher_withdrawals WHERE teacher_id = ${teacherId} AND status = 'pending') AS withdrawals_pending,
          (SELECT coalesce(sum(amount), 0) FROM teacher_withdrawals WHERE teacher_id = ${teacherId} AND status = 'pending') AS withdrawals_pending_amount,
          (SELECT count(DISTINCT m.thread_id) FROM support_messages m
             JOIN support_threads t ON t.id = m.thread_id
             WHERE t.teacher_id = ${teacherId} AND m.sender_type = 'admin' AND m.is_read = false) AS support_unread,
          (SELECT count(*) FROM live_tests
             WHERE teacher_id = ${teacherId} AND has_prizes = true AND prize_distribution_status = 'pending' AND end_time < now()) AS prizes_undistributed,
          (SELECT count(*) FROM live_tests
             WHERE teacher_id = ${teacherId} AND is_active = true AND start_time > now() AND start_time <= now() + interval '7 days') AS live_tests_soon,
          (SELECT count(*) FROM teacher_subscriptions
             WHERE teacher_id = ${teacherId} AND status = 'active' AND end_date > now() AND end_date <= now() + interval '7 days') AS subscription_expiring,
          (SELECT verification_status::text FROM teacher_bank_details WHERE teacher_id = ${teacherId} ORDER BY updated_at DESC NULLS LAST LIMIT 1) AS bank_status
      `.execute(db),

      sql<Row>`
        SELECT earnings, gross, sold_at, order_id, buyer_id, kind, title, thumbnail
        FROM ${buildTeacherSaleRowsSql(teacherId, { start: previousStart })} sales
        WHERE sold_at IS NOT NULL
      `.execute(db),

      sql<Row>`
        WITH days AS (
          SELECT generate_series(${previousStartDay}::date, ${todayDay}::date, interval '1 day')::date AS d
        ),
        enrollments AS (
          SELECT mte.enrolled_at AS at
          FROM mock_test_enrollments mte JOIN mock_tests mt ON mt.id = mte.mock_test_id
          WHERE mt.teacher_id = ${teacherId} AND mte.enrolled_at >= ${previousStart}
          UNION ALL
          SELECT ce.enrolled_at
          FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id
          WHERE c.teacher_id = ${teacherId} AND ce.enrolled_at >= ${previousStart}
          UNION ALL
          SELECT lte.enrolled_at
          FROM live_test_enrollments lte JOIN live_tests lt ON lt.id = lte.live_test_id
          WHERE lt.teacher_id = ${teacherId} AND lte.enrolled_at >= ${previousStart}
          UNION ALL
          SELECT (be.enrolled_at AT TIME ZONE 'UTC')
          FROM bundle_enrollments be JOIN course_bundles cb ON cb.id = be.bundle_id
          WHERE cb.teacher_id = ${teacherId} AND (be.enrolled_at AT TIME ZONE 'UTC') >= ${previousStart}
        ),
        e AS (
          SELECT (at AT TIME ZONE ${IST})::date AS d, count(*) AS enrollments FROM enrollments GROUP BY 1
        ),
        a AS (
          SELECT ((ta.completed_at AT TIME ZONE 'UTC') AT TIME ZONE ${IST})::date AS d, count(*) AS attempts
          FROM test_attempts ta
          JOIN mock_test_items mti ON mti.id = ta.test_id
          JOIN mock_tests mt ON mt.id = mti.package_id
          WHERE mt.teacher_id = ${teacherId} AND ta.completed_at >= ${previousStart}
          GROUP BY 1
        )
        SELECT to_char(days.d, 'YYYY-MM-DD') AS day,
               coalesce(e.enrollments, 0) AS enrollments,
               coalesce(a.attempts, 0) AS attempts
        FROM days
        LEFT JOIN e ON e.d = days.d
        LEFT JOIN a ON a.d = days.d
        ORDER BY days.d
      `.execute(db),

      sql<Row>`
        WITH item_orders AS (
          -- Every array_agg here shares the same ORDER BY oi.id, so index [1]
          -- picks the title, kind and thumbnail off the SAME order item.
          SELECT oi.order_id AS id,
                 count(*) AS item_count,
                 sum(oi.price_at_purchase - oi.discount_amount) AS amount,
                 (array_agg(coalesce(mt.title, c.title, dp.title) ORDER BY oi.id))[1]::text AS first_title,
                 (array_agg(
                    CASE WHEN oi.mock_test_id IS NOT NULL THEN 'mock_test'
                         WHEN oi.course_id IS NOT NULL THEN 'course'
                         WHEN oi.digital_product_id IS NOT NULL THEN 'digital_product'
                    END ORDER BY oi.id))[1]::text AS first_kind,
                 (array_agg(
                    coalesce(mt.thumbnail_url, c.thumbnail_image_url, c.thumbnail_url)
                    ORDER BY oi.id))[1]::text AS first_thumbnail
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          LEFT JOIN mock_tests mt ON mt.id = oi.mock_test_id
          LEFT JOIN courses c ON c.id = oi.course_id
          LEFT JOIN digital_products dp ON dp.id = oi.digital_product_id
          WHERE o.bundle_id IS NULL
            AND (mt.teacher_id = ${teacherId} OR c.teacher_id = ${teacherId} OR dp.teacher_id = ${teacherId})
          GROUP BY oi.order_id
        ),
        bundle_orders AS (
          SELECT o.id, 1::bigint AS item_count, o.total_amount::numeric AS amount, cb.title::text AS first_title,
                 'bundle'::text AS first_kind, cb.thumbnail_url::text AS first_thumbnail
          FROM orders o JOIN course_bundles cb ON cb.id = o.bundle_id
          WHERE cb.teacher_id = ${teacherId}
        ),
        mine AS (
          SELECT * FROM item_orders
          UNION ALL
          SELECT * FROM bundle_orders
        )
        SELECT o.id, mine.amount, mine.item_count, mine.first_title, mine.first_kind, mine.first_thumbnail,
               o.status, o.created_at,
               coalesce(u.display_name, u.email, 'Guest') AS student_name
        FROM mine
        JOIN orders o ON o.id = mine.id
        LEFT JOIN users u ON u.id = o.user_id
        -- Same rule as the earnings transactions: only completed orders are sales.
        WHERE o.status = 'completed'
        ORDER BY o.created_at DESC NULLS LAST
        LIMIT 6
      `.execute(db),

      sql<Row>`
        SELECT
          (SELECT count(*) FROM mock_tests mt
             WHERE mt.teacher_id = ${teacherId} AND mt.deleted_at IS NULL AND mt.is_published = true
               AND NOT EXISTS (SELECT 1 FROM live_tests lt WHERE lt.teacher_id = ${teacherId} AND lt.mock_test_id = mt.id)) AS published_tests,
          (SELECT count(*) FROM mock_tests mt
             WHERE mt.teacher_id = ${teacherId} AND mt.deleted_at IS NULL AND mt.is_published = false AND mt.was_ever_published = false
               AND NOT EXISTS (SELECT 1 FROM live_tests lt WHERE lt.teacher_id = ${teacherId} AND lt.mock_test_id = mt.id)) AS draft_tests,
          (SELECT count(*) FROM courses WHERE teacher_id = ${teacherId} AND status = 'published') AS published_courses,
          (SELECT count(*) FROM courses WHERE teacher_id = ${teacherId} AND status = 'draft') AS draft_courses,
          (SELECT count(*) FROM digital_products WHERE teacher_id = ${teacherId} AND status = 'published') AS published_products,
          (SELECT count(*) FROM digital_products WHERE teacher_id = ${teacherId} AND status = 'draft') AS draft_products,
          (SELECT count(*) FROM course_bundles WHERE teacher_id = ${teacherId} AND is_published = true) AS published_bundles,
          (SELECT count(*) FROM course_bundles WHERE teacher_id = ${teacherId} AND is_published = false) AS draft_bundles,
          (SELECT count(*) FROM live_tests WHERE teacher_id = ${teacherId} AND is_active = true AND end_time > now()) AS active_live_tests,
          (SELECT count(DISTINCT student_id) FROM (
             SELECT mte.student_id FROM mock_test_enrollments mte JOIN mock_tests mt ON mt.id = mte.mock_test_id WHERE mt.teacher_id = ${teacherId}
             UNION ALL
             SELECT ce.student_id FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id WHERE c.teacher_id = ${teacherId}
             UNION ALL
             SELECT lte.student_id FROM live_test_enrollments lte JOIN live_tests lt ON lt.id = lte.live_test_id WHERE lt.teacher_id = ${teacherId}
             UNION ALL
             SELECT be.student_id FROM bundle_enrollments be JOIN course_bundles cb ON cb.id = be.bundle_id WHERE cb.teacher_id = ${teacherId}
             UNION ALL
             SELECT o.user_id FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN digital_products dp ON dp.id = oi.digital_product_id
               WHERE o.status = 'completed' AND dp.teacher_id = ${teacherId}
           ) all_students) AS students,
          ${buildTeacherNetEarningsSql(teacherId)} AS lifetime_earnings,
          ${buildTeacherAvailableBalanceSql(teacherId)} AS available_balance
      `.execute(db),
    ]);

    const a = attentionRows.rows[0] ?? {};
    const rawBankStatus = get(a, "bank_status");
    const bankStatus: TeacherBankStatus =
      rawBankStatus === "verified" || rawBankStatus === "pending" || rawBankStatus === "rejected"
        ? rawBankStatus
        : "missing";

    const attention: TeacherAttentionCounts = {
      reviewsPendingTests: num(get(a, "reviews_pending_tests")),
      reviewsPendingCourses: num(get(a, "reviews_pending_courses")),
      reviewsPendingProducts: num(get(a, "reviews_pending_products")),
      reviewsPendingBundles: num(get(a, "reviews_pending_bundles")),
      reviewsPendingLiveTests: num(get(a, "reviews_pending_live_tests")),
      withdrawalsPending: num(get(a, "withdrawals_pending")),
      withdrawalsPendingAmount: num(get(a, "withdrawals_pending_amount")),
      supportUnread: num(get(a, "support_unread")),
      prizesUndistributed: num(get(a, "prizes_undistributed")),
      liveTestsSoon: num(get(a, "live_tests_soon")),
      subscriptionExpiring: num(get(a, "subscription_expiring")),
      bankStatus,
    };

    type Sale = {
      day: string;
      earnings: number;
      gross: number;
      kind: TeacherMixKind;
      title: string;
      thumbnail: string | null;
      buyerId: number | null;
    };

    const sales: Sale[] = saleRows.rows.map((row) => {
      const buyerId = get(row, "buyer_id");
      const thumbnail = get(row, "thumbnail");
      return {
        day: isoDay(date(get(row, "sold_at")).getTime()),
        earnings: num(get(row, "earnings")),
        gross: num(get(row, "gross")),
        kind: asMixKind(get(row, "kind")),
        title: str(get(row, "title"), "Untitled").trim() || "Untitled",
        thumbnail: thumbnail ? str(thumbnail) : null,
        buyerId: buyerId === null || buyerId === undefined ? null : num(buyerId),
      };
    });

    const currentSales = sales.filter((sale) => sale.day >= currentStartDay);
    const previousSales = sales.filter((sale) => sale.day < currentStartDay);

    const sum = (rows: Sale[], pick: (sale: Sale) => number) =>
      rows.reduce((total, sale) => total + pick(sale), 0);
    const uniqueBuyers = (rows: Sale[]) =>
      new Set(rows.filter((sale) => sale.buyerId !== null).map((sale) => sale.buyerId)).size;

    const activity = activityRows.rows.map((row) => ({
      day: str(get(row, "day")),
      enrollments: num(get(row, "enrollments")),
      attempts: num(get(row, "attempts")),
    }));
    const currentActivity = activity.filter((point) => point.day >= currentStartDay);
    const previousActivity = activity.filter((point) => point.day < currentStartDay);

    const kpis: TeacherOverviewKpis = {
      earnings: {
        current: sum(currentSales, (s) => s.earnings),
        previous: sum(previousSales, (s) => s.earnings),
      },
      grossSales: {
        current: sum(currentSales, (s) => s.gross),
        previous: sum(previousSales, (s) => s.gross),
      },
      sales: { current: currentSales.length, previous: previousSales.length },
      buyers: { current: uniqueBuyers(currentSales), previous: uniqueBuyers(previousSales) },
      enrollments: {
        current: currentActivity.reduce((total, point) => total + point.enrollments, 0),
        previous: previousActivity.reduce((total, point) => total + point.enrollments, 0),
      },
      attempts: {
        current: currentActivity.reduce((total, point) => total + point.attempts, 0),
        previous: previousActivity.reduce((total, point) => total + point.attempts, 0),
      },
    };

    const salesByDay = new Map<string, { earnings: number; sales: number }>();
    for (const sale of currentSales) {
      const bucket = salesByDay.get(sale.day) ?? { earnings: 0, sales: 0 };
      bucket.earnings += sale.earnings;
      bucket.sales += 1;
      salesByDay.set(sale.day, bucket);
    }

    const daily: TeacherDailyPoint[] = currentActivity.map((point) => {
      const money = salesByDay.get(point.day);
      return {
        day: point.day,
        earnings: money?.earnings ?? 0,
        sales: money?.sales ?? 0,
        enrollments: point.enrollments,
        attempts: point.attempts,
      };
    });

    const sellerByKey = new Map<string, TeacherTopSeller>();
    for (const sale of currentSales) {
      const key = `${sale.kind}::${sale.title}`;
      const seller: TeacherTopSeller = sellerByKey.get(key) ?? {
        kind: sale.kind,
        title: sale.title,
        thumbnail: sale.thumbnail,
        units: 0,
        earnings: 0,
      };
      seller.earnings += sale.earnings;
      seller.units += 1;
      sellerByKey.set(key, seller);
    }
    const topSellers: TeacherTopSeller[] = [...sellerByKey.values()]
      .sort((x, y) =>
        isManager ? y.units - x.units : y.earnings - x.earnings || y.units - x.units
      )
      .slice(0, 6);

    const recentSales: TeacherRecentSale[] = recentRows.rows.map((row) => {
      const itemCount = num(get(row, "item_count"));
      const firstTitle = get(row, "first_title") ? str(get(row, "first_title")) : null;
      const firstKind = get(row, "first_kind");
      const firstThumbnail = get(row, "first_thumbnail");
      let summary = firstTitle ?? "No items";
      if (itemCount > 1) summary = `${summary} and ${itemCount - 1} more`;
      return {
        orderId: num(get(row, "id")),
        amount: num(get(row, "amount")),
        status: str(get(row, "status"), "pending"),
        createdAt: date(get(row, "created_at")),
        studentName: str(get(row, "student_name"), "Guest"),
        summary,
        itemCount,
        kind: firstKind && MIX_KINDS.has(str(firstKind)) ? (str(firstKind) as TeacherMixKind) : null,
        thumbnail: firstThumbnail ? str(firstThumbnail) : null,
      };
    });

    const t = totalRows.rows[0] ?? {};
    const totals: TeacherOverviewTotals = {
      students: num(get(t, "students")),
      publishedTests: num(get(t, "published_tests")),
      draftTests: num(get(t, "draft_tests")),
      publishedCourses: num(get(t, "published_courses")),
      draftCourses: num(get(t, "draft_courses")),
      publishedProducts: num(get(t, "published_products")),
      draftProducts: num(get(t, "draft_products")),
      publishedBundles: num(get(t, "published_bundles")),
      draftBundles: num(get(t, "draft_bundles")),
      activeLiveTests: num(get(t, "active_live_tests")),
      lifetimeEarnings: num(get(t, "lifetime_earnings")),
      // Same clamp and rounding as getTeacherAvailableBalance, so the figure
      // here and the one on the earnings page never differ by a stray paisa.
      availableBalance: Math.max(0, Math.round(num(get(t, "available_balance")) * 100) / 100),
    };

    const output: OutputType = {
      range,
      days,
      generatedAt: new Date(),
      attention,
      kpis,
      daily,
      topSellers,
      recentSales,
      totals,
    };

    return new Response(superjson.stringify(isManager ? withoutOwnerMoney(output) : output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error building teacher dashboard overview:", error);
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
