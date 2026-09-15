import { Kysely, Transaction, sql } from "kysely";
import { DB } from "./schema";
import { db } from "./db";

/**
 * `mock_tests.students_enrolled`, `live_tests.enrolled_count` and
 * `digital_products.total_purchases` are denormalised COUNTERS, not counts.
 * Every purchase path bumps them with `+ 1`; nothing recomputes them. They
 * drift, in both directions:
 *
 *  - DOWN, because `mock_test_enrollments` / `live_test_enrollments` /
 *    `digital_product_purchases` all cascade off `users`, so closing an
 *    account silently removes the rows and leaves the counter untouched;
 *    and because a hand-made enrollment (support inserting a row directly)
 *    never runs an increment.
 *  - UP, because a refund used to decrement the counter without removing the
 *    enrollment row, and because a bundle increments once per bundle item
 *    even when the student already owned that item and the insert was a
 *    no-op.
 *
 * The consequence that matters is that a counter reading 0 against live
 * enrollments lets an irreversible delete through. So: **never gate a
 * destructive action on the counter.** Ask the enrollment table with the
 * `count*` helpers below, the way `endpoints/teacher/products/delete_POST.ts`
 * always has. The counter stays as the cheap number to *display*.
 *
 * The `sync*` helpers put a counter back in step with its rows. Call one
 * wherever rows can disappear behind the counter's back.
 */

export type DbExecutor = Kysely<DB> | Transaction<DB>;

/** Live count of the rows that actually grant access to a test package. */
export async function countMockTestEnrollments(
  mockTestId: number,
  executor: DbExecutor = db
): Promise<number> {
  const row = await executor
    .selectFrom("mockTestEnrollments")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("mockTestId", "=", mockTestId)
    .executeTakeFirst();

  return Number(row?.count ?? 0);
}

/** Live count of the students registered for a live test. */
export async function countLiveTestEnrollments(
  liveTestId: number,
  executor: DbExecutor = db
): Promise<number> {
  const row = await executor
    .selectFrom("liveTestEnrollments")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("liveTestId", "=", liveTestId)
    .executeTakeFirst();

  return Number(row?.count ?? 0);
}

/** Live count of the purchases of a digital product. */
export async function countDigitalProductPurchases(
  productId: number,
  executor: DbExecutor = db
): Promise<number> {
  const row = await executor
    .selectFrom("digitalProductPurchases")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("productId", "=", productId)
    .executeTakeFirst();

  return Number(row?.count ?? 0);
}

/**
 * Recompute `mock_tests.students_enrolled` from `mock_test_enrollments` for
 * the given packages. `updated_at` is deliberately left alone — correcting a
 * derived counter is not a content edit, and `updated_at` drives sitemap
 * lastmod.
 */
export async function syncMockTestStudentsEnrolled(
  mockTestIds: number[],
  executor: DbExecutor = db
): Promise<void> {
  const ids = dedupe(mockTestIds);
  if (ids.length === 0) return;

  await sql`
    UPDATE mock_tests AS m
       SET students_enrolled = c.n
      FROM (
        SELECT t.id AS id, count(e.id)::int AS n
          FROM mock_tests t
          LEFT JOIN mock_test_enrollments e ON e.mock_test_id = t.id
         WHERE t.id IN (${sql.join(ids)})
         GROUP BY t.id
      ) AS c
     WHERE m.id = c.id
       AND m.students_enrolled IS DISTINCT FROM c.n
  `.execute(executor);
}

/** Recompute `live_tests.enrolled_count` from `live_test_enrollments`. */
export async function syncLiveTestEnrolledCount(
  liveTestIds: number[],
  executor: DbExecutor = db
): Promise<void> {
  const ids = dedupe(liveTestIds);
  if (ids.length === 0) return;

  await sql`
    UPDATE live_tests AS l
       SET enrolled_count = c.n
      FROM (
        SELECT t.id AS id, count(e.id)::int AS n
          FROM live_tests t
          LEFT JOIN live_test_enrollments e ON e.live_test_id = t.id
         WHERE t.id IN (${sql.join(ids)})
         GROUP BY t.id
      ) AS c
     WHERE l.id = c.id
       AND l.enrolled_count IS DISTINCT FROM c.n
  `.execute(executor);
}

/** Recompute `digital_products.total_purchases` from `digital_product_purchases`. */
export async function syncDigitalProductTotalPurchases(
  productIds: number[],
  executor: DbExecutor = db
): Promise<void> {
  const ids = dedupe(productIds);
  if (ids.length === 0) return;

  await sql`
    UPDATE digital_products AS d
       SET total_purchases = c.n
      FROM (
        SELECT p.id AS id, count(pu.id)::int AS n
          FROM digital_products p
          LEFT JOIN digital_product_purchases pu ON pu.product_id = p.id
         WHERE p.id IN (${sql.join(ids)})
         GROUP BY p.id
      ) AS c
     WHERE d.id = c.id
       AND d.total_purchases IS DISTINCT FROM c.n
  `.execute(executor);
}

/**
 * Everything a single student's rows can be counted into, resolved BEFORE the
 * rows are removed. Closing an account cascades those rows away, so the ids
 * have to be captured first — afterwards there is nothing left to join on.
 */
export type StudentCounterTargets = {
  mockTestIds: number[];
  liveTestIds: number[];
  digitalProductIds: number[];
};

export async function collectStudentCounterTargets(
  studentId: number,
  executor: DbExecutor = db
): Promise<StudentCounterTargets> {
  const [mockTests, liveTests, products] = await Promise.all([
    executor
      .selectFrom("mockTestEnrollments")
      .select("mockTestId")
      .where("studentId", "=", studentId)
      .execute(),
    executor
      .selectFrom("liveTestEnrollments")
      .select("liveTestId")
      .where("studentId", "=", studentId)
      .execute(),
    executor
      .selectFrom("digitalProductPurchases")
      .select("productId")
      .where("studentId", "=", studentId)
      .execute(),
  ]);

  return {
    mockTestIds: mockTests.map((r) => r.mockTestId),
    liveTestIds: liveTests.map((r) => r.liveTestId),
    digitalProductIds: products.map((r) => r.productId),
  };
}

/** Re-sync every counter the given targets touch. Safe to call with empty lists. */
export async function syncStudentCounterTargets(
  targets: StudentCounterTargets,
  executor: DbExecutor = db
): Promise<void> {
  await syncMockTestStudentsEnrolled(targets.mockTestIds, executor);
  await syncLiveTestEnrolledCount(targets.liveTestIds, executor);
  await syncDigitalProductTotalPurchases(targets.digitalProductIds, executor);
}

function dedupe(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id)))];
}
