import { sql } from "kysely";

/**
 * True when order `o` holds any of the teacher's items or is one of their
 * bundles. Use inside a query that aliases orders as `o`.
 */
export const orderHasTeacherContentSql = (teacherId: number) => sql`(
  EXISTS (
    SELECT 1 FROM order_items oi
    LEFT JOIN mock_tests mt ON mt.id = oi.mock_test_id
    LEFT JOIN courses c ON c.id = oi.course_id
    LEFT JOIN digital_products dp ON dp.id = oi.digital_product_id
    WHERE oi.order_id = o.id
      AND (mt.teacher_id = ${teacherId} OR c.teacher_id = ${teacherId} OR dp.teacher_id = ${teacherId})
  )
  OR EXISTS (SELECT 1 FROM course_bundles cb WHERE cb.id = o.bundle_id AND cb.teacher_id = ${teacherId})
)`;

/** Orders with money to pay: free claims and teacher-sponsored enrolments are not payment attempts. */
export const paidAttemptSql = sql`(
  o.total_amount > 0 AND (o.payment_method IS NULL OR o.payment_method <> 'teacher_sponsored')
)`;