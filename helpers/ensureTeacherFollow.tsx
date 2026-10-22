import { Transaction, Kysely } from "kysely";
import { DB } from "./schema";

/**
 * Auto-follow: buying, claiming or attempting a teacher's content is treated
 * as following that teacher. Idempotent through the unique (teacher, student)
 * key. Only students follow, nobody follows themselves, and a student who
 * unfollowed a teacher (teacher_unfollows) stays unfollowed until they follow
 * again by hand.
 */
async function addFollows(
  trx: Transaction<DB> | Kysely<DB>,
  studentId: number,
  teacherIds: number[]
): Promise<void> {
  const candidates = teacherIds.filter((teacherId) => teacherId !== studentId);
  if (candidates.length === 0) return;

  const student = await trx
    .selectFrom("users")
    .select(["role"])
    .where("id", "=", studentId)
    .executeTakeFirst();
  if (student?.role !== "student") return;

  const unfollowed = await trx
    .selectFrom("teacherUnfollows")
    .select(["teacherId"])
    .where("studentId", "=", studentId)
    .where("teacherId", "in", candidates)
    .execute();
  const unfollowedIds = new Set(unfollowed.map((row) => row.teacherId));
  const newFollows = candidates.filter((teacherId) => !unfollowedIds.has(teacherId));
  if (newFollows.length === 0) return;

  await trx
    .insertInto("teacherFollows")
    .values(newFollows.map((teacherId) => ({ teacherId, studentId })))
    .onConflict((oc) => oc.columns(["teacherId", "studentId"]).doNothing())
    .execute();
}

export async function followTeacher(
  trx: Transaction<DB> | Kysely<DB>,
  studentId: number,
  teacherId: number
): Promise<void> {
  await addFollows(trx, studentId, [teacherId]);
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

  await addFollows(trx, studentId, Array.from(teacherIds));
}

/** Follows the teacher behind a test item, for students who attempt it. */
export async function followTeacherForTestItem(
  trx: Transaction<DB> | Kysely<DB>,
  studentId: number,
  testItemId: number
): Promise<void> {
  const test = await trx
    .selectFrom("mockTestItems")
    .innerJoin("mockTests", "mockTests.id", "mockTestItems.packageId")
    .select(["mockTests.teacherId"])
    .where("mockTestItems.id", "=", testItemId)
    .executeTakeFirst();
  if (test) await addFollows(trx, studentId, [test.teacherId]);
}