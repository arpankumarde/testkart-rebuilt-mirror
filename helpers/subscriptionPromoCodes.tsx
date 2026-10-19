import { Kysely, Transaction } from "kysely";
import { DB, PromoCodes } from "./schema";
import { Selectable } from "kysely";
import { countPromoCodeUses } from "./promoCodeUsage";

export type SubscriptionPromoCode = Selectable<PromoCodes>;

export type PromoDuration = "first_month" | "every_month";

/**
 * Validates a promo code for a subscription plan purchase. Mirrors the
 * checks in endpoints/promo-codes/validate_POST.ts but scoped to
 * subscription plans instead of cart items: a code applies when
 * appliesTo is "all" or "subscription", and when targetItemIds (if set)
 * includes this plan's id. Only admin-created codes (createdByTeacherId
 * is null) are meaningful here - teachers do not own subscription plans.
 * Throws a user-facing Error on any failure; never returns an invalid code.
 */
export async function validatePromoCodeForPlan(
  executor: Kysely<DB> | Transaction<DB>,
  code: string,
  planId: number,
  teacherId: number
): Promise<SubscriptionPromoCode> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Enter a promo code.");
  }

  const promo = await executor
    .selectFrom("promoCodes")
    .selectAll()
    .where("code", "=", normalized)
    .executeTakeFirst();

  if (!promo) {
    throw new Error("Invalid promo code.");
  }

  if (!promo.isActive) {
    throw new Error("This promo code is no longer active.");
  }

  const now = new Date();
  if (promo.validFrom > now || (promo.validUntil && promo.validUntil < now)) {
    throw new Error("This promo code is not valid at this time.");
  }

  if (promo.appliesTo !== "all" && promo.appliesTo !== "subscription") {
    throw new Error("This promo code cannot be used on a subscription plan.");
  }

  if (promo.targetItemIds && promo.targetItemIds.length > 0 && !promo.targetItemIds.includes(planId)) {
    throw new Error("This promo code does not apply to the selected plan.");
  }

  if (promo.usageLimit !== null) {
    const uses = await countPromoCodeUses(executor as Kysely<DB>, promo.id);
    if (uses >= promo.usageLimit) {
      throw new Error("This promo code has reached its usage limit.");
    }
  }

  if (promo.perUserLimit !== null) {
    const uses = await countPromoCodeUses(executor as Kysely<DB>, promo.id, teacherId);
    if (uses >= promo.perUserLimit) {
      throw new Error("You have already used this promo code the maximum number of times.");
    }
  }

  return promo;
}

/** Rupee discount for one charge of planPrice, respecting maxDiscountAmount and never exceeding the price itself. */
export function computePromoDiscountAmount(planPrice: number, promo: SubscriptionPromoCode): number {
  let discount = 0;
  if (promo.discountType === "fixed") {
    discount = parseFloat(promo.discountValue);
  } else {
    discount = (planPrice * parseFloat(promo.discountValue)) / 100;
    if (promo.maxDiscountAmount !== null) {
      discount = Math.min(discount, parseFloat(promo.maxDiscountAmount));
    }
  }
  discount = Math.min(discount, planPrice);
  return Math.round(discount * 100) / 100;
}

/** Final price for one charge after a promo discount, floored at a token ₹1 so no charge is ever ₹0. */
export function applyPromoDiscount(planPrice: number, promo: SubscriptionPromoCode): number {
  const discount = computePromoDiscountAmount(planPrice, promo);
  return Math.max(1, Math.round((planPrice - discount) * 100) / 100);
}

/**
 * The amount to charge for a recurring cycle of an already-active
 * subscription, given the promo snapshot stored on it at signup. Only
 * "every_month" promos keep discounting renewals; "first_month" promos
 * (or no promo at all) renew at the plan's full price.
 */
export function effectiveRenewalAmount(sub: {
  price: string | number;
  promoDuration: string | null;
  promoDiscountAmount: string | number | null;
}): number {
  const fullPrice = Number(sub.price);
  if (sub.promoDuration !== "every_month" || sub.promoDiscountAmount === null) {
    return fullPrice;
  }
  const discount = Number(sub.promoDiscountAmount);
  return Math.max(1, Math.round((fullPrice - discount) * 100) / 100);
}

/**
 * Records a successful redemption against the promo code's usage count.
 * Called once, at the moment a subscription backed by a promo code is
 * first activated - never again on later renewal cycles of that same
 * subscription, so "times it can be used" counts signups, not charges.
 */
export async function recordPromoRedemption(
  trx: Transaction<DB>,
  params: {
    promoCodeId: number;
    teacherId: number;
    discountAmount: number;
  }
): Promise<void> {
  await trx
    .insertInto("promoCodeUsages")
    .values({
      promoCodeId: params.promoCodeId,
      userId: params.teacherId,
      discountAmount: String(params.discountAmount),
    })
    .execute();
}
