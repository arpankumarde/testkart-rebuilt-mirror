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