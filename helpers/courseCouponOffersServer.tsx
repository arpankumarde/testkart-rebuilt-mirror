import { sql, type Kysely, type Transaction } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import { countPromoCodeUses, HELD_ORDER_STATUSES, promoCodeUsesSql } from "./promoCodeUsage";
import {
  bestCourseCouponOffer,
  rankCartCourseCoupons,
  type CartAutoCoupon,
  type CartCourseLine,
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
 * Teacher coupons that can apply to these teachers' courses on their own:
 * public, active, inside their dates, scoped to all items or to courses, under
 * their usage limit, and (for a known student) under the per-student limit.
 * Private codes stay manual, and Spin & Win and admin codes are never automatic.
 */
export async function loadCourseCouponCandidates(
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
    .where("appliesTo", "in", ["all", "courses"])
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
  const candidates = await loadCourseCouponCandidates(
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

/** Course lines of a cart row set as the checkout endpoints select it. */
export function cartCourseLines(
  items: Array<{ courseId: number | null; courseTeacherId: number | null; coursePrice: string | number | null }>
): CartCourseLine[] {
  return items
    .filter((item) => item.courseId !== null)
    .map((item) => ({
      courseId: item.courseId as number,
      teacherId: item.courseTeacherId,
      price: parseFloat(String(item.coursePrice ?? 0)) || 0,
    }));
}

/**
 * The automatic offer for a cart. Read-only for the cart preview; with `trx`
 * (checkout) each candidate is locked and its limits recounted before it is
 * taken, so concurrent purchases never overrun a usage limit.
 */
export async function resolveCartAutoCoupon(
  input: { userId: number; lines: CartCourseLine[]; trx?: Transaction<DB> }
): Promise<CartAutoCoupon | null> {
  const executor: Executor = input.trx ?? db;
  const lines = input.lines.filter((l) => l.price > 0);
  if (lines.length === 0) return null;

  const candidates = await loadCourseCouponCandidates(
    executor,
    lines.map((l) => l.teacherId).filter((id): id is number => id !== null),
    input.userId
  );
  const ranked = rankCartCourseCoupons(candidates, lines);
  if (!input.trx) return ranked[0] ?? null;

  // Locks go in id order whatever the ranking, so two checkouts never wait on each other in a cycle.
  for (const id of ranked.map((offer) => offer.promoCodeId).sort((a, b) => a - b)) {
    await lockPromoCode(input.trx, id);
  }
  const byId = new Map(candidates.map((c) => [c.id, c]));
  for (const offer of ranked) {
    const terms = await input.trx
      .selectFrom("promoCodes")
      .select(["usageLimit", "perUserLimit", "isActive"])
      .where("id", "=", offer.promoCodeId)
      .executeTakeFirst();
    if (!terms?.isActive || !byId.has(offer.promoCodeId)) continue;
    if (terms.usageLimit !== null && (await countPromoCodeUses(input.trx, offer.promoCodeId)) >= terms.usageLimit) continue;
    if (terms.perUserLimit !== null && (await countPromoCodeUses(input.trx, offer.promoCodeId, input.userId)) >= terms.perUserLimit) continue;
    return offer;
  }
  return null;
}

/** Thrown when the offer the student saw at the cart is no longer the one checkout would apply. */
export const AUTO_OFFER_CHANGED_MESSAGE =
  "The automatic offer on your cart has changed or ended. Review the updated price and try again.";

/**
 * Checkout guard. `expectedPromoCodeId` is the automatic offer the cart showed
 * (0 for none). Losing or swapping the offer stops checkout so the student sees
 * the new price first; gaining one just charges less. Older clients send nothing.
 */
export function assertAutoOfferUnchanged(expectedPromoCodeId: number | null | undefined, resolved: CartAutoCoupon | null): void {
  if (!expectedPromoCodeId) return;
  if (resolved?.promoCodeId !== expectedPromoCodeId) {
    throw new Error(AUTO_OFFER_CHANGED_MESSAGE);
  }
}
