import { sql, type Kysely, type Selectable, type Transaction } from "kysely";
import { db } from "./db";
import type { DB, PromoCodes } from "./schema";
import { countPromoCodeUses, HELD_ORDER_STATUSES, promoCodeUsesSql } from "./promoCodeUsage";
import { loadCartAutoCandidates, lockPromoCode } from "./courseCouponOffersServer";
import { isAutoOfferKind, type CartOfferLine } from "./courseCouponOffer";
import {
  lineKey,
  priceCouponStack,
  type ChosenCoupon,
  type StackedCoupons,
  type StackLine,
  type StackPromo,
} from "./cartCouponStack";
import { applySpinCouponOrThrow, getSpinCouponRuleOrThrow, type AppliedSpinCoupon, type SpinCouponRule } from "./spinWinServer";
import type { SpinDiscountType } from "./spinWinRules";

type Executor = Kysely<DB> | Transaction<DB>;

const num = (value: string | number | null) => (value === null ? null : Number(value));

export function toStackPromo(row: Selectable<PromoCodes>): StackPromo {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
    minPurchaseAmount: num(row.minPurchaseAmount),
    maxDiscountAmount: num(row.maxDiscountAmount),
    appliesTo: row.appliesTo,
    targetItemIds: row.targetItemIds,
    createdByTeacherId: row.createdByTeacherId,
  };
}

type CartRow = {
  mockTestId: number | null;
  courseId: number | null;
  digitalProductId: number | null;
  testPrice?: string | number | null;
  testDiscountPrice?: string | number | null;
  testTeacherId?: number | null;
  coursePrice?: string | number | null;
  courseTeacherId?: number | null;
  digitalProductPrice?: string | number | null;
  digitalProductTeacherId?: number | null;
};

/** Cart rows as stack lines, priced the way the checkout endpoints price them. */
export function checkoutLines(cartItems: CartRow[]): StackLine[] {
  return cartItems.flatMap((item): StackLine[] => {
    if (item.mockTestId) {
      return [{ kind: "test", id: item.mockTestId, teacherId: item.testTeacherId ?? null, price: Number(item.testDiscountPrice ?? item.testPrice ?? 0) || 0 }];
    }
    if (item.courseId) {
      return [{ kind: "course", id: item.courseId, teacherId: item.courseTeacherId ?? null, price: Number(item.coursePrice ?? 0) || 0 }];
    }
    if (item.digitalProductId) {
      return [{ kind: "digitalProduct", id: item.digitalProductId, teacherId: item.digitalProductTeacherId ?? null, price: Number(item.digitalProductPrice ?? 0) || 0 }];
    }
    return [];
  });
}

export const cartRowKey = (item: CartRow) =>
  item.mockTestId
    ? lineKey({ kind: "test", id: item.mockTestId })
    : item.courseId
      ? lineKey({ kind: "course", id: item.courseId })
      : lineKey({ kind: "digitalProduct", id: item.digitalProductId ?? 0 });

export type ChosenRef = { promoCodeId?: number; code?: string };

/**
 * Loads and checks the coupon a student chose: active, in its dates, under its
 * limits, and for a Spin & Win coupon owned by them and unspent. Throws with a
 * message for the student. With `trx` the code is locked until commit.
 */
export async function loadChosenCoupon(
  executor: Executor,
  ref: ChosenRef,
  userId: number,
  options: { trx?: Transaction<DB>; ignorePending?: boolean } = {}
): Promise<{ chosen: ChosenCoupon; spinRule: SpinCouponRule | null }> {
  let id = ref.promoCodeId ?? null;
  if (!id && ref.code) {
    const byCode = await executor.selectFrom("promoCodes").select("id").where("code", "=", ref.code.trim()).executeTakeFirst();
    id = byCode?.id ?? null;
  }
  if (!id) throw new Error("Invalid promo code.");
  if (options.trx) await lockPromoCode(options.trx, id);

  const row = await executor.selectFrom("promoCodes").selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) throw new Error("Invalid promo code.");
  if (!row.isActive) throw new Error("This promo code is no longer active.");
  const now = new Date();
  if (row.validFrom > now) throw new Error("This promo code is not valid yet.");
  if (row.validUntil && row.validUntil < now) throw new Error("This promo code has expired.");

  const promo = toStackPromo(row);
  const spinRule = await getSpinCouponRuleOrThrow(executor, id, userId, { ignorePending: options.ignorePending });
  if (spinRule) return { chosen: { source: "spin", promo, spin: spinRule }, spinRule };

  if (row.usageLimit !== null && (await countPromoCodeUses(executor, id)) >= row.usageLimit) {
    throw new Error("This promo code has reached its usage limit.");
  }
  if (row.perUserLimit !== null && (await countPromoCodeUses(executor, id, userId)) >= row.perUserLimit) {
    throw new Error("You have already used this promo code the maximum number of times.");
  }
  return { chosen: { source: row.createdByTeacherId !== null ? "teacher" : "platform", promo }, spinRule: null };
}

export type CartCouponPricing = {
  stack: StackedCoupons;
  /** Set when the chosen coupon is a Spin & Win coupon, for recordSpinRedemption. */
  spinApplied: AppliedSpinCoupon | null;
};

/**
 * Prices a cart's coupons for checkout: locks and recounts every coupon it
 * takes, applies the automatic teacher offers, and adds the chosen coupon on
 * top. Tcoins replace every coupon, so with `useTcoins` nothing is applied.
 * A chosen coupon that cannot apply throws, except a code that is already one
 * of the automatic offers, which is simply not counted twice.
 */
export async function priceCartForCheckout(
  trx: Transaction<DB>,
  input: { userId: number; lines: StackLine[]; chosen: ChosenRef | null; useTcoins: boolean }
): Promise<CartCouponPricing> {
  if (input.useTcoins) {
    return { stack: priceCouponStack({ lines: input.lines, autoCandidates: [], chosen: null }), spinApplied: null };
  }
  const loaded = input.chosen ? await loadChosenCoupon(trx, input.chosen, input.userId, { trx }) : null;
  const autoCandidates = await loadCartAutoCandidates({ userId: input.userId, lines: autoOfferLines(input.lines), trx });
  const stack = priceCouponStack({ lines: input.lines, autoCandidates, chosen: loaded?.chosen ?? null });
  if (stack.chosenError && !stack.chosenAlreadyAuto) throw new Error(stack.chosenError);

  let spinApplied: AppliedSpinCoupon | null = null;
  if (loaded?.spinRule && stack.chosen) {
    spinApplied = applySpinCouponOrThrow(
      loaded.spinRule,
      stack.lines.map((l) => ({ type: l.kind, id: l.id, price: Math.max(0, Math.round((l.price - l.autoDiscount) * 100) / 100) }))
    );
  }
  return { stack, spinApplied };
}

/** The same pricing for the cart preview: nothing is locked, and a pending checkout does not count as a use. */
export async function previewCartCoupons(input: {
  userId: number;
  lines: StackLine[];
  chosen: ChosenRef | null;
}): Promise<StackedCoupons & { autoCandidates: Awaited<ReturnType<typeof loadCartAutoCandidates>> }> {
  const autoCandidates = await loadCartAutoCandidates({ userId: input.userId, lines: autoOfferLines(input.lines) });
  let chosen: ChosenCoupon | null = null;
  let loadError: string | null = null;
  if (input.chosen) {
    try {
      chosen = (await loadChosenCoupon(db, input.chosen, input.userId, { ignorePending: true })).chosen;
    } catch (error) {
      loadError = error instanceof Error ? error.message : "This coupon cannot be used.";
    }
  }
  const stack = priceCouponStack({ lines: input.lines, autoCandidates, chosen });
  return { ...stack, chosenError: loadError ?? stack.chosenError, autoCandidates };
}

/** The lines that can take an automatic teacher offer: courses and study notes. */
export function autoOfferLines(lines: StackLine[]): CartOfferLine[] {
  return lines.flatMap((l) => (isAutoOfferKind(l.kind) ? [{ kind: l.kind, id: l.id, teacherId: l.teacherId, price: l.price }] : []));
}

/** Order columns for a priced cart. promo_code_id is the chosen coupon, else the largest teacher offer. */
export function orderCouponColumns(stack: StackedCoupons) {
  const codes = [...stack.autoOffers.map((o) => o.code), ...(stack.chosen ? [stack.chosen.code] : [])];
  const promoCodeId = stack.chosen?.promoCodeId ?? stack.autoOffers[0]?.promoCodeId ?? null;
  return {
    discountAmount: stack.discountAmount.toFixed(2),
    promoCodeId,
    promoCodeSnapshot: codes.length > 0 ? codes.join(" + ") : null,
    promoAutoApplied: promoCodeId === null ? null : stack.chosen === null,
  };
}

/** One order item's discount: the total, and the part that came from teacher offers. */
export function orderItemDiscount(stack: StackedCoupons, key: string) {
  const line = stack.lines.find((l) => l.key === key);
  const auto = line?.autoDiscount ?? 0;
  const total = auto + (line?.chosenDiscount ?? 0);
  return { discountAmount: total.toFixed(2), autoDiscountAmount: auto.toFixed(2) };
}

/** One promo_code_usages row per coupon on the order, so every coupon's limits count this order. */
export async function recordCouponUsages(trx: Transaction<DB>, stack: StackedCoupons, userId: number, orderId: number) {
  const rows = [
    ...stack.autoOffers.map((o) => ({ promoCodeId: o.promoCodeId, discountAmount: o.discountAmount })),
    ...(stack.chosen ? [{ promoCodeId: stack.chosen.promoCodeId, discountAmount: stack.chosen.discountAmount }] : []),
  ];
  if (rows.length === 0) return;
  await trx
    .insertInto("promoCodeUsages")
    .values(rows.map((r) => ({ promoCodeId: r.promoCodeId, userId, orderId, discountAmount: r.discountAmount.toFixed(2) })))
    .execute();
}

export type PlatformCouponOption = {
  chosen: ChosenCoupon;
  source: "spin" | "platform";
  expiresAt: Date | null;
  /** Spin & Win categories; null for an admin code, which uses appliesTo. */
  categories: string[] | null;
};

/**
 * Testkart coupons a student can pick at the cart: their own live Spin & Win
 * coupons, and public admin codes with uses left. Private codes stay typed only.
 */
export async function loadPlatformCouponOptions(userId: number): Promise<PlatformCouponOption[]> {
  const now = new Date();
  const spinRows = await db
    .selectFrom("spinCoupons as sc")
    .innerJoin("promoCodes as pc", "pc.id", "sc.promoCodeId")
    .selectAll("pc")
    .select([
      "sc.discountType as spinDiscountType",
      "sc.discountValue as spinDiscountValue",
      "sc.minOrderValue as spinMinOrderValue",
      "sc.maxDiscountAmount as spinMaxDiscountAmount",
      "sc.maxDiscountPercent as spinMaxDiscountPercent",
      "sc.eligibleCategories as spinCategories",
      "sc.expiresAt as spinExpiresAt",
    ])
    .where("sc.userId", "=", userId)
    .where("sc.voidedAt", "is", null)
    .where("sc.expiresAt", ">", now)
    .where("pc.isActive", "=", true)
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom("promoCodeUsages as u")
            .innerJoin("orders as o", "o.id", "u.orderId")
            .select("u.id")
            .whereRef("u.promoCodeId", "=", "sc.promoCodeId")
            .where("o.status", "in", ["completed", "refunded"])
        )
      )
    )
    .orderBy("sc.expiresAt", "asc")
    .execute();

  const adminRows = await db
    .selectFrom("promoCodes")
    .selectAll()
    .select(promoCodeUsesSql().as("usesHeld"))
    .where("createdByTeacherId", "is", null)
    .where("isPublic", "=", true)
    .where("isActive", "=", true)
    .where("validFrom", "<=", now)
    .where((eb) => eb.or([eb("validUntil", "is", null), eb("validUntil", ">", now)]))
    .where("appliesTo", "in", ["all", "tests", "courses", "digital_products"])
    .where((eb) => eb.not(eb.exists(eb.selectFrom("spinCoupons").select("spinCoupons.id").whereRef("spinCoupons.promoCodeId", "=", "promoCodes.id"))))
    .orderBy("id", "asc")
    .execute();

  let openAdmin = adminRows.filter((row) => row.usageLimit === null || Number(row.usesHeld) < row.usageLimit);
  if (openAdmin.some((row) => row.perUserLimit !== null)) {
    const mine = await db
      .selectFrom("promoCodeUsages")
      .leftJoin("orders", "orders.id", "promoCodeUsages.orderId")
      .select(["promoCodeUsages.promoCodeId", sql<string>`count(*)`.as("uses")])
      .where("promoCodeUsages.userId", "=", userId)
      .where("promoCodeUsages.promoCodeId", "in", openAdmin.map((row) => row.id))
      .where((eb) => eb.or([eb("promoCodeUsages.orderId", "is", null), eb("orders.status", "in", [...HELD_ORDER_STATUSES])]))
      .groupBy("promoCodeUsages.promoCodeId")
      .execute();
    const uses = new Map(mine.map((m) => [m.promoCodeId, Number(m.uses)]));
    openAdmin = openAdmin.filter((row) => row.perUserLimit === null || (uses.get(row.id) ?? 0) < row.perUserLimit);
  }

  return [
    ...spinRows.map((row): PlatformCouponOption => ({
      chosen: {
        source: "spin",
        promo: toStackPromo(row),
        spin: {
          discountType: row.spinDiscountType as SpinDiscountType,
          discountValue: Number(row.spinDiscountValue),
          minOrderValue: Number(row.spinMinOrderValue),
          maxDiscountAmount: num(row.spinMaxDiscountAmount),
          maxDiscountPercent: Number(row.spinMaxDiscountPercent),
          eligibleCategories: row.spinCategories,
        },
      },
      source: "spin",
      expiresAt: row.spinExpiresAt,
      categories: row.spinCategories,
    })),
    ...openAdmin.map((row): PlatformCouponOption => ({
      chosen: { source: "platform", promo: toStackPromo(row) },
      source: "platform",
      expiresAt: row.validUntil,
      categories: null,
    })),
  ];
}
