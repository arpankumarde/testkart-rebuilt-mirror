/**
 * A promo code made by a teacher only discounts that teacher's own items. A
 * code with no teacher (created by an admin) applies to any teacher's items.
 * Every place that redeems or previews a code must apply this per item.
 */
export function promoCodeCoversTeacher(
  createdByTeacherId: number | null,
  itemTeacherId: number | null | undefined
): boolean {
  return createdByTeacherId === null || createdByTeacherId === itemTeacherId;
}

export const PROMO_ITEM_TYPES = [
  "course",
  "test",
  "live_test",
  "bundle",
  "digital_product",
] as const;

export type PromoItemType = (typeof PROMO_ITEM_TYPES)[number];

const APPLIES_TO_BY_ITEM_TYPE: Record<PromoItemType, string> = {
  course: "courses",
  test: "tests",
  live_test: "live_tests",
  bundle: "bundles",
  digital_product: "digital_products",
};

/**
 * Whether a code's "applies to" scope and its target item list include one
 * item. Mirrors the per-item checks in promo-codes/validate; the teacher
 * ownership check is separate (promoCodeCoversTeacher).
 */
export function promoCodeAppliesToItem(
  promo: { appliesTo: string; targetItemIds: number[] | null },
  itemType: PromoItemType,
  itemId: number
): boolean {
  if (promo.appliesTo !== "all" && promo.appliesTo !== APPLIES_TO_BY_ITEM_TYPE[itemType]) {
    return false;
  }
  if (promo.targetItemIds && promo.targetItemIds.length > 0) {
    return promo.targetItemIds.includes(itemId);
  }
  return true;
}
