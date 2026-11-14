import { sql, RawBuilder } from "kysely";

/**
 * Shared SQL fragments for computing a teacher's net earnings and the other
 * components of their available balance.
 *
 * This is the SINGLE SOURCE OF TRUTH for "how much has a teacher actually
 * earned / had withdrawn / had deducted" — every consumer (the teacher's own
 * earnings page, their available-balance calculation, the teacher dashboard
 * overview, and all the admin dashboards) should call these builders instead
 * of hand-writing the SQL again. Historically each place re-derived this logic
 * independently and drifted out of sync — see the platform-fee bugs fixed
 * across getTeacherAvailableBalance.tsx, admin/earnings/list_GET.ts,
 * admin/finance/summary_GET.ts, and admin/teachers/list_GET.ts. Don't repeat
 * that: add new consumers here, not by copy-pasting a query.
 *
 * Every builder accepts an optional `teacherIdExpr`:
 *   - omitted            -> no teacher filter at all (platform-wide aggregate)
 *   - a plain number      -> filters to one specific teacher (bound as a query param)
 *   - `sql.ref("users.id")` -> correlates against the outer query's current row,
 *                              for use as a per-row scalar subquery inside a
 *                              paginated admin listing (SELECT ... FROM users ...)
 *
 * Each builder returns a parenthesized scalar subquery aliased internally as
 * `total` (and `count` where noted), so it can be used two ways:
 *   1. Standalone: `const r = await buildTeacherNetEarningsSql(teacherId).execute(db); r.rows[0].total`
 *   2. Embedded:   `.select([buildTeacherNetEarningsSql(sql.ref("users.id")).as("totalEarnings")])`
 *
 * IMPORTANT for cost/perf: prefer the correlated-subquery form (`sql.ref("users.id")`)
 * over calling the standalone form in a loop over paginated results. A single
 * query with N correlated subqueries costs one round trip; N separate calls
 * cost N round trips (and N times the Lambda/DB compute).
 */

type TeacherIdExpr = number | RawBuilder<unknown>;

/**
 * Half-open [start, end) window on `orders.created_at`. An omitted `end` means
 * "from start onwards". Omit the window entirely for all-time, which is what
 * every balance/earnings caller does — the SQL is then identical to what it
 * was before windowing existed.
 */
export type TeacherEarningsWindow = { start: Date; end?: Date };

function teacherFilter(column: string, teacherIdExpr?: TeacherIdExpr) {
  if (teacherIdExpr === undefined) {
    return sql``;
  }
  return sql`AND ${sql.raw(column)} = ${teacherIdExpr}`;
}

function windowFilter(column: string, window?: TeacherEarningsWindow) {
  if (window === undefined) {
    return sql``;
  }
  if (window.end === undefined) {
    return sql`AND ${sql.raw(column)} >= ${window.start}`;
  }
  return sql`AND ${sql.raw(column)} >= ${window.start} AND ${sql.raw(column)} < ${window.end}`;
}

/**
 * The part of an order item's promo discount the teacher bears. A Spin & Win coupon from a
 * campaign set to Testkart-funded (spin_campaigns.discount_funding = 'platform_funded') costs
 * the teacher nothing: the sale is settled on the price before that coupon and Testkart's
 * commission absorbs it. When that coupon was stacked on an automatic teacher offer,
 * order_items.auto_discount_amount is the teacher offer's share, which the teacher still bears.
 * The Spin & Win coupon is always the order's promo_code_id when present. Every other discount
 * is shared pro rata through the platform fee.
 * `item` and `order` are the aliases of order_items and orders in the calling query.
 */
export function teacherItemDiscountSql(item: string, order: string) {
  return sql<string>`(CASE WHEN ${sql.ref(`${order}.promo_code_id`)} IS NOT NULL AND EXISTS (
      SELECT 1 FROM spin_coupons fund_sc
      JOIN spin_campaigns fund_c ON fund_c.id = fund_sc.campaign_id
      WHERE fund_sc.promo_code_id = ${sql.ref(`${order}.promo_code_id`)}
        AND fund_c.discount_funding = 'platform_funded'
    ) THEN COALESCE(${sql.ref(`${item}.auto_discount_amount`)}, 0) ELSE COALESCE(${sql.ref(`${item}.discount_amount`)}, 0) END)`;
}

/**
 * The set of individual sale rows (one per order_item / bundle order) that
 * count toward a teacher's earnings, each carrying its own net `earnings`
 * value. Shared by buildTeacherNetEarningsSql (SUM),
 * buildTeacherSalesCountSql (COUNT) and buildTeacherSaleRowsSql (the rows
 * themselves) so they never drift apart on which rows qualify as "a sale".
 *
 * Alongside `earnings` each row carries what a dashboard needs to break the
 * same money down by day, by product kind and by title: `gross` (before the
 * platform fee), `sold_at`, `order_id`, `buyer_id`, `kind`, `title`,
 * `item_id` (the mock test, course, digital product or bundle id; a live-test
 * sale carries its mock test's id), `promo_code_id` (the order's code, if any)
 * and `discount` (the promo discount the teacher bears, already taken off
 * `gross`; zero for a Testkart-funded coupon, see teacherItemDiscountSql)
 * and `teacher_id` (the teacher whose content was sold).
 * Mock-test sales attached to a live test surface as kind 'live_test' — the
 * live-test money arrives through the mock test its enrollment paid for, and
 * only once that test has ended, since unfinished live tests are excluded
 * below.
 */
function earningsRowsFragment(teacherIdExpr?: TeacherIdExpr, window?: TeacherEarningsWindow) {
  return sql`(
    SELECT (oi.price_at_purchase - td.amount) * (1 - oi.platform_fee_percentage / 100) AS earnings,
           (oi.price_at_purchase - td.amount) AS gross,
           o.created_at AS sold_at,
           o.id AS order_id,
           o.user_id AS buyer_id,
           (CASE WHEN EXISTS (
              SELECT 1 FROM live_test_enrollments lte_kind WHERE lte_kind.payment_order_id = o.id
            ) THEN 'live_test' ELSE 'mock_test' END)::text AS kind,
           mt.title::text AS title,
           mt.thumbnail_url::text AS thumbnail,
           mt.id AS item_id,
           o.promo_code_id AS promo_code_id,
           td.amount AS discount,
           mt.teacher_id AS teacher_id
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    CROSS JOIN LATERAL (SELECT ${teacherItemDiscountSql("oi", "o")} AS amount) td
    JOIN mock_tests mt ON oi.mock_test_id = mt.id
    WHERE o.status = 'completed'
      AND o.gateway_env IS DISTINCT FROM 'sandbox'
      ${teacherFilter("mt.teacher_id", teacherIdExpr)}
      ${windowFilter("o.created_at", window)}
      AND (o.payment_method IS NULL OR o.payment_method != 'teacher_sponsored')
      AND o.id NOT IN (
        SELECT tse.order_id FROM teacher_sponsored_enrollments tse WHERE tse.order_id IS NOT NULL
      )
      AND o.id NOT IN (
        SELECT lte.payment_order_id
        FROM live_test_enrollments lte
        JOIN live_tests lt ON lte.live_test_id = lt.id
        WHERE lt.end_time > NOW() AND lte.payment_order_id IS NOT NULL
      )
    UNION ALL
    SELECT (oi.price_at_purchase - td.amount) * (1 - oi.platform_fee_percentage / 100) AS earnings,
           (oi.price_at_purchase - td.amount) AS gross,
           o.created_at AS sold_at,
           o.id AS order_id,
           o.user_id AS buyer_id,
           'course'::text AS kind,
           c.title::text AS title,
           COALESCE(c.thumbnail_image_url, c.thumbnail_url)::text AS thumbnail,
           c.id AS item_id,
           o.promo_code_id AS promo_code_id,
           td.amount AS discount,
           c.teacher_id AS teacher_id
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    CROSS JOIN LATERAL (SELECT ${teacherItemDiscountSql("oi", "o")} AS amount) td
    JOIN courses c ON oi.course_id = c.id
    WHERE o.status = 'completed'
      AND o.gateway_env IS DISTINCT FROM 'sandbox'
      ${teacherFilter("c.teacher_id", teacherIdExpr)}
      ${windowFilter("o.created_at", window)}
      AND (o.payment_method IS NULL OR o.payment_method != 'teacher_sponsored')
      AND o.id NOT IN (
        SELECT tse.order_id FROM teacher_sponsored_enrollments tse WHERE tse.order_id IS NOT NULL
      )
    UNION ALL
    SELECT (oi.price_at_purchase - td.amount) * (1 - oi.platform_fee_percentage / 100) AS earnings,
           (oi.price_at_purchase - td.amount) AS gross,
           o.created_at AS sold_at,
           o.id AS order_id,
           o.user_id AS buyer_id,
           'digital_product'::text AS kind,
           dp.title::text AS title,
           -- Study notes have no thumbnail anywhere on the site by design;
           -- see the NOTE comment in helpers/placeholderImages.
           NULL::text AS thumbnail,
           dp.id AS item_id,
           o.promo_code_id AS promo_code_id,
           td.amount AS discount,
           dp.teacher_id AS teacher_id
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    CROSS JOIN LATERAL (SELECT ${teacherItemDiscountSql("oi", "o")} AS amount) td
    JOIN digital_products dp ON oi.digital_product_id = dp.id
    WHERE o.status = 'completed'
      AND o.gateway_env IS DISTINCT FROM 'sandbox'
      ${teacherFilter("dp.teacher_id", teacherIdExpr)}
      ${windowFilter("o.created_at", window)}
      AND (o.payment_method IS NULL OR o.payment_method != 'teacher_sponsored')
      AND o.id NOT IN (
        SELECT tse.order_id FROM teacher_sponsored_enrollments tse WHERE tse.order_id IS NOT NULL
      )
    UNION ALL
    -- Bundle earnings: use the fee captured at time of sale (orders.platform_fee_percentage)
    -- when available; only fall back to that bundle's teacher's current live fee (account
    -- override, then subscription) for legacy orders that predate that column. Correlates to
    -- cb.teacher_id (the bundle's own teacher) rather than the outer teacherIdExpr, so this
    -- stays correct for the global (unfiltered) case.
    -- Tcoins a student spent are funded by Testkart, so they are added back to the sale value.
    SELECT (o.total_amount::numeric + o.tcoins_redeemed) * (1 - COALESCE(
      o.platform_fee_percentage,
      (SELECT fee_user.platform_fee_override FROM users fee_user WHERE fee_user.id = cb.teacher_id),
      (SELECT COALESCE(ts.platform_fee_override, sp.platform_fee_percentage)
       FROM teacher_subscriptions ts
       JOIN subscription_plans sp ON ts.plan_id = sp.id
       WHERE ts.teacher_id = cb.teacher_id
         AND ts.status = 'active'
         AND ts.end_date > NOW()
       ORDER BY ts.created_at DESC
       LIMIT 1
      ), 28) / 100) AS earnings,
      (o.total_amount::numeric + o.tcoins_redeemed) AS gross,
      o.created_at AS sold_at,
      o.id AS order_id,
      o.user_id AS buyer_id,
      'bundle'::text AS kind,
      cb.title::text AS title,
      cb.thumbnail_url::text AS thumbnail,
      cb.id AS item_id,
      o.promo_code_id AS promo_code_id,
      COALESCE(o.discount_amount, 0)::numeric AS discount,
      cb.teacher_id AS teacher_id
    FROM orders o
    JOIN course_bundles cb ON o.bundle_id = cb.id
    WHERE o.status = 'completed'
      AND o.gateway_env IS DISTINCT FROM 'sandbox'
      AND o.bundle_id IS NOT NULL
      ${teacherFilter("cb.teacher_id", teacherIdExpr)}
      ${windowFilter("o.created_at", window)}
      AND (o.payment_method IS NULL OR o.payment_method != 'teacher_sponsored')
      AND o.id NOT IN (
        SELECT tse.order_id FROM teacher_sponsored_enrollments tse WHERE tse.order_id IS NOT NULL
      )
  )`;
}

/**
 * Live teaching sales: paid 1:1 classes (kind 'live_session'), paid group
 * class seats (kind 'group_class') and held live course classes (kind
 * 'live_course'). Same columns as earningsRowsFragment plus
 * `fee_percentage`, the platform fee stored at purchase.
 *
 * A row counts only once the session has been held, the way live-test money
 * waits for the test to end:
 *   - 1:1 trials and package classes (live_class_credits, one row per class):
 *     the credit is spent and its booking earned (held, or a student late
 *     cancel or no-show), 24 hours have passed since it ended (the student's
 *     window to report the teacher did not come) and no report is open. The
 *     fee is the one stored on the credit; sold_at is the class time;
 *   - 1:1 sessions bought before credits existed: the order still has a
 *     booking that is not cancelled and not a teacher no-show (a reschedule
 *     cancels the old row and adds a new one under the same order, so the
 *     newest live booking is used) and its end time has passed;
 *   - group class: the class was not cancelled, its end time has passed and
 *     the buyer still holds the seat (not left, not removed);
 *   - live course (kind 'live_course', one row per student per held class):
 *     each of the first min classes held (live_courses.min_classes, less the
 *     classes already refunded to that student as a shortfall) earns the
 *     student's price / min classes, less the fee stored on the order item.
 *     Late joiners count for every class already held; extra classes earn
 *     nothing. sold_at is the class start.
 * Bookings made before order_items.mentorship_teacher_id existed are not
 * counted. A refund moves the order off 'completed', so it drops out here; a
 * credit with an order counts only while that order is completed, and a live
 * course enrolment only while it is still enrolled.
 *
 * Every branch here and in earningsRowsFragment skips Cashfree sandbox orders
 * (orders.gateway_env = 'sandbox'): test money is never earnings.
 *
 * Kept out of earningsRowsFragment on purpose: the analytics breakdowns built
 * on buildTeacherSaleRowsSql group by product kind and have no bucket for
 * these two kinds yet.
 */
function liveSessionRowsFragment(teacherIdExpr?: TeacherIdExpr, window?: TeacherEarningsWindow) {
  return sql`(
    SELECT (oi.price_at_purchase - td.amount) * (1 - oi.platform_fee_percentage / 100) AS earnings,
           (oi.price_at_purchase - td.amount) AS gross,
           o.created_at AS sold_at,
           o.id AS order_id,
           o.user_id AS buyer_id,
           'live_session'::text AS kind,
           ('1:1 session (' || mb.duration_minutes || ' min)')::text AS title,
           NULL::text AS thumbnail,
           mb.id AS item_id,
           o.promo_code_id AS promo_code_id,
           td.amount AS discount,
           oi.mentorship_teacher_id AS teacher_id,
           oi.platform_fee_percentage AS fee_percentage
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    CROSS JOIN LATERAL (SELECT ${teacherItemDiscountSql("oi", "o")} AS amount) td
    JOIN LATERAL (
      SELECT b.id, b.duration_minutes
      FROM mentorship_bookings b
      WHERE b.order_id = o.id
        AND b.teacher_id = oi.mentorship_teacher_id
        AND b.status IS DISTINCT FROM 'cancelled'
        AND NOT (b.status IS NOT DISTINCT FROM 'no_show' AND b.no_show_party IS NOT DISTINCT FROM 'teacher')
        AND (b.scheduled_at AT TIME ZONE 'UTC') + make_interval(mins => b.duration_minutes) <= NOW()
      ORDER BY b.id DESC
      LIMIT 1
    ) mb ON TRUE
    WHERE o.status = 'completed'
      AND o.gateway_env IS DISTINCT FROM 'sandbox'
      AND oi.mentorship_teacher_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM live_class_credits lcc_old WHERE lcc_old.order_id = o.id)
      ${teacherFilter("oi.mentorship_teacher_id", teacherIdExpr)}
      ${windowFilter("o.created_at", window)}
    UNION ALL
    SELECT lcc.amount * (1 - lcc.platform_fee_percentage / 100) AS earnings,
           lcc.amount AS gross,
           (b.scheduled_at AT TIME ZONE 'UTC') AS sold_at,
           lcc.order_id AS order_id,
           lcc.student_id AS buyer_id,
           'live_session'::text AS kind,
           ((CASE WHEN lcc.kind = 'trial' THEN 'Trial 1:1 class (' ELSE '1:1 class (' END) || lcc.class_minutes || ' min)')::text AS title,
           NULL::text AS thumbnail,
           b.id AS item_id,
           NULL::integer AS promo_code_id,
           0::numeric AS discount,
           lcc.teacher_id AS teacher_id,
           lcc.platform_fee_percentage AS fee_percentage
    FROM live_class_credits lcc
    JOIN mentorship_bookings b ON b.id = lcc.booking_id
    LEFT JOIN orders lcc_o ON lcc_o.id = lcc.order_id
    WHERE lcc.status = 'spent'
      AND (lcc.order_id IS NULL OR (lcc_o.status = 'completed' AND lcc_o.gateway_env IS DISTINCT FROM 'sandbox'))
      AND b.earning_status = 'earned'
      AND (b.scheduled_at AT TIME ZONE 'UTC') + make_interval(mins => b.duration_minutes) + interval '24 hours' <= NOW()
      AND (b.issue_reported_at IS NULL OR b.issue_resolution = 'rejected')
      ${teacherFilter("lcc.teacher_id", teacherIdExpr)}
      ${windowFilter("(b.scheduled_at AT TIME ZONE 'UTC')", window)}
    UNION ALL
    SELECT (oi.price_at_purchase - td.amount) * (1 - oi.platform_fee_percentage / 100) AS earnings,
           (oi.price_at_purchase - td.amount) AS gross,
           o.created_at AS sold_at,
           o.id AS order_id,
           o.user_id AS buyer_id,
           'group_class'::text AS kind,
           gl.title::text AS title,
           gl.cover_image_url::text AS thumbnail,
           gl.id AS item_id,
           o.promo_code_id AS promo_code_id,
           td.amount AS discount,
           gl.teacher_id AS teacher_id,
           oi.platform_fee_percentage AS fee_percentage
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    CROSS JOIN LATERAL (SELECT ${teacherItemDiscountSql("oi", "o")} AS amount) td
    JOIN group_lessons gl ON oi.group_lesson_id = gl.id
    WHERE o.status = 'completed'
      AND o.gateway_env IS DISTINCT FROM 'sandbox'
      AND gl.status != 'cancelled'
      AND gl.start_time + make_interval(mins => gl.duration_minutes) <= NOW()
      AND EXISTS (
        SELECT 1 FROM group_lesson_enrollments gle
        WHERE gle.order_id = o.id AND gle.group_lesson_id = gl.id AND gle.status = 'enrolled'
      )
      ${teacherFilter("gl.teacher_id", teacherIdExpr)}
      ${windowFilter("o.created_at", window)}
    UNION ALL
    SELECT (lce.amount_paid / lc.min_classes) * (1 - oi.platform_fee_percentage / 100) AS earnings,
           (lce.amount_paid / lc.min_classes) AS gross,
           held.start_time AS sold_at,
           o.id AS order_id,
           lce.student_id AS buyer_id,
           'live_course'::text AS kind,
           (lc.title || ' - class ' || held.class_no)::text AS title,
           lc.thumbnail_url::text AS thumbnail,
           held.id AS item_id,
           NULL::integer AS promo_code_id,
           0::numeric AS discount,
           lc.teacher_id AS teacher_id,
           oi.platform_fee_percentage AS fee_percentage
    FROM live_course_enrollments lce
    JOIN live_courses lc ON lc.id = lce.live_course_id
    JOIN orders o ON o.id = lce.order_id
    JOIN order_items oi ON oi.order_id = o.id AND oi.live_course_id = lc.id
    JOIN LATERAL (
      SELECT ranked.id, ranked.start_time, ranked.class_no
      FROM (
        SELECT g.id, g.start_time, ROW_NUMBER() OVER (ORDER BY g.start_time, g.id) AS class_no
        FROM group_lessons g
        WHERE g.live_course_id = lc.id AND g.status = 'completed'
      ) ranked
      WHERE ranked.class_no <= lc.min_classes - lce.shortfall_refunded_classes
    ) held ON TRUE
    WHERE lce.status = 'enrolled'
      AND lc.min_classes IS NOT NULL
      AND o.status = 'completed'
      AND o.gateway_env IS DISTINCT FROM 'sandbox'
      ${teacherFilter("lc.teacher_id", teacherIdExpr)}
      ${windowFilter("held.start_time", window)}
  )`;
}

/** Every row that earns a teacher money: product sales plus held live sessions. */
function allEarningsFragment(teacherIdExpr?: TeacherIdExpr, window?: TeacherEarningsWindow) {
  return sql`(
    SELECT product_rows.earnings FROM ${earningsRowsFragment(teacherIdExpr, window)} product_rows
    UNION ALL
    SELECT live_rows.earnings FROM ${liveSessionRowsFragment(teacherIdExpr, window)} live_rows
  )`;
}

/**
 * Net earnings across ALL sale types (mock tests, courses, digital products,
 * bundles, and held 1:1 sessions, group classes and live course classes), net of the platform fee captured at time of sale
 * (falling back to the teacher's current live fee only for legacy bundle
 * orders that predate the stored-fee column). Excludes teacher-sponsored
 * orders (those are accounted for separately via
 * buildTeacherSponsoredDeductionsSql) and mock test orders tied to a live
 * test that hasn't ended yet (that revenue isn't finalized).
 */
export function buildTeacherNetEarningsSql(teacherIdExpr?: TeacherIdExpr, window?: TeacherEarningsWindow) {
  return sql<{ total: string }>`(
    SELECT COALESCE(SUM(earnings), 0) AS total FROM ${allEarningsFragment(teacherIdExpr, window)} all_earnings
  )`;
}

/** Count of individual sale rows feeding buildTeacherNetEarningsSql — kept in sync by construction. */
export function buildTeacherSalesCountSql(teacherIdExpr?: TeacherIdExpr, window?: TeacherEarningsWindow) {
  return sql<{ total: string }>`(
    SELECT COUNT(*) AS total FROM ${allEarningsFragment(teacherIdExpr, window)} all_earnings
  )`;
}

/**
 * The product sale rows themselves rather than an aggregate — for callers that need to
 * slice the same money several ways (per day, per product kind, per title)
 * from one read. Live teaching rows are not in it; see buildTeacherLiveSessionRowsSql.
 * Select from it as a derived table:
 *   sql`SELECT * FROM ${buildTeacherSaleRowsSql(id, { start })} sales`
 */
export function buildTeacherSaleRowsSql(teacherIdExpr?: TeacherIdExpr, window?: TeacherEarningsWindow) {
  return earningsRowsFragment(teacherIdExpr, window);
}

/** The held 1:1 session and group class rows that count toward earnings, as a derived table. */
export function buildTeacherLiveSessionRowsSql(teacherIdExpr?: TeacherIdExpr, window?: TeacherEarningsWindow) {
  return liveSessionRowsFragment(teacherIdExpr, window);
}

/**
 * Teachers ranked by the sale value of their content in a window: the same
 * qualifying rows as their earnings, summed on `gross` (what students paid,
 * before the platform fee) so a teacher's subscription tier does not move
 * their rank. Ties fall to sale count, then teacher id, so the order is
 * stable between requests. Rows: teacherId, salesTotal, salesCount.
 */
export function buildTopSellingTeachersSql(window: TeacherEarningsWindow, limit: number) {
  return sql<{ teacherId: number; salesTotal: string; salesCount: string }>`
    SELECT sales.teacher_id AS "teacherId",
           SUM(sales.gross) AS "salesTotal",
           COUNT(*) AS "salesCount"
    FROM ${earningsRowsFragment(undefined, window)} sales
    GROUP BY sales.teacher_id
    HAVING SUM(sales.gross) > 0
    ORDER BY SUM(sales.gross) DESC, COUNT(*) DESC, sales.teacher_id ASC
    LIMIT ${limit}
  `;
}

/** Total completed (or pending, if specified) withdrawals paid out. */
export function buildTeacherWithdrawalsSql(
  teacherIdExpr?: TeacherIdExpr,
  status: "completed" | "pending" = "completed"
) {
  return sql<{ total: string }>`(
    SELECT COALESCE(SUM(tw.amount), 0) AS total
    FROM teacher_withdrawals tw
    WHERE tw.status = ${status}
      ${teacherFilter("tw.teacher_id", teacherIdExpr)}
  )`;
}

/** Total sponsored-enrollment commission deducted directly from the teacher's wallet balance. */
export function buildTeacherSponsoredDeductionsSql(teacherIdExpr?: TeacherIdExpr) {
  return sql<{ total: string }>`(
    SELECT COALESCE(SUM(tse.commission_amount), 0) AS total
    FROM teacher_sponsored_enrollments tse
    WHERE tse.payment_method = 'balance_deduction'
      ${teacherFilter("tse.teacher_id", teacherIdExpr)}
  )`;
}

/**
 * Total prize-pool deductions:
 *   - prize payouts already distributed,
 *   - pools locked (pending distribution) for free live tests funded from the
 *     teacher's own wallet,
 *   - for paid live tests that have ended but not paid out yet, the part of
 *     the enrollment revenue the prizes will consume: LEAST(pool, net revenue).
 *     That revenue joins earnings once the test ends, so without this hold it
 *     would be withdrawable before the winners are paid.
 */
export function buildTeacherPrizeDeductionsSql(teacherIdExpr?: TeacherIdExpr) {
  return sql<{ total: string }>`(
    SELECT (
      COALESCE((
        SELECT SUM(lt.actual_total_distributed)
        FROM live_tests lt
        WHERE lt.prize_distribution_status = 'distributed'
          ${teacherFilter("lt.teacher_id", teacherIdExpr)}
      ), 0)
      +
      COALESCE((
        SELECT SUM(lt.total_prize_pool)
        FROM live_tests lt
        WHERE lt.prize_fund_source = 'teacher_wallet'
          AND lt.prize_distribution_status = 'pending'
          ${teacherFilter("lt.teacher_id", teacherIdExpr)}
      ), 0)
      +
      COALESCE((
        SELECT SUM(LEAST(lt.total_prize_pool, COALESCE((
          SELECT SUM((oi.price_at_purchase - ${teacherItemDiscountSql("oi", "o")}) * (1 - oi.platform_fee_percentage / 100))
          FROM live_test_enrollments lte
          JOIN orders o ON o.id = lte.payment_order_id
          JOIN order_items oi ON oi.order_id = o.id
          WHERE lte.live_test_id = lt.id
            AND o.status = 'completed'
            AND o.gateway_env IS DISTINCT FROM 'sandbox'
            AND oi.mock_test_id IS NOT NULL
            AND (o.payment_method IS NULL OR o.payment_method != 'teacher_sponsored')
        ), 0)))
        FROM live_tests lt
        WHERE lt.prize_fund_source = 'enrollment'
          AND lt.prize_distribution_status = 'pending'
          AND lt.end_time <= NOW()
          ${teacherFilter("lt.teacher_id", teacherIdExpr)}
      ), 0)
    ) AS total
  )`;
}

/** Total subscription renewal payments made from the teacher's wallet balance. */
export function buildTeacherSubscriptionWalletPaymentsSql(teacherIdExpr?: TeacherIdExpr) {
  return sql<{ total: string }>`(
    SELECT COALESCE(SUM(st.amount), 0) AS total
    FROM subscription_transactions st
    WHERE st.payment_method = 'wallet' AND st.status = 'completed'
      ${teacherFilter("st.teacher_id", teacherIdExpr)}
  )`;
}

/**
 * Campaign bonuses an admin credited (helpers/teacherCampaign). Reversing a bonus
 * moves its status off 'credited', so it drops out of the balance here.
 */
export function buildTeacherCampaignCreditsSql(teacherIdExpr?: TeacherIdExpr) {
  return sql<{ total: string }>`(
    SELECT COALESCE(SUM(tcc.amount), 0) AS total
    FROM teacher_campaign_claims tcc
    WHERE tcc.status = 'credited'
      ${teacherFilter("tcc.teacher_id", teacherIdExpr)}
  )`;
}

/**
 * The full available-balance formula, composed from the builders above:
 * netEarnings + campaignCredits - completed withdrawals - pending withdrawals
 *   - sponsoredDeductions - prizeDeductions - subscriptionWalletPayments
 */
export function buildTeacherAvailableBalanceSql(teacherIdExpr?: TeacherIdExpr) {
  return sql<{ total: string }>`(
    ${buildTeacherNetEarningsSql(teacherIdExpr)}
    + ${buildTeacherCampaignCreditsSql(teacherIdExpr)}
    - ${buildTeacherWithdrawalsSql(teacherIdExpr, "completed")}
    - ${buildTeacherWithdrawalsSql(teacherIdExpr, "pending")}
    - ${buildTeacherSponsoredDeductionsSql(teacherIdExpr)}
    - ${buildTeacherPrizeDeductionsSql(teacherIdExpr)}
    - ${buildTeacherSubscriptionWalletPaymentsSql(teacherIdExpr)}
  )`;
}
