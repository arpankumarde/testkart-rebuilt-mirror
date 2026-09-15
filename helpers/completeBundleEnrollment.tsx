import { db } from "./db";
import { sql, Transaction } from "kysely";
import { DB } from "./schema";

/**
 * Creates bundle enrollment and enrollments for all items within the bundle.
 * This is designed to be called within an existing db transaction.
 * 
 * The function:
 * 1. Checks if a bundleEnrollments record already exists for this student+bundle
 * 2. If not, creates the bundleEnrollments record
 * 3. Fetches all courseBundleItems for the bundle
 * 4. For each item: creates the appropriate enrollment (mockTestEnrollments, courseEnrollments, digitalProductPurchases)
 * 5. Increments studentsEnrolled/totalPurchases counters for the bundle items
 */
export async function completeBundleEnrollment(
  trx: Transaction<DB>,
  bundleId: number,
  studentId: number,
  orderId: number
): Promise<void> {
  console.log(`[completeBundleEnrollment] Processing bundle ${bundleId} for student ${studentId}, order ${orderId}`);

  // 1. Check if bundle enrollment already exists (no unique constraint on studentId+bundleId, so check manually)
  const existingBundleEnrollment = await trx
    .selectFrom("bundleEnrollments")
    .select("id")
    .where("studentId", "=", studentId)
    .where("bundleId", "=", bundleId)
    .executeTakeFirst();

  if (existingBundleEnrollment) {
    console.log(`[completeBundleEnrollment] Bundle enrollment already exists for student ${studentId}, bundle ${bundleId}`);
    return;
  }

  // 2. Create bundle enrollment record
  await trx
    .insertInto("bundleEnrollments")
    .values({
      bundleId,
      studentId,
      orderId,
      enrolledAt: new Date(),
    })
    .execute();

  console.log(`[completeBundleEnrollment] Created bundle enrollment for student ${studentId}, bundle ${bundleId}`);

  // 3. Fetch all items in the bundle
  const bundleItems = await trx
    .selectFrom("courseBundleItems")
    .select(["id", "itemType", "mockTestId", "courseId", "digitalProductId"])
    .where("bundleId", "=", bundleId)
    .execute();

  if (bundleItems.length === 0) {
    console.log(`[completeBundleEnrollment] No items found in bundle ${bundleId}`);
    return;
  }

  // Separate items by type
  const mockTestIds = bundleItems
    .filter(item => item.itemType === "test" && item.mockTestId !== null)
    .map(item => item.mockTestId!);

  const courseIds = bundleItems
    .filter(item => item.itemType === "course" && item.courseId !== null)
    .map(item => item.courseId!);

  const digitalProductIds = bundleItems
    .filter(item => item.itemType === "digital_product" && item.digitalProductId !== null)
    .map(item => item.digitalProductId!);

  // 4. Create enrollments for each item type
  const enrollmentPromises: Promise<unknown>[] = [];

  // Mock test enrollments.
  // `returning` reports only the rows the insert actually created — the
  // onConflict branch yields nothing. The counter increment below keys off
  // that, because a student who already owned one of the bundle's tests must
  // not be counted into it twice.
  let insertedMockTestIds: number[] = [];

  if (mockTestIds.length > 0) {
    enrollmentPromises.push(
      trx
        .insertInto("mockTestEnrollments")
        .values(
          mockTestIds.map(mockTestId => ({
            studentId,
            mockTestId,
            orderId,
            enrolledAt: new Date(),
          }))
        )
        .onConflict((oc) => oc.columns(["mockTestId", "studentId"]).doNothing())
        .returning("mockTestId")
        .execute()
        .then((rows) => {
          insertedMockTestIds = rows.map((r) => r.mockTestId);
        })
    );
  }

  // Course enrollments
  if (courseIds.length > 0) {
    enrollmentPromises.push(
      trx
        .insertInto("courseEnrollments")
        .values(
          courseIds.map(courseId => ({
            studentId,
            courseId,
            enrolledAt: new Date(),
          }))
        )
        .onConflict((oc) => oc.columns(["studentId", "courseId"]).doNothing())
        .execute()
    );
  }

  // Digital product purchases (same "count only what was inserted" rule)
  let insertedDigitalProductIds: number[] = [];

  if (digitalProductIds.length > 0) {
    enrollmentPromises.push(
      trx
        .insertInto("digitalProductPurchases")
        .values(
          digitalProductIds.map(productId => ({
            studentId,
            productId,
            orderId,
            purchasedAt: new Date(),
          }))
        )
        .onConflict((oc) => oc.columns(["studentId", "productId"]).doNothing())
        .returning("productId")
        .execute()
        .then((rows) => {
          insertedDigitalProductIds = rows.map((r) => r.productId);
        })
    );
  }

  await Promise.all(enrollmentPromises);

  // 5. Increment counters
  const counterPromises: Promise<unknown>[] = [];

  // Only the enrollments this call actually created, not every item in the
  // bundle — incrementing for an item the student already owned is one of the
  // ways students_enrolled/total_purchases drift above the real row count.
  if (insertedMockTestIds.length > 0) {
    counterPromises.push(
      trx
        .updateTable("mockTests")
        .set({ studentsEnrolled: sql`students_enrolled + 1` })
        .where("id", "in", insertedMockTestIds)
        .execute()
    );
  }

  if (insertedDigitalProductIds.length > 0) {
    counterPromises.push(
      trx
        .updateTable("digitalProducts")
        .set({ totalPurchases: sql`COALESCE(total_purchases, 0) + 1` })
        .where("id", "in", insertedDigitalProductIds)
        .execute()
    );
  }

  await Promise.all(counterPromises);

  console.log(`[completeBundleEnrollment] Completed bundle enrollment for bundle ${bundleId}: ${mockTestIds.length} tests, ${courseIds.length} courses, ${digitalProductIds.length} digital products`);
}