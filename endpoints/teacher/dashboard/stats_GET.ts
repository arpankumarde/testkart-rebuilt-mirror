import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./stats_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";
import { getTeacherPlatformFee } from "../../../helpers/getTeacherPlatformFee";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const platformFee = await getTeacherPlatformFee(effectiveTeacherId);

    // Fire all massive aggregating requests in parallel for optimized performance
    const [
      countsResult,
      uniqueStudentsResult,
      topTestsResult,
      topCoursesResult,
      earningsResult,
      sponsoredResult,
      balanceResult
    ] = await Promise.all([
      // 1. Aggregated Counts
      sql<{
        totalTests: string;
        publishedTests: string;
        totalCourses: string;
        publishedCourses: string;
        totalBundles: string;
        publishedBundles: string;
        totalProducts: string;
        publishedProducts: string;
      }>`
        SELECT
          (SELECT COUNT(*) FROM mock_tests WHERE teacher_id = ${effectiveTeacherId} AND deleted_at IS NULL) as total_tests,
          (SELECT COUNT(*) FROM mock_tests WHERE teacher_id = ${effectiveTeacherId} AND deleted_at IS NULL AND is_published = true) as published_tests,
          (SELECT COUNT(*) FROM courses WHERE teacher_id = ${effectiveTeacherId}) as total_courses,
          (SELECT COUNT(*) FROM courses WHERE teacher_id = ${effectiveTeacherId} AND status = 'published') as published_courses,
          (SELECT COUNT(*) FROM course_bundles WHERE teacher_id = ${effectiveTeacherId}) as total_bundles,
          (SELECT COUNT(*) FROM course_bundles WHERE teacher_id = ${effectiveTeacherId} AND is_published = true) as published_bundles,
          (SELECT COUNT(*) FROM digital_products WHERE teacher_id = ${effectiveTeacherId}) as total_products,
          (SELECT COUNT(*) FROM digital_products WHERE teacher_id = ${effectiveTeacherId} AND status = 'published') as published_products
      `.execute(db),

      // 2. Unique Students across all enrollment types
      sql<{ count: string }>`
        WITH all_students AS (
          SELECT mte.student_id FROM mock_test_enrollments mte INNER JOIN mock_tests mt ON mt.id = mte.mock_test_id WHERE mt.teacher_id = ${effectiveTeacherId}
          UNION ALL
          SELECT ce.student_id FROM course_enrollments ce INNER JOIN courses c ON c.id = ce.course_id WHERE c.teacher_id = ${effectiveTeacherId}
          UNION ALL
          SELECT lte.student_id FROM live_test_enrollments lte INNER JOIN live_tests lt ON lt.id = lte.live_test_id WHERE lt.teacher_id = ${effectiveTeacherId}
          UNION ALL
          SELECT be.student_id FROM bundle_enrollments be INNER JOIN course_bundles cb ON cb.id = be.bundle_id WHERE cb.teacher_id = ${effectiveTeacherId}
          UNION ALL
          SELECT o.user_id as student_id FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id INNER JOIN digital_products dp ON dp.id = oi.digital_product_id WHERE o.status = 'completed' AND dp.teacher_id = ${effectiveTeacherId}
        )
        SELECT COUNT(DISTINCT student_id) as count FROM all_students
      `.execute(db),

      // 3. Top Mock Tests
      db.selectFrom("mockTests")
        .where("teacherId", "=", effectiveTeacherId)
        .where("deletedAt", "is", null)
        .orderBy("studentsEnrolled", "desc")
        .limit(3)
        .select(["id", "title", "thumbnailUrl", "studentsEnrolled", "price"])
        .execute(),

      // 4. Top Courses (requires lesson count subquery)
      db.selectFrom("courses")
        .where("teacherId", "=", effectiveTeacherId)
        .where("status", "=", "published")
        .orderBy("createdAt", "desc")
        .limit(3)
        .select([
          "id", "title", "thumbnailImageUrl", "price",
          (eb) => eb.selectFrom("courseLessons")
            .innerJoin("courseSections", "courseLessons.sectionId", "courseSections.id")
            .whereRef("courseSections.courseId", "=", "courses.id")
            .select(sql<string>`count(*)`.as("count"))
            .as("lessonsCount")
        ])
        .execute(),

      // 5. Monthly Earnings
      sql<{ month: string; year: string; earnings: string }>`
        WITH sales AS (
           SELECT o.created_at, (oi.price_at_purchase - COALESCE(oi.discount_amount, 0)) * (1 - oi.platform_fee_percentage / 100.0) as net
           FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN mock_tests mt ON mt.id = oi.mock_test_id
           WHERE mt.teacher_id = ${effectiveTeacherId} AND o.status = 'completed' AND (o.payment_method IS NULL OR o.payment_method != 'teacher_sponsored') AND o.id NOT IN (SELECT order_id FROM teacher_sponsored_enrollments WHERE order_id IS NOT NULL)
           
           UNION ALL
           SELECT o.created_at, (oi.price_at_purchase - COALESCE(oi.discount_amount, 0)) * (1 - oi.platform_fee_percentage / 100.0) as net
           FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN courses c ON c.id = oi.course_id
           WHERE c.teacher_id = ${effectiveTeacherId} AND o.status = 'completed' AND (o.payment_method IS NULL OR o.payment_method != 'teacher_sponsored') AND o.id NOT IN (SELECT order_id FROM teacher_sponsored_enrollments WHERE order_id IS NOT NULL)

           UNION ALL
           SELECT o.created_at, (oi.price_at_purchase - COALESCE(oi.discount_amount, 0)) * (1 - oi.platform_fee_percentage / 100.0) as net
           FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN digital_products dp ON dp.id = oi.digital_product_id
           WHERE dp.teacher_id = ${effectiveTeacherId} AND o.status = 'completed' AND (o.payment_method IS NULL OR o.payment_method != 'teacher_sponsored') AND o.id NOT IN (SELECT order_id FROM teacher_sponsored_enrollments WHERE order_id IS NOT NULL)

           UNION ALL
           SELECT o.created_at, o.total_amount * (1 - COALESCE(o.platform_fee_percentage, ${platformFee}) / 100.0) as net
           FROM orders o JOIN course_bundles cb ON cb.id = o.bundle_id
           WHERE cb.teacher_id = ${effectiveTeacherId} AND o.status = 'completed' AND (o.payment_method IS NULL OR o.payment_method != 'teacher_sponsored') AND o.id NOT IN (SELECT order_id FROM teacher_sponsored_enrollments WHERE order_id IS NOT NULL)
        )
        SELECT 
          EXTRACT(MONTH FROM created_at) as month,
          EXTRACT(YEAR FROM created_at) as year,
          SUM(net) as earnings
        FROM sales
        WHERE created_at IS NOT NULL
        GROUP BY year, month
        ORDER BY year ASC, month ASC
      `.execute(db),

      // 6. Recent Sponsored Enrollments
      db.selectFrom("teacherSponsoredEnrollments")
        .leftJoin("users", "teacherSponsoredEnrollments.studentId", "users.id")
        .leftJoin("mockTests", "teacherSponsoredEnrollments.mockTestId", "mockTests.id")
        .leftJoin("courses", "teacherSponsoredEnrollments.courseId", "courses.id")
        .leftJoin("digitalProducts", "teacherSponsoredEnrollments.digitalProductId", "digitalProducts.id")
        .leftJoin("courseBundles", "teacherSponsoredEnrollments.bundleId", "courseBundles.id")
        .where("teacherSponsoredEnrollments.teacherId", "=", effectiveTeacherId)
        .orderBy("teacherSponsoredEnrollments.enrolledAt", "desc")
        .limit(5)
        .select([
          "teacherSponsoredEnrollments.id",
          sql<string>`COALESCE(users.display_name, 'Deleted account')`.as("studentName"),
          sql<string>`COALESCE(mock_tests.title, courses.title, digital_products.title, course_bundles.title, 'Unknown')`.as("contentTitle"),
          "teacherSponsoredEnrollments.enrolledAt",
          "teacherSponsoredEnrollments.commissionAmount"
        ])
        .execute(),

      // 7. Available Balance 
      getTeacherAvailableBalance(effectiveTeacherId, db)
    ]);

    const countsRow = countsResult.rows[0] ?? {
      totalTests: '0', publishedTests: '0',
      totalCourses: '0', publishedCourses: '0',
      totalBundles: '0', publishedBundles: '0',
      totalProducts: '0', publishedProducts: '0'
    };

    const output: OutputType = {
      counts: {
        totalTestsCount: Number(countsRow.totalTests || 0),
        publishedTestsCount: Number(countsRow.publishedTests || 0),
        totalCoursesCount: Number(countsRow.totalCourses || 0),
        publishedCoursesCount: Number(countsRow.publishedCourses || 0),
        totalBundlesCount: Number(countsRow.totalBundles || 0),
        publishedBundlesCount: Number(countsRow.publishedBundles || 0),
        totalProductsCount: Number(countsRow.totalProducts || 0),
        publishedProductsCount: Number(countsRow.publishedProducts || 0),
      },
      totalUniqueStudents: Number(uniqueStudentsResult.rows[0]?.count || 0),
      topTests: topTestsResult.map(t => ({
        id: t.id,
        title: t.title,
        thumbnailUrl: t.thumbnailUrl,
        studentsEnrolled: t.studentsEnrolled,
        price: Number(t.price || 0)
      })),
      topCourses: topCoursesResult.map(c => ({
        id: c.id,
        title: c.title,
        thumbnailImageUrl: c.thumbnailImageUrl,
        lessonsCount: Number(c.lessonsCount || 0),
        price: Number(c.price || 0)
      })),
      monthlyEarnings: earningsResult.rows.map(row => ({
        month: MONTH_NAMES[Number(row.month) - 1] || "Unknown",
        year: Number(row.year),
        earnings: Number(row.earnings || 0)
      })),
      recentSponsored: sponsoredResult.map(s => ({
        id: s.id,
        studentName: s.studentName,
        contentTitle: s.contentTitle,
        enrolledAt: s.enrolledAt,
        commissionAmount: Number(s.commissionAmount || 0)
      })),
      availableBalance: balanceResult.availableBalance
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching teacher dashboard stats:", error);
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