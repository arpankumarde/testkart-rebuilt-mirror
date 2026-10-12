import { Transaction, Kysely } from "kysely";
import { DB } from "./schema";

/**
 * Creates a follow from a student to a teacher as a side effect of
 * enrollment - buying or claiming any of a teacher's content is treated as
 * an implicit "follow" signal. Idempotent: a student who already follows
 * (or later unfollows) is left alone, this never re-adds a follow someone
 * deliberately removed on a SECOND purchase from the same teacher, only on
 * the very first insert does it establish the relationship.
 */
export async function followTeacher(
  trx: Transaction<DB> | Kysely<DB>,
  studentId: number,
  teacherId: number
): Promise<void> {
  await trx
    .insertInto("teacherFollows")
    .values({ teacherId, studentId })
    .onConflict((oc) => oc.columns(["teacherId", "studentId"]).doNothing())
    .execute();
}

/**
 * Same as followTeacher, but resolves every teacher behind an order in one
 * shot: each orderItem's course/digitalProduct/mockTest (mockTestId also
 * covers live tests, which are purchased as a mockTests row) plus the
 * order's bundle, if any. Safe to call on every order completion path -
 * ensureOrderCompletionSideEffects runs this on every completed order, and
 * the free-enrollment endpoints that create their own order call it too.
 */
export async function followTeachersForOrder(
  trx: Transaction<DB> | Kysely<DB>,
  orderId: number,
  bundleId: number | null,
  studentId: number
): Promise<void> {
  const itemRows = await trx
    .selectFrom("orderItems")
    .leftJoin("courses", "courses.id", "orderItems.courseId")
    .leftJoin("digitalProducts", "digitalProducts.id", "orderItems.digitalProductId")
    .leftJoin("mockTests", "mockTests.id", "orderItems.mockTestId")
    .select(["courses.teacherId as courseTeacherId", "digitalProducts.teacherId as productTeacherId", "mockTests.teacherId as testTeacherId"])
    .where("orderItems.orderId", "=", orderId)
    .execute();

  const teacherIds = new Set<number>();
  for (const row of itemRows) {
    if (row.courseTeacherId != null) teacherIds.add(row.courseTeacherId);
    if (row.productTeacherId != null) teacherIds.add(row.productTeacherId);
    if (row.testTeacherId != null) teacherIds.add(row.testTeacherId);
  }

  if (bundleId != null) {
    const bundle = await trx
      .selectFrom("courseBundles")
      .select(["teacherId"])
      .where("id", "=", bundleId)
      .executeTakeFirst();
    if (bundle) teacherIds.add(bundle.teacherId);
  }

  if (teacherIds.size === 0) return;

  await trx
    .insertInto("teacherFollows")
    .values(Array.from(teacherIds).map((teacherId) => ({ teacherId, studentId })))
    .onConflict((oc) => oc.columns(["teacherId", "studentId"]).doNothing())
    .execute();
}
