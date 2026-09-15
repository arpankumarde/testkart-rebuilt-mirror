import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { getTeacherPlatformFee } from "../../../helpers/getTeacherPlatformFee";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Get teacher's current platform fee for bundle calculations (bundles don't store per-order fee)
    const platformFee = await getTeacherPlatformFee(effectiveTeacherId);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    // Fetch mock test sales transactions
    const mockTestSalesData = await db
      .selectFrom("orders")
      .innerJoin("users", "orders.userId", "users.id")
      .innerJoin("orderItems", "orderItems.orderId", "orders.id")
      .innerJoin("mockTests", "orderItems.mockTestId", "mockTests.id")
      .where("mockTests.teacherId", "=", effectiveTeacherId)
      .where("orders.status", "=", "completed")
      .where((eb) => eb.or([eb("orders.paymentMethod", "is", null), eb("orders.paymentMethod", "!=", "teacher_sponsored")]))
      .where("orders.id", "not in", (eb) =>
        eb
          .selectFrom("teacherSponsoredEnrollments")
          .select("teacherSponsoredEnrollments.orderId")
          .where("teacherSponsoredEnrollments.orderId", "is not", null)
      )
      .select([
        "orders.id as orderId",
        "orders.createdAt as transactionDate",
        "mockTests.title as testTitle",
        "users.displayName as studentName",
        sql<string>`(order_items.price_at_purchase - order_items.discount_amount)`.as("grossAmount"),
        "orderItems.platformFeePercentage",
        sql<string>`(order_items.price_at_purchase - order_items.discount_amount) * (1 - order_items.platform_fee_percentage / 100)`.as(
          "amountEarned"
        ),
      ])
      .execute();

    // Fetch live test enrollment info for this teacher's orders to detect live test sales
    const liveTestOrderInfo = await db
      .selectFrom("liveTestEnrollments")
      .innerJoin("liveTests", "liveTestEnrollments.liveTestId", "liveTests.id")
      .where("liveTests.teacherId", "=", effectiveTeacherId)
      .where("liveTestEnrollments.paymentOrderId", "is not", null)
      .select([
        "liveTestEnrollments.paymentOrderId",
        "liveTests.endTime",
      ])
      .execute();

    // Map orderId -> whether the live test has ended
    const liveTestOrderMap = new Map<number, boolean>();
    const now = new Date();
    for (const row of liveTestOrderInfo) {
      if (row.paymentOrderId !== null) {
        liveTestOrderMap.set(row.paymentOrderId, new Date(row.endTime) < now);
      }
    }

    const mockTestSalesTransactions: OutputType = mockTestSalesData.map((row) => ({
      transactionDate: row.transactionDate,
      testTitle: row.testTitle,
      studentName: row.studentName,
      grossAmount: Number(row.grossAmount),
      platformFeePercentage: Number(row.platformFeePercentage),
      amountEarned: Number(row.amountEarned),
      transactionType: "sale" as const,
      isLiveTest: liveTestOrderMap.has(row.orderId),
      liveTestEnded: liveTestOrderMap.get(row.orderId) ?? false,
    }));

    // Fetch course sales transactions
    const courseSalesData = await db
      .selectFrom("orders")
      .innerJoin("users", "orders.userId", "users.id")
      .innerJoin("orderItems", "orderItems.orderId", "orders.id")
      .innerJoin("courses", "orderItems.courseId", "courses.id")
      .where("courses.teacherId", "=", effectiveTeacherId)
      .where("orders.status", "=", "completed")
      .where((eb) => eb.or([eb("orders.paymentMethod", "is", null), eb("orders.paymentMethod", "!=", "teacher_sponsored")]))
      .where("orders.id", "not in", (eb) =>
        eb
          .selectFrom("teacherSponsoredEnrollments")
          .select("teacherSponsoredEnrollments.orderId")
          .where("teacherSponsoredEnrollments.orderId", "is not", null)
      )
      .select([
        "orders.createdAt as transactionDate",
        "courses.title as testTitle",
        "users.displayName as studentName",
        sql<string>`(order_items.price_at_purchase - order_items.discount_amount)`.as("grossAmount"),
        "orderItems.platformFeePercentage",
        sql<string>`(order_items.price_at_purchase - order_items.discount_amount) * (1 - order_items.platform_fee_percentage / 100)`.as(
          "amountEarned"
        ),
      ])
      .execute();

    const courseSalesTransactions: OutputType = courseSalesData.map((row) => ({
      ...row,
      grossAmount: Number(row.grossAmount),
      platformFeePercentage: Number(row.platformFeePercentage),
      amountEarned: Number(row.amountEarned),
      transactionType: "sale" as const,
    }));

    // Fetch digital product sales transactions
    const digitalProductSalesData = await db
      .selectFrom("orders")
      .innerJoin("users", "orders.userId", "users.id")
      .innerJoin("orderItems", "orderItems.orderId", "orders.id")
      .innerJoin("digitalProducts", "orderItems.digitalProductId", "digitalProducts.id")
      .where("digitalProducts.teacherId", "=", effectiveTeacherId)
      .where("orders.status", "=", "completed")
      .where((eb) => eb.or([eb("orders.paymentMethod", "is", null), eb("orders.paymentMethod", "!=", "teacher_sponsored")]))
      .where("orders.id", "not in", (eb) =>
        eb
          .selectFrom("teacherSponsoredEnrollments")
          .select("teacherSponsoredEnrollments.orderId")
          .where("teacherSponsoredEnrollments.orderId", "is not", null)
      )
      .select([
        "orders.createdAt as transactionDate",
        "digitalProducts.title as testTitle",
        "users.displayName as studentName",
        sql<string>`(order_items.price_at_purchase - order_items.discount_amount)`.as("grossAmount"),
        "orderItems.platformFeePercentage",
        sql<string>`(order_items.price_at_purchase - order_items.discount_amount) * (1 - order_items.platform_fee_percentage / 100)`.as(
          "amountEarned"
        ),
      ])
      .execute();

    const digitalProductSalesTransactions: OutputType = digitalProductSalesData.map((row) => ({
      ...row,
      grossAmount: Number(row.grossAmount),
      platformFeePercentage: Number(row.platformFeePercentage),
      amountEarned: Number(row.amountEarned),
      transactionType: "sale" as const,
    }));

    // Fetch bundle sales transactions
    const bundleSalesData = await db
      .selectFrom("orders")
      .innerJoin("users", "orders.userId", "users.id")
      .innerJoin("courseBundles", "orders.bundleId", "courseBundles.id")
      .where("courseBundles.teacherId", "=", effectiveTeacherId)
      .where("orders.status", "=", "completed")
      .where("orders.bundleId", "is not", null)
      .where((eb) => eb.or([eb("orders.paymentMethod", "is", null), eb("orders.paymentMethod", "!=", "teacher_sponsored")]))
      .where("orders.id", "not in", (eb) =>
        eb
          .selectFrom("teacherSponsoredEnrollments")
          .select("teacherSponsoredEnrollments.orderId")
          .where("teacherSponsoredEnrollments.orderId", "is not", null)
      )
      .select([
        "orders.createdAt as transactionDate",
        "courseBundles.title as testTitle",
        "users.displayName as studentName",
        sql<string>`orders.total_amount`.as("grossAmount"),
        "orders.platformFeePercentage",
      ])
      .execute();

    const bundleSalesTransactions: OutputType = bundleSalesData.map((row) => {
      const gross = Number(row.grossAmount);
      // Use the fee captured at time of sale when available; only fall back to the
      // teacher's current live fee for legacy orders that predate this column.
      const feePercentage =
        row.platformFeePercentage !== null && row.platformFeePercentage !== undefined
          ? Number(row.platformFeePercentage)
          : platformFee;
      return {
        transactionDate: row.transactionDate,
        testTitle: row.testTitle,
        studentName: row.studentName,
        grossAmount: gross,
        platformFeePercentage: feePercentage,
        amountEarned: gross * (1 - feePercentage / 100),
        transactionType: "sale" as const,
      };
    });

    // Fetch withdrawal transactions
    const withdrawalData = await db
      .selectFrom("teacherWithdrawals")
      .where("teacherWithdrawals.teacherId", "=", effectiveTeacherId)
      .where("teacherWithdrawals.status", "=", "completed")
      .select([
        "teacherWithdrawals.processedDate as transactionDate",
        "teacherWithdrawals.amount",
        "teacherWithdrawals.notes",
      ])
      .execute();

    const withdrawalTransactions: OutputType = withdrawalData.map((row) => ({
      transactionDate: row.transactionDate,
      testTitle: "Payment Withdrawal",
      studentName: row.notes || "N/A",
      grossAmount: Number(row.amount),
      platformFeePercentage: 0,
      amountEarned: -Number(row.amount),
      transactionType: "withdrawal" as const,
    }));

    // Fetch sponsored enrollment transactions (both balance_deduction and online_payment)
    // LEFT JOIN on all content type tables to support all content types
    const sponsoredData = await db
      .selectFrom("teacherSponsoredEnrollments")
      // Left join, so a closed student account still shows the deduction the balance counts.
      .leftJoin("users", "teacherSponsoredEnrollments.studentId", "users.id")
      .leftJoin("mockTests", "teacherSponsoredEnrollments.mockTestId", "mockTests.id")
      .leftJoin("courses", "teacherSponsoredEnrollments.courseId", "courses.id")
      .leftJoin("digitalProducts", "teacherSponsoredEnrollments.digitalProductId", "digitalProducts.id")
      .leftJoin("courseBundles", "teacherSponsoredEnrollments.bundleId", "courseBundles.id")
      .where("teacherSponsoredEnrollments.teacherId", "=", effectiveTeacherId)
      .where("teacherSponsoredEnrollments.paymentMethod", "in", [
        "balance_deduction",
        "online_payment",
      ])
      .select([
        "teacherSponsoredEnrollments.enrolledAt as transactionDate",
        sql<string>`COALESCE(mock_tests.title, courses.title, digital_products.title, course_bundles.title, 'Unknown')`.as("contentTitle"),
        sql<string>`COALESCE(users.display_name, 'Deleted account')`.as("studentName"),
        "teacherSponsoredEnrollments.commissionAmount as grossAmount",
        "teacherSponsoredEnrollments.platformFeePercentage",
        "teacherSponsoredEnrollments.paymentMethod",
        "teacherSponsoredEnrollments.contentType",
      ])
      .execute();

    const sponsoredTransactions: OutputType = sponsoredData.map((row) => ({
      transactionDate: row.transactionDate,
      testTitle: row.contentTitle,
      studentName: row.studentName,
      grossAmount: Number(row.grossAmount),
      platformFeePercentage: Number(row.platformFeePercentage),
      // balance_deduction: deducted from wallet → show as negative amount
      // online_payment: paid externally via PayU → not from wallet, show as 0
      amountEarned: row.paymentMethod === 'balance_deduction' ? -Number(row.grossAmount) : 0,
      transactionType: "sponsored" as const,
    }));

    // Fetch prize deduction transactions (prize money paid out to winners of teacher's live tests)
    const prizeDistributionData = await db
      .selectFrom("liveTestPrizeDistributions")
      .innerJoin("liveTests", "liveTestPrizeDistributions.liveTestId", "liveTests.id")
      .innerJoin("users", "liveTestPrizeDistributions.studentId", "users.id")
      .where("liveTests.teacherId", "=", effectiveTeacherId)
      .select([
        "liveTestPrizeDistributions.createdAt as transactionDate",
        "liveTests.title as liveTestTitle",
        "liveTestPrizeDistributions.rank",
        "users.displayName as studentName",
        "liveTestPrizeDistributions.actualAmount",
      ])
      .execute();

    const prizeDeductionTransactions: OutputType = prizeDistributionData.map((row) => ({
      transactionDate: row.transactionDate,
      testTitle: `Prize - Rank ${row.rank}: ${row.liveTestTitle}`,
      studentName: row.studentName,
      grossAmount: Number(row.actualAmount),
      platformFeePercentage: 0,
      amountEarned: -Number(row.actualAmount),
      transactionType: "prize_deduction" as const,
    }));

    // Combine all transaction arrays
   // Fetch subscription wallet payment transactions (deductions from teacher's wallet for platform subscription)
    const subscriptionData = await db
      .selectFrom("subscriptionTransactions")
      .innerJoin("subscriptionPlans", "subscriptionTransactions.planId", "subscriptionPlans.id")
      .where("subscriptionTransactions.teacherId", "=", effectiveTeacherId)
      .where("subscriptionTransactions.paymentMethod", "=", "wallet")
      .where("subscriptionTransactions.status", "=", "completed")
      .select([
        "subscriptionTransactions.createdAt as transactionDate",
        "subscriptionPlans.name as planName",
        "subscriptionTransactions.transactionId",
        "subscriptionTransactions.amount",
      ])
      .execute();

    const subscriptionTransactions: OutputType = subscriptionData.map((row) => ({
      transactionDate: row.transactionDate,
      testTitle: `Subscription: ${row.planName}`,
      studentName: row.transactionId || "Wallet Payment",
      grossAmount: Number(row.amount),
      platformFeePercentage: 0,
      amountEarned: -Number(row.amount),
      transactionType: "subscription" as const,
    }));

    // Combine all transaction arrays
   const allTransactions: OutputType = [
      ...mockTestSalesTransactions,
      ...courseSalesTransactions,
       ...digitalProductSalesTransactions,
       ...bundleSalesTransactions,
       ...withdrawalTransactions,
      ...subscriptionTransactions,
       ...sponsoredTransactions,
       ...prizeDeductionTransactions,
     ];

    // Sort by transaction date descending (most recent first)
    allTransactions.sort((a, b) => {
      const dateA = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
      const dateB = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
      return dateB - dateA;
    });

    return new Response(superjson.stringify(allTransactions));
  } catch (error) {
        console.error("[earnings/list] Error fetching teacher's earnings:", error);

    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}