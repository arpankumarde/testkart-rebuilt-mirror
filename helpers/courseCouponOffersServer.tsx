import { sql, type Kysely, type Transaction } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import { countPromoCodeUses, HELD_ORDER_STATUSES, promoCodeUsesSql } from "./promoCodeUsage";
import {
  bestCourseCouponOffer,
  bestItemCouponOffer,
  rankCartAutoCoupons,
  type CartAutoCoupon,
  type CartOfferLine,
  type CourseCouponCandidate,
  type CourseCouponOffer,
} from "./courseCouponOffer";

type Executor = Kysely<DB> | Transaction<DB>;

/**
 * Held until commit, so two checkouts cannot both take the last use of a
 * coupon: the second waits, then counts the first one's use. The wait is
 * capped, so a stuck checkout fails the next one fast instead of hanging it;
 * the cap is lifted again for the rest of the transaction.
 */
export async function lockPromoCode(trx: Transaction<DB>, promoCodeId: number): Promise<void> {
  await sql`SET LOCAL lock_timeout = '10s'`.execute(trx);
  try {
    await sql`SELECT pg_advisory_xact_lock(hashtext('promo_code'), ${promoCodeId}::int)`.execute(trx);
  } catch (error) {
    console.error(`Timed out waiting for the lock on promo code ${promoCodeId}:`, error);
    throw new Error("This coupon is busy with another checkout. Please try again in a moment.");
  }
  await sql`SET LOCAL lock_timeout = DEFAULT`.execute(trx);
}

/**
 * Teacher coupons that can apply to these teachers' courses and study notes on
 * their own: public, active, inside their dates, scoped to all items, courses
 * or study notes, under their usage limit, and (for a known student) under the
 * per-student limit. Private codes stay manual, and Spin & Win and admin codes
 * are never automatic.
 */
export async function loadAutoCouponCandidates(
  executor: Executor,
  teacherIds: number[],
  userId?: number | null
): Promise<CourseCouponCandidate[]> {
  const ids = [...new Set(teacherIds)];
  if (ids.length === 0) return [];

  const now = new Date();
  const rows = await executor
    .selectFrom("promoCodes")
    .selectAll()
    .select(promoCodeUsesSql().as("usesHeld"))
    .where("createdByTeacherId", "in", ids)
    .where("isPublic", "=", true)
    .where("isActive", "=", true)
    .where("appliesTo", "in", ["all", "courses", "digital_products"])
    .where("validFrom", "<=", now)
    .where((eb) => eb.or([eb("validUntil", "is", null), eb("validUntil", ">", now)]))
    .where((eb) => eb.not(eb.exists(eb.selectFrom("spinCoupons").select("spinCoupons.id").whereRef("spinCoupons.promoCodeId", "=", "promoCodes.id"))))
    .orderBy("id", "asc")
    .execute();

  let open = rows.filter((row) => row.usageLimit === null || Number(row.usesHeld) < row.usageLimit);

  if (userId && open.some((row) => row.perUserLimit !== null)) {
    const mine = await executor
      .selectFrom("promoCodeUsages")
      .leftJoin("orders", "orders.id", "promoCodeUsages.orderId")
      .select(["promoCodeUsages.promoCodeId", (eb) => eb.fn.countAll<string>().as("uses")])
      .where("promoCodeUsages.userId", "=", userId)
      .where("promoCodeUsages.promoCodeId", "in", open.map((row) => row.id))
      .where((eb) => eb.or([eb("promoCodeUsages.orderId", "is", null), eb("orders.status", "in", [...HELD_ORDER_STATUSES])]))
      .groupBy("promoCodeUsages.promoCodeId")
      .execute();
    const usesByCode = new Map(mine.map((m) => [m.promoCodeId, Number(m.uses)]));
    open = open.filter((row) => row.perUserLimit === null || (usesByCode.get(row.id) ?? 0) < row.perUserLimit);
  }

  return open.map((row) => ({
    id: row.id,
    code: row.code,
    discountType: row.discountType,
    discountValue: parseFloat(row.discountValue),
    minPurchaseAmount: row.minPurchaseAmount === null ? null : parseFloat(row.minPurchaseAmount),
    maxDiscountAmount: row.maxDiscountAmount === null ? null : parseFloat(row.maxDiscountAmount),
    appliesTo: row.appliesTo,
    targetItemIds: row.targetItemIds,
    createdByTeacherId: row.createdByTeacherId as number,
    validUntil: row.validUntil,
  }));
}

/**
 * The automatic offer on each course, keyed by course id. Prices are read from
 * the courses table, so callers only pass ids. With a userId, codes the student
 * has used up are left out, so the price shown matches what checkout charges.
 */
export async function loadCourseCouponOffers(
  courseIds: number[],
  options: { userId?: number | null; executor?: Executor } = {}
): Promise<Map<number, CourseCouponOffer>> {
  const offers = new Map<number, CourseCouponOffer>();
  const ids = [...new Set(courseIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return offers;
  const executor = options.executor ?? db;

  const courses = await executor
    .selectFrom("courses")
    .select(["id", "teacherId", "price", "discountPrice"])
    .where("id", "in", ids)
    .execute();
  const candidates = await loadAutoCouponCandidates(
    executor,
    courses.map((c) => c.teacherId),
    options.userId
  );
  if (candidates.length === 0) return offers;

  for (const course of courses) {
    const offer = bestCourseCouponOffer(candidates, course);
    if (offer) offers.set(course.id, offer);
  }
  return offers;
}

/**
 * The automatic offer on each study note, keyed by note id. Same rules as
 * loadCourseCouponOffers: prices come from the table, and with a userId codes
 * the student has used up are left out.
 */
export async function loadDigitalProductCouponOffers(
  productIds: number[],
  options: { userId?: number | null; executor?: Executor } = {}
): Promise<Map<number, CourseCouponOffer>> {
  const offers = new Map<number, CourseCouponOffer>();
  const ids = [...new Set(productIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return offers;
  const executor = options.executor ?? db;

  const products = await executor
    .selectFrom("digitalProducts")
    .select(["id", "teacherId", "price", "discountPrice"])
    .where("id", "in", ids)
    .execute();
  const candidates = await loadAutoCouponCandidates(
    executor,
    products.map((p) => p.teacherId),
    options.userId
  );
  if (candidates.length === 0) return offers;

  for (const product of products) {
    const offer = bestItemCouponOffer(candidates, "digitalProduct", product);
    if (offer) offers.set(product.id, offer);
  }
  return offers;
}

/** Adds couponOffer to each course row. `idOf` picks the course id when the row's own id is not it. */
export async function withCourseCouponOffers<T>(
  rows: T[],
  options: { userId?: number | null; idOf?: (row: T) => number | null | undefined } = {}
): Promise<Array<T & { couponOffer: CourseCouponOffer | null }>> {
  const idOf = options.idOf ?? ((row: T) => (row as { id?: number }).id);
  const offers = await loadCourseCouponOffers(
    rows.map((row) => idOf(row)).filter((id): id is number => typeof id === "number"),
    { userId: options.userId }
  );
  return rows.map((row) => {
    const id = idOf(row);
    return { ...row, couponOffer: typeof id === "number" ? offers.get(id) ?? null : null };
  });
}

/**
 * Automatic-offer candidates for a cart's course and study note lines.
 * Read-only for the cart preview; with `trx` (checkout) every candidate is
 * locked and its limits recounted under the lock, so concurrent purchases
 * never overrun a usage limit.
 */
export async function loadCartAutoCandidates(
  input: { userId: number; lines: CartOfferLine[]; trx?: Transaction<DB> }
): Promise<CourseCouponCandidate[]> {
  const executor: Executor = input.trx ?? db;
  const lines = input.lines.filter((l) => l.price > 0);
  if (lines.length === 0) return [];

  const candidates = await loadAutoCouponCandidates(
    executor,
    lines.map((l) => l.teacherId).filter((id): id is number => id !== null),
    input.userId
  );
  const useful = candidates.filter((c) => rankCartAutoCoupons([c], lines).length > 0);
  if (!input.trx) return useful;

  // Locks go in id order, so two checkouts never wait on each other in a cycle.
  for (const id of useful.map((c) => c.id).sort((a, b) => a - b)) {
    await lockPromoCode(input.trx, id);
  }
  const open: CourseCouponCandidate[] = [];
  for (const candidate of useful) {
    const terms = await input.trx
      .selectFrom("promoCodes")
      .select(["usageLimit", "perUserLimit", "isActive"])
      .where("id", "=", candidate.id)
      .executeTakeFirst();
    if (!terms?.isActive) continue;
    if (terms.usageLimit !== null && (await countPromoCodeUses(input.trx, candidate.id)) >= terms.usageLimit) continue;
    if (terms.perUserLimit !== null && (await countPromoCodeUses(input.trx, candidate.id, input.userId)) >= terms.perUserLimit) continue;
    open.push(candidate);
  }
  return open;
}

/** Thrown when the offers the student saw at the cart are no longer the ones checkout would apply. */
export const AUTO_OFFER_CHANGED_MESSAGE =
  "The automatic offer on your cart has changed or ended. Review the updated price and try again.";

/**
 * Checkout guard. `expectedPromoCodeIds` are the automatic offers the cart
 * showed. Losing or swapping one stops checkout so the student sees the new
 * price first; gaining one just charges less. Older clients send nothing.
 */
export function assertAutoOffersUnchanged(expectedPromoCodeIds: number[] | undefined, resolved: CartAutoCoupon[]): void {
  const expected = (expectedPromoCodeIds ?? []).filter((id) => id > 0);
  if (expected.length === 0) return;
  const applied = new Set(resolved.map((offer) => offer.promoCodeId));
  if (expected.some((id) => !applied.has(id))) {
    throw new Error(AUTO_OFFER_CHANGED_MESSAGE);
  }
}
