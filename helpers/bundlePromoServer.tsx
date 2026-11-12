import type { Selectable, Transaction } from "kysely";
import type { DB, PromoCodes } from "./schema";
import { countPromoCodeUses } from "./promoCodeUsage";
import { getSpinCouponRuleOrThrow } from "./spinWinServer";

export interface BundlePromoResult {
  discountAmount: number;
  promoCode: Selectable<PromoCodes>;
}

/** Checks a coupon against a bundle checkout and prices it. Throws with a message for the student. */
export async function validateBundlePromo(
  trx: Transaction<DB>,
  promoCodeId: number,
  bundle: { id: number; teacherId: number; price: string | number },
  studentId: number,
  amount: number
): Promise<BundlePromoResult> {
  const promoCode = await trx
    .selectFrom("promoCodes")
    .selectAll()
    .where("id", "=", promoCodeId)
    .where("isActive", "=", true)
    .executeTakeFirst();

  if (!promoCode) {
    throw new Error("Invalid or inactive promo code.");
  }

  const now = new Date();
  if (promoCode.validFrom && new Date(promoCode.validFrom) > now) {
    throw new Error("Promo code is not yet valid.");
  }
  if (promoCode.validUntil && new Date(promoCode.validUntil) < now) {
    throw new Error("Promo code has expired.");
  }

  if (promoCode.usageLimit !== null && (await countPromoCodeUses(trx, promoCodeId)) >= promoCode.usageLimit) {
    throw new Error("Promo code usage limit has been reached.");
  }

  if (promoCode.perUserLimit !== null && (await countPromoCodeUses(trx, promoCodeId, studentId)) >= promoCode.perUserLimit) {
    throw new Error("You have already used this promo code the maximum number of times.");
  }

  if (promoCode.createdByTeacherId !== null && promoCode.createdByTeacherId !== bundle.teacherId) {
    throw new Error("This promo code is not valid for this bundle.");
  }

  if (await getSpinCouponRuleOrThrow(trx, promoCodeId, studentId)) {
    throw new Error("Spin & Win coupons work only on test series, courses and study notes, not bundles.");
  }

  if (promoCode.appliesTo !== "all" && promoCode.appliesTo !== "bundles") {
    throw new Error("This promo code is not applicable to bundles.");
  }

  if (promoCode.targetItemIds && promoCode.targetItemIds.length > 0) {
    if (!promoCode.targetItemIds.includes(bundle.id)) {
      throw new Error("This promo code is not valid for this specific bundle.");
    }
  }

  let calculatedDiscount = 0;
  if (promoCode.discountType === "fixed") {
    calculatedDiscount = parseFloat(promoCode.discountValue);
  } else if (promoCode.discountType === "percentage") {
    calculatedDiscount = (amount * parseFloat(promoCode.discountValue)) / 100;
    if (promoCode.maxDiscountAmount) {
      calculatedDiscount = Math.min(calculatedDiscount, parseFloat(promoCode.maxDiscountAmount));
    }
  }

  calculatedDiscount = Math.min(calculatedDiscount, amount);

  return {
    discountAmount: calculatedDiscount,
    promoCode,
  };
}

export async function recordBundlePromoUsage(
  trx: Transaction<DB>,
  promoCodeId: number,
  studentId: number,
  orderId: number,
  discountAmount: number
) {
  await trx
    .insertInto("promoCodeUsages")
    .values({
      promoCodeId,
      userId: studentId,
      orderId,
      discountAmount: discountAmount.toFixed(2),
    })
    .execute();
}
