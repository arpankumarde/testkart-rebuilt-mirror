import { db } from "./db";
import { type PromoItemType, promoCodeAppliesToItem } from "./promoCodeEligibility";
import { promoCodeUsesSql } from "./promoCodeUsage";
import type { PublicPromoCode } from "../endpoints/promo-codes/public_GET.schema";

const MAX_COUPONS = 5;

async function getItemTeacherId(itemType: PromoItemType, itemId: number): Promise<number | null> {
  switch (itemType) {
    case "course": {
      const row = await db.selectFrom("courses").select("teacherId").where("id", "=", itemId).executeTakeFirst();
      return row?.teacherId ?? null;
    }
    case "test": {
      const row = await db.selectFrom("mockTests").select("teacherId").where("id", "=", itemId).executeTakeFirst();
      return row?.teacherId ?? null;
    }
    case "live_test": {
      const row = await db.selectFrom("liveTests").select("teacherId").where("id", "=", itemId).executeTakeFirst();
      return row?.teacherId ?? null;
    }
    case "bundle": {
      const row = await db.selectFrom("courseBundles").select("teacherId").where("id", "=", itemId).executeTakeFirst();
      return row?.teacherId ?? null;
    }
    case "digital_product": {
      const row = await db.selectFrom("digitalProducts").select("teacherId").where("id", "=", itemId).executeTakeFirst();
      return row?.teacherId ?? null;
    }
  }
}

/**
 * Coupons a teacher has made public for one of their items: active, public,
 * inside their dates, under their usage limit and scoped to the item. Backs
 * endpoints/promo-codes/public_GET.ts and SSR prefetches (server only).
 */
export async function loadPublicPromoCodes(itemType: PromoItemType, itemId: number): Promise<PublicPromoCode[]> {
  const teacherId = await getItemTeacherId(itemType, itemId);
  if (teacherId === null) return [];

  const now = new Date();
  const rows = await db
    .selectFrom("promoCodes")
    .selectAll()
    .select(promoCodeUsesSql().as("usesHeld"))
    .where("createdByTeacherId", "=", teacherId)
    .where("isPublic", "=", true)
    .where("isActive", "=", true)
    .where("validFrom", "<=", now)
    .where((eb) => eb.or([eb("validUntil", "is", null), eb("validUntil", ">", now)]))
    .orderBy("createdAt", "desc")
    .execute();

  return rows
    .filter((row) => row.usageLimit === null || Number(row.usesHeld) < row.usageLimit)
    .filter((row) => promoCodeAppliesToItem(row, itemType, itemId))
    .slice(0, MAX_COUPONS)
    .map((row) => ({
      id: row.id,
      code: row.code,
      discountType: row.discountType,
      discountValue: parseFloat(row.discountValue),
      minPurchaseAmount: row.minPurchaseAmount === null ? null : parseFloat(row.minPurchaseAmount),
      maxDiscountAmount: row.maxDiscountAmount === null ? null : parseFloat(row.maxDiscountAmount),
      validUntil: row.validUntil,
    }));
}