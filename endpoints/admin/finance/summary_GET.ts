import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType, schema } from "./summary_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";
import {
  buildTeacherNetEarningsSql,
  buildTeacherWithdrawalsSql,
  buildTeacherSponsoredDeductionsSql,
  buildTeacherPrizeDeductionsSql,
  buildTeacherSubscriptionWalletPaymentsSql,
} from "../../../helpers/teacherEarningsSql";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Parse and validate input
    const input = schema.parse(queryParams);

    // Determine date range
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    const now = new Date();

    switch (input.period) {
      case "today":
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case "yesterday":
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        break;
      case "this_week":
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case "last_week":
        startDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        endDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        break;
      case "this_month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "last_month":
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case "this_quarter":
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case "last_quarter":
        startDate = startOfQuarter(subQuarters(now, 1));
        endDate = endOfQuarter(subQuarters(now, 1));
        break;
      case "this_year":
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case "last_year":
        startDate = startOfYear(subYears(now, 1));
        endDate = endOfYear(subYears(now, 1));
        break;
      case "custom":
        if (input.startDate) startDate = startOfDay(new Date(input.startDate));
        if (input.endDate) endDate = endOfDay(new Date(input.endDate));
        break;
      case "all":
      default:
        // No date filtering
        break;
    }

    // --- Queries ---

    // 1. Revenue (Flow metric: filtered by date)
    // Excludes sponsored orders (teacher_sponsored payment method and orders linked to teacherSponsoredEnrollments)
    let revenueQuery = db
      .selectFrom("orders")
      .select(db.fn.sum<string>("totalAmount").as("total"))
      .where("status", "=", "completed")
      .where("paymentMethod", "!=", "teacher_sponsored")
      .where("id", "not in", (eb) =>
        eb
          .selectFrom("teacherSponsoredEnrollments")
          .select("teacherSponsoredEnrollments.orderId")
          .where("teacherSponsoredEnrollments.orderId", "is not", null)
      );

    if (startDate) revenueQuery = revenueQuery.where("createdAt", ">=", startDate);
    if (endDate) revenueQuery = revenueQuery.where("createdAt", "<=", endDate);

    // 2. Platform Fee & Teacher Earnings (Flow metrics: filtered by date)
    // Excludes sponsored orders
    let itemsQuery = db
      .selectFrom("orderItems")
      .innerJoin("orders", "orderItems.orderId", "orders.id")
      .select([
        sql<string>`SUM((order_items.price_at_purchase - order_items.discount_amount) * (order_items.platform_fee_percentage / 100))`.as(
          "totalPlatformFee"
        ),
        sql<string>`SUM((order_items.price_at_purchase - order_items.discount_amount) * (1 - order_items.platform_fee_percentage / 100))`.as(
          "totalTeacherEarnings"
        ),
      ])
      .where("orders.status", "=", "completed")
      .where("orders.paymentMethod", "!=", "teacher_sponsored")
      .where("orders.id", "not in", (eb) =>
        eb
          .selectFrom("teacherSponsoredEnrollments")
          .select("teacherSponsoredEnrollments.orderId")
          .where("teacherSponsoredEnrollments.orderId", "is not", null)
      );

    if (startDate) itemsQuery = itemsQuery.where("orders.createdAt", ">=", startDate);
    if (endDate) itemsQuery = itemsQuery.where("orders.createdAt", "<=", endDate);

    // 3. Disbursed (Flow metric: filtered by date)
    let disbursedQuery = db
      .selectFrom("teacherWithdrawals")
      .select(db.fn.sum<string>("amount").as("total"))
      .where("status", "=", "completed");

    if (startDate) disbursedQuery = disbursedQuery.where("processedDate", ">=", startDate);
    if (endDate) disbursedQuery = disbursedQuery.where("processedDate", "<=", endDate);

    // 4. Teacher Wallet Balance (Stock metric: ALWAYS All-Time)
    // Built from the single shared formula in helpers/teacherEarningsSql.tsx, called here
    // with no teacher filter for a platform-wide total:
    // availableBalance = totalEarned - totalWithdrawn - totalSponsored - totalPrizeDeductions - totalSubscriptionWalletPayments
    // (This used to be a hand-copied version of the formula that only summed mock tests,
    // never subtracted subscription wallet payments, and didn't exclude teacher-sponsored
    // orders from earnings — all three silently overstated the platform-wide wallet balance.)
    const allTimeEarningsQuery = buildTeacherNetEarningsSql();
    const allTimeWithdrawalsQuery = buildTeacherWithdrawalsSql(undefined, "completed");
    const allTimeSponsoredQuery = buildTeacherSponsoredDeductionsSql();
    const allTimePrizeDeductionsQuery = buildTeacherPrizeDeductionsSql();
    const allTimeSubscriptionWalletPaymentsQuery = buildTeacherSubscriptionWalletPaymentsSql();

    // 5. Pending Withdrawals (Stock metric: ALWAYS All-Time)
    const pendingWithdrawalsQuery = db
      .selectFrom("teacherWithdrawals")
      .select(db.fn.sum<string>("amount").as("total"))
      .where("status", "=", "pending");

    // 6. Subscription Revenue (Flow metric: filtered by date)
    let subscriptionRevenueQuery = db
      .selectFrom("subscriptionTransactions")
      .select(db.fn.sum<string>("amount").as("total"))
      .where("status", "=", "completed");

    if (startDate) subscriptionRevenueQuery = subscriptionRevenueQuery.where("transactionDate", ">=", startDate);
    if (endDate) subscriptionRevenueQuery = subscriptionRevenueQuery.where("transactionDate", "<=", endDate);

    // 7. Active Paid Subscriptions Count (Stock metric: ALWAYS All-Time)
    const activePaidSubscriptionsQuery = db
      .selectFrom("teacherSubscriptions")
      .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
      .select(db.fn.countAll<string>().as("count"))
      .where("teacherSubscriptions.status", "=", "active")
      .where("subscriptionPlans.price", ">", "0");

    // 8. Total Active Subscriptions Count (Stock metric: ALWAYS All-Time)
    const totalActiveSubscriptionsQuery = db
      .selectFrom("teacherSubscriptions")
      .select(db.fn.countAll<string>().as("count"))
      .where("status", "=", "active");

    // 9. Completed Subscription Transactions Count (Flow metric: filtered by date)
    let subscriptionTransactionsCountQuery = db
      .selectFrom("subscriptionTransactions")
      .select(db.fn.countAll<string>().as("count"))
      .where("status", "=", "completed");

    if (startDate) subscriptionTransactionsCountQuery = subscriptionTransactionsCountQuery.where("transactionDate", ">=", startDate);
    if (endDate) subscriptionTransactionsCountQuery = subscriptionTransactionsCountQuery.where("transactionDate", "<=", endDate);

    // 10. Failed Subscription Transactions Count (Flow metric: filtered by date)
    let failedSubscriptionTransactionsCountQuery = db
      .selectFrom("subscriptionTransactions")
      .select(db.fn.countAll<string>().as("count"))
      .where("status", "=", "failed");

    if (startDate) failedSubscriptionTransactionsCountQuery = failedSubscriptionTransactionsCountQuery.where("transactionDate", ">=", startDate);
    if (endDate) failedSubscriptionTransactionsCountQuery = failedSubscriptionTransactionsCountQuery.where("transactionDate", "<=", endDate);

    // 11. Revenue breakdown by product type (Flow metric: filtered by date)
    // Uses LEFT JOIN to live_test_enrollments to distinguish regular vs live test mock test revenue
    // Excludes sponsored orders
    let revenueByTypeQuery = db
      .selectFrom("orderItems as oi")
      .innerJoin("orders as o", "o.id", "oi.orderId")
      .leftJoin("liveTestEnrollments as lte", "lte.paymentOrderId", "o.id")
      .select([
        sql<string>`SUM(CASE WHEN oi.mock_test_id IS NOT NULL AND lte.id IS NULL THEN oi.price_at_purchase * oi.quantity ELSE 0 END)`.as(
          "regularMockTestRevenue"
        ),
        sql<string>`SUM(CASE WHEN oi.mock_test_id IS NOT NULL AND lte.id IS NOT NULL THEN oi.price_at_purchase * oi.quantity ELSE 0 END)`.as(
          "liveTestRevenue"
        ),
        sql<string>`SUM(CASE WHEN oi.course_id IS NOT NULL THEN oi.price_at_purchase * oi.quantity ELSE 0 END)`.as(
          "courseRevenue"
        ),
        sql<string>`SUM(CASE WHEN oi.digital_product_id IS NOT NULL THEN oi.price_at_purchase * oi.quantity ELSE 0 END)`.as(
          "digitalProductRevenue"
        ),
        sql<string>`SUM(CASE WHEN oi.mock_test_id IS NULL AND oi.course_id IS NULL AND oi.digital_product_id IS NULL AND lte.id IS NULL THEN oi.price_at_purchase * oi.quantity ELSE 0 END)`.as(
          "otherRevenue"
        ),
      ])
      .where("o.status", "=", "completed")
      .where("o.paymentMethod", "!=", "teacher_sponsored")
      .where("o.id", "not in", (eb) =>
        eb
          .selectFrom("teacherSponsoredEnrollments")
          .select("teacherSponsoredEnrollments.orderId")
          .where("teacherSponsoredEnrollments.orderId", "is not", null)
      );

    if (startDate) revenueByTypeQuery = revenueByTypeQuery.where("o.createdAt", ">=", startDate);
    if (endDate) revenueByTypeQuery = revenueByTypeQuery.where("o.createdAt", "<=", endDate);

    // 12. Sponsored Revenue (Flow metric: filtered by date)
    // Sum of commission_amount from teacher_sponsored_enrollments for balance_deduction and online_payment
    let sponsoredRevenueQuery = db
      .selectFrom("teacherSponsoredEnrollments")
      .select(db.fn.sum<string>("commissionAmount").as("total"))
      .where("paymentMethod", "in", ["balance_deduction", "online_payment"]);

    if (startDate) sponsoredRevenueQuery = sponsoredRevenueQuery.where("enrolledAt", ">=", startDate);
    if (endDate) sponsoredRevenueQuery = sponsoredRevenueQuery.where("enrolledAt", "<=", endDate);

    // 13. Student wallet balance (Stock metric: ALWAYS All-Time)
    // Matches getStudentAvailableBalance helper formula:
    // availableBalance = totalCredits - totalWithdrawn(completed+pending) - totalPurchaseDebits

    // 13a. Credits: prize_credit + prize_lock_refund transactions
    const studentCreditsQuery = db
      .selectFrom("studentWalletTransactions")
      .select(db.fn.sum<string>("amount").as("total"))
      .where("transactionType", "in", ["prize_credit", "prize_lock_refund"])
      .executeTakeFirst();

    // 13b. Withdrawals: both completed and pending
    const studentWithdrawalsQuery = db
      .selectFrom("studentWithdrawals")
      .select(db.fn.sum<string>("amount").as("total"))
      .where("status", "in", ["completed", "pending"])
      .executeTakeFirst();

    // 13c. Purchase debits
    const studentPurchaseDebitsQuery = db
      .selectFrom("studentWalletTransactions")
      .select(db.fn.sum<string>("amount").as("total"))
      .where("transactionType", "=", "purchase_debit")
      .executeTakeFirst();

    // 14. Student pending withdrawals (Stock metric: ALWAYS All-Time)
    const studentPendingWithdrawalsQuery = db
      .selectFrom("studentWithdrawals")
      .select(db.fn.sum<string>("amount").as("total"))
      .where("status", "=", "pending")
      .executeTakeFirst();

    // Execute all queries in parallel
    const [
      revenueResult,
      itemsResult,
      disbursedResult,
      allTimeEarningsResult,
      allTimeWithdrawalsResult,
      allTimeSponsoredResult,
      allTimePrizeDeductionsResult,
      allTimeSubscriptionWalletPaymentsResult,
      pendingWithdrawalsResult,
      subscriptionRevenueResult,
      activePaidSubscriptionsResult,
      totalActiveSubscriptionsResult,
      subscriptionTransactionsCountResult,
      failedSubscriptionTransactionsCountResult,
      revenueByTypeResult,
      sponsoredRevenueResult,
      studentCreditsResult,
      studentWithdrawalsResult,
      studentPurchaseDebitsResult,
      studentPendingWithdrawalsResult,
    ] = await Promise.all([
      revenueQuery.executeTakeFirst(),
      itemsQuery.executeTakeFirst(),
      disbursedQuery.executeTakeFirst(),
      allTimeEarningsQuery.execute(db),
      allTimeWithdrawalsQuery.execute(db),
      allTimeSponsoredQuery.execute(db),
      allTimePrizeDeductionsQuery.execute(db),
      allTimeSubscriptionWalletPaymentsQuery.execute(db),
      pendingWithdrawalsQuery.executeTakeFirst(),
      subscriptionRevenueQuery.executeTakeFirst(),
      activePaidSubscriptionsQuery.executeTakeFirst(),
      totalActiveSubscriptionsQuery.executeTakeFirst(),
      subscriptionTransactionsCountQuery.executeTakeFirst(),
      failedSubscriptionTransactionsCountQuery.executeTakeFirst(),
      revenueByTypeQuery.executeTakeFirst(),
      sponsoredRevenueQuery.executeTakeFirst(),
      studentCreditsQuery,
      studentWithdrawalsQuery,
      studentPurchaseDebitsQuery,
      studentPendingWithdrawalsQuery,
    ]);

    // Parse results
    const totalRevenue = parseFloat(revenueResult?.total || "0");
    const totalPlatformFee = parseFloat(itemsResult?.totalPlatformFee || "0");
    const totalTeacherEarnings = parseFloat(itemsResult?.totalTeacherEarnings || "0");
    const totalDisbursed = parseFloat(disbursedResult?.total || "0");

    const allTimeEarnings = parseFloat(allTimeEarningsResult.rows[0]?.total || "0");
    const allTimeWithdrawals = parseFloat(allTimeWithdrawalsResult.rows[0]?.total || "0");
    const allTimeSponsored = parseFloat(allTimeSponsoredResult.rows[0]?.total || "0");
    const totalPrizeDeductions = parseFloat(allTimePrizeDeductionsResult.rows[0]?.total || "0");
    const allTimeSubscriptionWalletPayments = parseFloat(allTimeSubscriptionWalletPaymentsResult.rows[0]?.total || "0");
    const totalTeacherWalletBalance = Math.max(
      0,
      Math.round((allTimeEarnings - allTimeWithdrawals - allTimeSponsored - totalPrizeDeductions - allTimeSubscriptionWalletPayments) * 100) / 100
    );

    const totalPendingWithdrawals = parseFloat(pendingWithdrawalsResult?.total || "0");
    const subscriptionRevenue = parseFloat(subscriptionRevenueResult?.total || "0");
    const activePaidSubscriptionsCount = parseInt(activePaidSubscriptionsResult?.count || "0", 10);
    const totalSubscriptionsCount = parseInt(totalActiveSubscriptionsResult?.count || "0", 10);
    const subscriptionTransactionsCount = parseInt(subscriptionTransactionsCountResult?.count || "0", 10);
    const failedSubscriptionTransactionsCount = parseInt(failedSubscriptionTransactionsCountResult?.count || "0", 10);

    const regularMockTestRevenue = parseFloat(revenueByTypeResult?.regularMockTestRevenue || "0");
    const liveTestRevenue = parseFloat(revenueByTypeResult?.liveTestRevenue || "0");
    const courseRevenue = parseFloat(revenueByTypeResult?.courseRevenue || "0");
    const digitalProductRevenue = parseFloat(revenueByTypeResult?.digitalProductRevenue || "0");
    const otherRevenue = parseFloat(revenueByTypeResult?.otherRevenue || "0");
    const sponsoredRevenue = parseFloat(sponsoredRevenueResult?.total || "0");

    const studentCredits = parseFloat(studentCreditsResult?.total || "0");
    const studentWithdrawn = parseFloat(studentWithdrawalsResult?.total || "0");
    const studentPurchaseDebits = parseFloat(studentPurchaseDebitsResult?.total || "0");
    const studentWalletBalance = Math.max(
      0,
      Math.round((studentCredits - studentWithdrawn - studentPurchaseDebits) * 100) / 100
    );
    const studentPendingWithdrawals = parseFloat(studentPendingWithdrawalsResult?.total || "0");

    const output: OutputType = {
      totalRevenue,
      totalPlatformFee,
      totalTeacherEarnings,
      totalDisbursed,
      totalTeacherWalletBalance,
      totalPendingWithdrawals,
      subscriptionRevenue,
      activePaidSubscriptionsCount,
      totalSubscriptionsCount,
      subscriptionTransactionsCount,
      failedSubscriptionTransactionsCount,
      regularMockTestRevenue,
      liveTestRevenue,
      courseRevenue,
      digitalProductRevenue,
      otherRevenue,
      sponsoredRevenue,
      studentWalletBalance,
      studentPendingWithdrawals,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching finance summary:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}