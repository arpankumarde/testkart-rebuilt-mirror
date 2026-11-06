import { Transaction, sql } from "kysely";
import { DB } from "./schema";
import {
  syncMockTestStudentsEnrolled,
  syncLiveTestEnrolledCount,
  syncDigitalProductTotalPurchases,
} from "./enrollmentCounters";

/**
 * Takes back what a refunded order unlocked. Call inside the refund
 * transaction, after the order is set to refunded.
 *
 * Tests, notes, bundles and live tests carry the order that granted them, so
 * only rows pointing at this order are touched. If another completed order
 * (including a teacher sponsorship) also grants the same item to the same
 * student, the row is re-pointed to that order instead of deleted.
 *
 * Course enrollments carry no order id. One is removed only when it was
 * created at or after this order, the course is paid, and no other completed
 * order grants it. Removing it also removes the student's lesson progress
 * (course_progress cascades).
 *
 * Group lesson seats are cancelled and 1:1 sessions still scheduled are
 * cancelled; the caller emails the 1:1 parties after commit.
 *
 * Test attempts and results are not deleted.
 */

type GrantedItem =
  | { mockTestId: number }
  | { courseId: number }
  | { digitalProductId: number }
  | { bundleId: number };

export type RevokeOrderAccessResult = {
  removed: number;
  kept: number;
  cancelledBookingIds: number[];
};

export async function revokeOrderAccess(
  trx: Transaction<DB>,
  orderId: number
): Promise<RevokeOrderAccessResult> {
  const order = await trx
    .selectFrom("orders")
    .select(["id", "userId", "bundleId", "createdAt"])
    .where("id", "=", orderId)
    .executeTakeFirstOrThrow();

  const sponsorship = await trx
    .selectFrom("teacherSponsoredEnrollments")
    .select("studentId")
    .where("orderId", "=", orderId)
    .executeTakeFirst();
  const beneficiaryId = sponsorship?.studentId ?? order.userId;

  let removed = 0;
  let kept = 0;
  const mockTestIds: number[] = [];
  const liveTestIds: number[] = [];
  const productIds: number[] = [];

  const tests = await trx
    .selectFrom("mockTestEnrollments")
    .select(["id", "studentId", "mockTestId"])
    .where("orderId", "=", orderId)
    .execute();
  for (const row of tests) {
    mockTestIds.push(row.mockTestId);
    const other = await findOtherGrantingOrder(trx, row.studentId, orderId, { mockTestId: row.mockTestId });
    if (other) {
      await trx.updateTable("mockTestEnrollments").set({ orderId: other }).where("id", "=", row.id).execute();
      kept++;
    } else {
      await trx.deleteFrom("mockTestEnrollments").where("id", "=", row.id).execute();
      removed++;
    }
  }

  const notes = await trx
    .selectFrom("digitalProductPurchases")
    .select(["id", "studentId", "productId"])
    .where("orderId", "=", orderId)
    .execute();
  for (const row of notes) {
    productIds.push(row.productId);
    const other = await findOtherGrantingOrder(trx, row.studentId, orderId, { digitalProductId: row.productId });
    if (other) {
      await trx.updateTable("digitalProductPurchases").set({ orderId: other }).where("id", "=", row.id).execute();
      kept++;
    } else {
      await trx.deleteFrom("digitalProductPurchases").where("id", "=", row.id).execute();
      removed++;
    }
  }

  const bundles = await trx
    .selectFrom("bundleEnrollments")
    .select(["id", "studentId", "bundleId"])
    .where("orderId", "=", orderId)
    .execute();
  for (const row of bundles) {
    const other = await findOtherGrantingOrder(trx, row.studentId, orderId, { bundleId: row.bundleId });
    if (other) {
      await trx.updateTable("bundleEnrollments").set({ orderId: other }).where("id", "=", row.id).execute();
      kept++;
    } else {
      await trx.deleteFrom("bundleEnrollments").where("id", "=", row.id).execute();
      removed++;
    }
  }

  const liveTests = await trx
    .selectFrom("liveTestEnrollments")
    .innerJoin("liveTests", "liveTests.id", "liveTestEnrollments.liveTestId")
    .select(["liveTestEnrollments.id", "liveTestEnrollments.studentId", "liveTestEnrollments.liveTestId", "liveTests.mockTestId"])
    .where("liveTestEnrollments.paymentOrderId", "=", orderId)
    .execute();
  for (const row of liveTests) {
    liveTestIds.push(row.liveTestId);
    const other =
      row.mockTestId !== null
        ? await findOtherGrantingOrder(trx, row.studentId, orderId, { mockTestId: row.mockTestId })
        : null;
    if (other) {
      await trx.updateTable("liveTestEnrollments").set({ paymentOrderId: other }).where("id", "=", row.id).execute();
      kept++;
    } else {
      await trx.deleteFrom("liveTestEnrollments").where("id", "=", row.id).execute();
      removed++;
    }
  }

  const itemCourses = await trx
    .selectFrom("orderItems")
    .select("courseId")
    .where("orderId", "=", orderId)
    .where("courseId", "is not", null)
    .execute();
  const bundleCourses = order.bundleId
    ? await trx
        .selectFrom("courseBundleItems")
        .select("courseId")
        .where("bundleId", "=", order.bundleId)
        .where("courseId", "is not", null)
        .execute()
    : [];
  const courseIds = [...new Set([...itemCourses, ...bundleCourses].map((r) => r.courseId!))];
  if (courseIds.length > 0) {
    const enrollments = await trx
      .selectFrom("courseEnrollments")
      .innerJoin("courses", "courses.id", "courseEnrollments.courseId")
      .select(["courseEnrollments.id", "courseEnrollments.courseId", "courseEnrollments.enrolledAt", "courses.price"])
      .where("courseEnrollments.studentId", "=", beneficiaryId)
      .where("courseEnrollments.courseId", "in", courseIds)
      .execute();
    for (const row of enrollments) {
      const predatesOrder =
        row.enrolledAt !== null && order.createdAt !== null && new Date(row.enrolledAt) < new Date(order.createdAt);
      if (Number(row.price) <= 0 || predatesOrder) {
        kept++;
        continue;
      }
      const other = await findOtherGrantingOrder(trx, beneficiaryId, orderId, { courseId: row.courseId });
      if (other) {
        kept++;
        continue;
      }
      await trx.deleteFrom("courseEnrollments").where("id", "=", row.id).execute();
      removed++;
    }
  }

  const seats = await trx
    .selectFrom("groupLessonEnrollments")
    .select(["id", "groupLessonId"])
    .where("orderId", "=", orderId)
    .where("status", "=", "enrolled")
    .execute();
  for (const seat of seats) {
    const lesson = await trx
      .selectFrom("groupLessons")
      .select(["id", "enrolledCount", "status"])
      .where("id", "=", seat.groupLessonId)
      .forUpdate()
      .executeTakeFirst();
    await trx
      .updateTable("groupLessonEnrollments")
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where("id", "=", seat.id)
      .execute();
    if (lesson && lesson.status === "scheduled") {
      await trx
        .updateTable("groupLessons")
        .set({ enrolledCount: Math.max(0, lesson.enrolledCount - 1) })
        .where("id", "=", lesson.id)
        .execute();
    }
    removed++;
  }

  const bookings = await trx
    .updateTable("mentorshipBookings")
    .set({
      status: "cancelled",
      cancellationReason: "Order refunded",
      cancelledAt: new Date(),
      cancelledBy: "admin",
      updatedAt: new Date(),
    })
    .where("orderId", "=", orderId)
    .where("status", "=", "scheduled")
    .returning("id")
    .execute();
  removed += bookings.length;

  await syncMockTestStudentsEnrolled(mockTestIds, trx);
  await syncLiveTestEnrolledCount(liveTestIds, trx);
  await syncDigitalProductTotalPurchases(productIds, trx);

  return { removed, kept, cancelledBookingIds: bookings.map((b) => b.id) };
}

async function findOtherGrantingOrder(
  trx: Transaction<DB>,
  studentId: number,
  excludeOrderId: number,
  item: GrantedItem
): Promise<number | null> {
  const row = await trx
    .selectFrom("orders as o")
    .leftJoin("teacherSponsoredEnrollments as tse", "tse.orderId", "o.id")
    .select("o.id")
    .where("o.status", "=", "completed")
    .where("o.id", "!=", excludeOrderId)
    .where(sql<boolean>`coalesce(tse.student_id, o.user_id) = ${studentId}`)
    .where(grantsItem(item))
    .orderBy("o.id", "desc")
    .executeTakeFirst();
  return row?.id ?? null;
}

function grantsItem(item: GrantedItem) {
  if ("bundleId" in item) return sql<boolean>`o.bundle_id = ${item.bundleId}`;
  const [column, id] =
    "mockTestId" in item
      ? ["mock_test_id", item.mockTestId]
      : "courseId" in item
        ? ["course_id", item.courseId]
        : ["digital_product_id", item.digitalProductId];
  return sql<boolean>`(
    exists (select 1 from order_items oi where oi.order_id = o.id and oi.${sql.raw(column)} = ${id})
    or exists (select 1 from course_bundle_items cbi where cbi.bundle_id = o.bundle_id and cbi.${sql.raw(column)} = ${id})
  )`;
}
