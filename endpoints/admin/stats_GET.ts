import { db } from "../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../helpers/getAdminSession";
import { OutputType } from "./stats_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const [
      teachersResult,
      studentsResult,
      publishedTestsResult,
      publishedCoursesResult,
      publishedProductsResult,
      publishedBundlesResult,
      liveTestsResult,
      completedTestAttemptsResult,
      totalOrdersRevenueResult,
      totalSubscriptionRevenueResult,
      totalCompletedOrdersResult,
      monthlyOrdersRevenueResult,
      monthlySubscriptionRevenueResult,
      monthlyCompletedOrdersResult,
      monthlyNewTeachersResult,
      monthlyNewStudentsResult,
      monthlyPublishedTestsResult,
      failedOrdersResult,
      pendingOrdersResult,
      revenueHistoryResult,
      signupHistoryResult,
    ] = await Promise.all([
      // Total teachers
      db
        .selectFrom("users")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("role", "=", "teacher")
        .executeTakeFirstOrThrow(),

      // Total students
      db
        .selectFrom("users")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("role", "=", "student")
        .executeTakeFirstOrThrow(),

      // Published tests
      db
        .selectFrom("mockTests")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("isPublished", "=", true)
        .executeTakeFirstOrThrow(),

      // Published courses
      db
        .selectFrom("courses")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("status", "=", "published")
        .executeTakeFirstOrThrow(),

      // Published digital products
      db
        .selectFrom("digitalProducts")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("status", "=", "published")
        .executeTakeFirstOrThrow(),

      // Published bundles
      db
        .selectFrom("courseBundles")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("isPublished", "=", true)
        .executeTakeFirstOrThrow(),

      // Active live tests
      db
        .selectFrom("liveTests")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("isActive", "=", true)
        .executeTakeFirstOrThrow(),

      // Completed test attempts
      db
        .selectFrom("testAttempts")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("completedAt", "is not", null)
        .executeTakeFirstOrThrow(),

      // Total revenue from completed orders (all time)
      db
        .selectFrom("orders")
        .select((eb) => eb.fn.sum<string>("totalAmount").as("revenue"))
        .where("status", "=", "completed")
        .executeTakeFirst(),

      // Total revenue from completed subscription transactions (all time)
      db
        .selectFrom("subscriptionTransactions")
        .select((eb) => eb.fn.sum<string>("amount").as("revenue"))
        .where("status", "=", "completed")
        .executeTakeFirst(),

      // Total completed orders count (all time)
      db
        .selectFrom("orders")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("status", "=", "completed")
        .executeTakeFirstOrThrow(),

      // Monthly revenue from completed orders
      db
        .selectFrom("orders")
        .select((eb) => eb.fn.sum<string>("totalAmount").as("revenue"))
        .where("status", "=", "completed")
        .where(
          sql`date_trunc('month', created_at)`,
          "=",
          sql`date_trunc('month', NOW())`
        )
        .executeTakeFirst(),

      // Monthly revenue from completed subscription transactions
      db
        .selectFrom("subscriptionTransactions")
        .select((eb) => eb.fn.sum<string>("amount").as("revenue"))
        .where("status", "=", "completed")
        .where(
          sql`date_trunc('month', transaction_date)`,
          "=",
          sql`date_trunc('month', NOW())`
        )
        .executeTakeFirst(),

      // Monthly completed orders count
      db
        .selectFrom("orders")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("status", "=", "completed")
        .where(
          sql`date_trunc('month', created_at)`,
          "=",
          sql`date_trunc('month', NOW())`
        )
        .executeTakeFirstOrThrow(),

      // Monthly new teachers
      db
        .selectFrom("users")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("role", "=", "teacher")
        .where(
          sql`date_trunc('month', created_at)`,
          "=",
          sql`date_trunc('month', NOW())`
        )
        .executeTakeFirstOrThrow(),

      // Monthly new students
      db
        .selectFrom("users")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("role", "=", "student")
        .where(
          sql`date_trunc('month', created_at)`,
          "=",
          sql`date_trunc('month', NOW())`
        )
        .executeTakeFirstOrThrow(),

      // Monthly published tests
      db
        .selectFrom("mockTests")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("isPublished", "=", true)
        .where(
          sql`date_trunc('month', created_at)`,
          "=",
          sql`date_trunc('month', NOW())`
        )
        .executeTakeFirstOrThrow(),

      // Failed orders count
      db
        .selectFrom("orders")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("status", "=", "failed")
        .executeTakeFirstOrThrow(),

      // Pending orders count
      db
        .selectFrom("orders")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("status", "=", "pending")
        .executeTakeFirstOrThrow(),

      // Last 6 months revenue history (most recent first, we'll reverse)
      db
        .selectFrom("orders")
        .select([
          sql<string>`to_char(created_at, 'YYYY-MM')`.as("month"),
          sql<string>`SUM(total_amount)`.as("revenue"),
        ])
        .where("status", "=", "completed")
        .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
        .orderBy(sql`to_char(created_at, 'YYYY-MM')`, "desc")
        .limit(6)
        .execute(),

      // Last 6 months signup history (most recent first, we'll reverse)
      db
        .selectFrom("users")
        .select([
          sql<string>`to_char(created_at, 'YYYY-MM')`.as("month"),
          sql<string>`COUNT(*) FILTER (WHERE role = 'teacher')`.as("teachers"),
          sql<string>`COUNT(*) FILTER (WHERE role = 'student')`.as("students"),
        ])
        .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
        .orderBy(sql`to_char(created_at, 'YYYY-MM')`, "desc")
        .limit(6)
        .execute(),
    ]);

    const totalOrdersRevenue = Number(totalOrdersRevenueResult?.revenue ?? 0);
    const totalSubscriptionRevenue = Number(totalSubscriptionRevenueResult?.revenue ?? 0);
    const monthlyOrdersRevenue = Number(monthlyOrdersRevenueResult?.revenue ?? 0);
    const monthlySubscriptionRevenue = Number(monthlySubscriptionRevenueResult?.revenue ?? 0);

    // Reverse to chronological order
    const revenueHistory = [...revenueHistoryResult].reverse().map((row) => ({
      month: row.month,
      revenue: Number(row.revenue ?? 0),
    }));

    const signupHistory = [...signupHistoryResult].reverse().map((row) => ({
      month: row.month,
      teachers: Number(row.teachers ?? 0),
      students: Number(row.students ?? 0),
    }));

    const output: OutputType = {
      // Top KPIs
      totalRevenue: totalOrdersRevenue + totalSubscriptionRevenue,
      totalTeachers: parseInt(teachersResult.count, 10),
      totalStudents: parseInt(studentsResult.count, 10),
      totalCompletedOrders: parseInt(totalCompletedOrdersResult.count, 10),

      // This Month
      monthlyRevenue: monthlyOrdersRevenue + monthlySubscriptionRevenue,
      monthlyNewTeachers: parseInt(monthlyNewTeachersResult.count, 10),
      monthlyNewStudents: parseInt(monthlyNewStudentsResult.count, 10),
      monthlyCompletedOrders: parseInt(monthlyCompletedOrdersResult.count, 10),
      monthlyPublishedTests: parseInt(monthlyPublishedTestsResult.count, 10),

      // Content Counts
      publishedTests: parseInt(publishedTestsResult.count, 10),
      publishedCourses: parseInt(publishedCoursesResult.count, 10),
      publishedProducts: parseInt(publishedProductsResult.count, 10),
      publishedBundles: parseInt(publishedBundlesResult.count, 10),
      liveTests: parseInt(liveTestsResult.count, 10),
      completedTestAttempts: parseInt(completedTestAttemptsResult.count, 10),

      // Order status breakdown
      failedOrders: parseInt(failedOrdersResult.count, 10),
      pendingOrders: parseInt(pendingOrdersResult.count, 10),

      // Charts
      revenueHistory,
      signupHistory,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}