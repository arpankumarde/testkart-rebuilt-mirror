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
 * The set of individual sale rows (one per order_item / bundle order) that
 * count toward a teacher's earnings, each carrying its own net `earnings`
 * value. Shared by buildTeacherNetEarningsSql (SUM),
 * buildTeacherSalesCountSql (COUNT) and buildTeacherSaleRowsSql (the rows
 * themselves) so they never drift apart on which rows qualify as "a sale".
 *
 * Alongside `earnings` each row carries what a dashboard needs to break the
 * same money down by day, by product kind and by title: `gross` (before the
 * platform fee), `sold_at`, `order_id`, `buyer_id`, `kind` and `title`.
 * Mock-test sales attached to a live test surface as kind 'live_test' — the
 * live-test money arrives through the mock test its enrollment paid for, and
 * only once that test has ended, since unfinished live tests are excluded
 * below.
 */
function earningsRowsFragment(teacherIdExpr?: TeacherIdExpr, window?: TeacherEarningsWindow) {
  return sql`(
    SELECT (oi.price_at_purchase - oi.discount_amount) * (1 - oi.platform_fee_percentage / 100) AS earnings,
           (oi.price_at_purchase - oi.discount_amount) AS gross,
           o.created_at AS sold_at,
           o.id AS order_id,
           o.user_id AS buyer_id,
           (CASE WHEN EXISTS (
              SELECT 1 FROM live_test_enrollments lte_kind WHERE lte_kind.payment_order_id = o.id
            ) THEN 'live_test' ELSE 'mock_test' END)::text AS kind,
           mt.title::text AS title,
           mt.thumbnail_url::text AS thumbnail
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN mock_tests mt ON oi.mock_test_id = mt.id
    WHERE o.status = 'completed'
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
    SELECT (oi.price_at_purchase - oi.discount_amount) * (1 - oi.platform_fee_percentage / 100) AS earnings,
           (oi.price_at_purchase - oi.discount_amount) AS gross,
           o.created_at AS sold_at,
           o.id AS order_id,
           o.user_id AS buyer_id,
           'course'::text AS kind,
           c.title::text AS title,
           COALESCE(c.thumbnail_image_url, c.thumbnail_url)::text AS thumbnail
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN courses c ON oi.course_id = c.id
    WHERE o.status = 'completed'
      ${teacherFilter("c.teacher_id", teacherIdExpr)}
      ${windowFilter("o.created_at", window)}
      AND (o.payment_method IS NULL OR o.payment_method != 'teacher_sponsored')
      AND o.id NOT IN (
        SELECT tse.order_id FROM teacher_sponsored_enrollments tse WHERE tse.order_id IS NOT NULL
      )
    UNION ALL
    SELECT (oi.price_at_purchase - oi.discount_amount) * (1 - oi.platform_fee_percentage / 100) AS earnings,
           (oi.price_at_purchase - oi.discount_amount) AS gross,
           o.created_at AS sold_at,
           o.id AS order_id,
           o.user_id AS buyer_id,
           'digital_product'::text AS kind,
           dp.title::text AS title,
           -- Study notes have no thumbnail anywhere on the site by design;
           -- see the NOTE comment in helpers/placeholderImages.
           NULL::text AS thumbnail
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN digital_products dp ON oi.digital_product_id = dp.id
    WHERE o.status = 'completed'
      ${teacherFilter("dp.teacher_id", teacherIdExpr)}
      ${windowFilter("o.created_at", window)}
      AND (o.payment_method IS NULL OR o.payment_method != 'teacher_sponsored')
      AND o.id NOT IN (
        SELECT tse.order_id FROM teacher_sponsored_enrollments tse WHERE tse.order_id IS NOT NULL
      )
    UNION ALL
    -- Bundle earnings: use the fee captured at time of sale (orders.platform_fee_percentage)
    -- when available; only fall back to that bundle's teacher's current live fee for legacy
    -- orders that predate that column. Correlates to cb.teacher_id (the bundle's own teacher)
    -- rather than the outer teacherIdExpr, so this stays correct for the global (unfiltered) case.
    SELECT o.total_amount::numeric * (1 - COALESCE(
      o.platform_fee_percentage,
      (SELECT COALESCE(ts.platform_fee_override, sp.platform_fee_percentage)
       FROM teacher_subscriptions ts
       JOIN subscription_plans sp ON ts.plan_id = sp.id
       WHERE ts.teacher_id = cb.teacher_id
         AND ts.status = 'active'
         AND ts.end_date > NOW()
       ORDER BY ts.created_at DESC
       LIMIT 1
      ), 30) / 100) AS earnings,
      o.total_amount::numeric AS gross,
      o.created_at AS sold_at,
      o.id AS order_id,
      o.user_id AS buyer_id,
      'bundle'::text AS kind,
      cb.title::text AS title,
      cb.thumbnail_url::text AS thumbnail
    FROM orders o
    JOIN course_bundles cb ON o.bundle_id = cb.id
    WHERE o.status = 'completed'
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
 * Net earnings across ALL product types (mock tests, courses, digital
 * products, bundles), net of the platform fee captured at time of sale
 * (falling back to the teacher's current live fee only for legacy bundle
 * orders that predate the stored-fee column). Excludes teacher-sponsored
 * orders (those are accounted for separately via
 * buildTeacherSponsoredDeductionsSql) and mock test orders tied to a live
 * test that hasn't ended yet (that revenue isn't finalized).
 */
export function buildTeacherNetEarningsSql(teacherIdExpr?: TeacherIdExpr, window?: TeacherEarningsWindow) {
  return sql<{ total: string }>`(
    SELECT COALESCE(SUM(earnings), 0) AS total FROM ${earningsRowsFragment(teacherIdExpr, window)} all_earnings
  )`;
}

/** Count of individual sale rows feeding buildTeacherNetEarningsSql — kept in sync by construction. */
export function buildTeacherSalesCountSql(teacherIdExpr?: TeacherIdExpr, window?: TeacherEarningsWindow) {
  return sql<{ total: string }>`(
    SELECT COUNT(*) AS total FROM ${earningsRowsFragment(teacherIdExpr, window)} all_earnings
  )`;
}

/**
 * The sale rows themselves rather than an aggregate — for callers that need to
 * slice the same money several ways (per day, per product kind, per title)
 * from one read. Select from it as a derived table:
 *   sql`SELECT * FROM ${buildTeacherSaleRowsSql(id, { start })} sales`
 */
export function buildTeacherSaleRowsSql(teacherIdExpr?: TeacherIdExpr, window?: TeacherEarningsWindow) {
  return earningsRowsFragment(teacherIdExpr, window);
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
          SELECT SUM((oi.price_at_purchase - oi.discount_amount) * (1 - oi.platform_fee_percentage / 100))
          FROM live_test_enrollments lte
          JOIN orders o ON o.id = lte.payment_order_id
          JOIN order_items oi ON oi.order_id = o.id
          WHERE lte.live_test_id = lt.id
            AND o.status = 'completed'
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
 * The full available-balance formula, composed from the builders above:
 * netEarnings - completed withdrawals - pending withdrawals - sponsoredDeductions
 *   - prizeDeductions - subscriptionWalletPayments
 */
export function buildTeacherAvailableBalanceSql(teacherIdExpr?: TeacherIdExpr) {
  return sql<{ total: string }>`(
    ${buildTeacherNetEarningsSql(teacherIdExpr)}
    - ${buildTeacherWithdrawalsSql(teacherIdExpr, "completed")}
    - ${buildTeacherWithdrawalsSql(teacherIdExpr, "pending")}
    - ${buildTeacherSponsoredDeductionsSql(teacherIdExpr)}
    - ${buildTeacherPrizeDeductionsSql(teacherIdExpr)}
    - ${buildTeacherSubscriptionWalletPaymentsSql(teacherIdExpr)}
  )`;
}
