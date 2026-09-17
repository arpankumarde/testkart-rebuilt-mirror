import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType, TeacherStudent } from "./list_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { sql } from "kysely";


export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const teacherId = effectiveTeacherId;

    // Check if teacher has an active PAID subscription (price > 0, not free plan)
    const paidSub = await db
      .selectFrom("teacherSubscriptions")
      .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
      .select("teacherSubscriptions.id")
      .where("teacherSubscriptions.teacherId", "=", teacherId)
      .where("teacherSubscriptions.status", "=", "active")
      .where("teacherSubscriptions.endDate", ">", new Date())
      .where("subscriptionPlans.price", ">", "0")
      .executeTakeFirst();

    const hasPaidSubscription = !!paidSub;
    // Team managers see who enrolled and whether it was paid, not how much.
    const showAmounts = teacherRole !== "manager";

    // Use raw SQL UNION ALL to aggregate enrollments across all enrollment tables
    // Each branch returns the same columns:
    //   student_id, student_name, student_email, student_mobile,
    //   item_id, item_title, item_type, enrolled_at, amount_paid, order_status
    const rawResult = await sql<{
      studentId: number;
      studentName: string;
      studentEmail: string | null;
      studentMobile: string | null;
      itemId: number;
      itemTitle: string;
      itemType: string;
      enrolledAt: Date;
      amountPaid: string;
      orderStatus: string | null;
    }>`
      WITH enrollments AS (

        -- 1. mock_test_enrollments
        SELECT
          u.id                                                          AS student_id,
          u.display_name                                                AS student_name,
          u.email                                                       AS student_email,
          u.mobile_number                                               AS student_mobile,
          mt.id                                                         AS item_id,
          mt.title                                                      AS item_title,
          'test'::text                                                  AS item_type,
          mte.enrolled_at                                               AS enrolled_at,
          COALESCE(
            oi.price_at_purchase - COALESCE(oi.discount_amount, 0),
            0
          )                                                             AS amount_paid,
          o.status::text                                                AS order_status
        FROM mock_test_enrollments mte
        INNER JOIN mock_tests mt  ON mt.id = mte.mock_test_id
        INNER JOIN users u        ON u.id  = mte.student_id
        LEFT  JOIN orders o       ON o.id  = mte.order_id
        LEFT  JOIN order_items oi ON oi.order_id = o.id
                                 AND oi.mock_test_id = mte.mock_test_id
        WHERE mt.teacher_id = ${teacherId}
          AND (o.id IS NULL OR o.bundle_id IS NULL)

        UNION ALL

        -- 2. course_enrollments (LATERAL subquery to avoid duplicate rows)
        SELECT
          u.id                                                          AS student_id,
          u.display_name                                                AS student_name,
          u.email                                                       AS student_email,
          u.mobile_number                                               AS student_mobile,
          c.id                                                          AS item_id,
          c.title                                                       AS item_title,
          'course'::text                                                AS item_type,
          ce.enrolled_at                                                AS enrolled_at,
          COALESCE(paid.amount, 0)                                      AS amount_paid,
          paid.order_status                                             AS order_status
        FROM course_enrollments ce
        INNER JOIN courses c      ON c.id  = ce.course_id
        INNER JOIN users u        ON u.id  = ce.student_id
        LEFT JOIN LATERAL (
          SELECT oi.price_at_purchase - COALESCE(oi.discount_amount, 0) AS amount,
             o.status::text AS order_status
FROM order_items oi
INNER JOIN orders o ON o.id = oi.order_id
WHERE o.user_id = ce.student_id
AND o.status IN ('completed', 'refunded')
            AND oi.course_id = ce.course_id
          ORDER BY o.created_at DESC
          LIMIT 1
        ) paid ON true
        WHERE c.teacher_id = ${teacherId}
          AND NOT EXISTS (
            SELECT 1 FROM bundle_enrollments be
            INNER JOIN course_bundle_items cbi ON cbi.bundle_id = be.bundle_id
            WHERE be.student_id = ce.student_id AND cbi.course_id = ce.course_id
          )

        UNION ALL

        -- 3. live_test_enrollments
        SELECT
          u.id                                                          AS student_id,
          u.display_name                                                AS student_name,
          u.email                                                       AS student_email,
          u.mobile_number                                               AS student_mobile,
          lt.id                                                         AS item_id,
          lt.title                                                      AS item_title,
          'live_test'::text                                             AS item_type,
          lte.enrolled_at                                               AS enrolled_at,
          COALESCE(o.total_amount, 0)                                   AS amount_paid,
          o.status::text                                                AS order_status
        FROM live_test_enrollments lte
        INNER JOIN live_tests lt  ON lt.id = lte.live_test_id
        INNER JOIN users u        ON u.id  = lte.student_id
        LEFT  JOIN orders o       ON o.id  = lte.payment_order_id
        WHERE lt.teacher_id = ${teacherId}

        UNION ALL

        -- 4. bundle_enrollments
        SELECT
          u.id                                                          AS student_id,
          u.display_name                                                AS student_name,
          u.email                                                       AS student_email,
          u.mobile_number                                               AS student_mobile,
          cb.id                                                         AS item_id,
          cb.title                                                      AS item_title,
          'bundle'::text                                                AS item_type,
          be.enrolled_at                                                AS enrolled_at,
          COALESCE(
            o.total_amount - COALESCE(o.discount_amount, 0),
            0
          )                                                             AS amount_paid,
          o.status::text                                                AS order_status
        FROM bundle_enrollments be
        INNER JOIN course_bundles cb ON cb.id = be.bundle_id
        INNER JOIN users u           ON u.id  = be.student_id
        LEFT  JOIN orders o          ON o.id  = be.order_id
        WHERE cb.teacher_id = ${teacherId}

        UNION ALL

        -- 5. digital product purchases via order_items (completed/refunded orders only)
        SELECT
          u.id                                                          AS student_id,
          u.display_name                                                AS student_name,
          u.email                                                       AS student_email,
          u.mobile_number                                               AS student_mobile,
          dp.id                                                         AS item_id,
          dp.title                                                      AS item_title,
          'product'::text                                               AS item_type,
          o.created_at                                                  AS enrolled_at,
          oi.price_at_purchase - COALESCE(oi.discount_amount, 0)       AS amount_paid,
          o.status::text                                                AS order_status
        FROM order_items oi
        INNER JOIN orders o          ON o.id  = oi.order_id
        INNER JOIN digital_products dp ON dp.id = oi.digital_product_id
        INNER JOIN users u           ON u.id  = o.user_id
        WHERE oi.digital_product_id IS NOT NULL
          AND o.status IN ('completed', 'refunded')
          AND o.bundle_id IS NULL
          AND dp.teacher_id = ${teacherId}

      )
      SELECT *
      FROM enrollments
      ORDER BY enrolled_at DESC
    `.execute(db);

    const output: OutputType = rawResult.rows.map((row): TeacherStudent => {
      const amountPaid = Number(row.amountPaid) || 0;
      return {
        studentId: Number(row.studentId),
        studentName: row.studentName,
        studentEmail: hasPaidSubscription ? row.studentEmail : null,
        studentMobile: hasPaidSubscription ? row.studentMobile : null,
        itemId: Number(row.itemId),
        itemTitle: row.itemTitle,
        itemType: row.itemType as TeacherStudent["itemType"],
        enrolledAt: row.enrolledAt,
        amountPaid: showAmounts ? amountPaid : 0,
        enrollmentType: amountPaid > 0 ? "paid" : "free",
        orderStatus: row.orderStatus || null,
      };
    });

    console.log(`Fetched ${output.length} enrollment records for teacher ${teacherId}`);

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching teacher's students:", error);
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