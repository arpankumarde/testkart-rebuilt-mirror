import { sql } from "kysely";
import { courseDiscountPrice, courseEffectivePrice } from "./coursePricing";

/*
 * Study note (digital product) pricing. Same rule as courses: a list price and
 * an optional discounted price that only counts when it sits strictly between
 * 0 and the list price, so a stale or bad value can never make a paid note
 * free or dearer. The course helpers hold the rule; these only name it for notes.
 */

type Amount = number | string | null | undefined;

/** The discount to show and charge, or null when there is no valid discount. */
export const productDiscountPrice = (price: Amount, discountPrice: Amount): number | null =>
  courseDiscountPrice(price, discountPrice);

/** What the student actually pays for the note. */
export const productEffectivePrice = (price: Amount, discountPrice: Amount): number =>
  courseEffectivePrice(price, discountPrice);

/** Whole-number percentage off the list price, or null when there is no valid discount. */
export function productDiscountPercent(price: Amount, discountPrice: Amount): number | null {
  const discount = productDiscountPrice(price, discountPrice);
  const list = Number(price);
  if (discount === null || !(list > 0)) return null;
  return Math.round(((list - discount) / list) * 100);
}

/**
 * SQL for the same rule, for queries joining `digital_products`. Null when the
 * product row is missing (for example a left join onto a cart row for another item).
 */
export const productEffectivePriceSql = sql<string | null>`case
  when ${sql.ref("digitalProducts.discountPrice")} > 0
   and ${sql.ref("digitalProducts.discountPrice")} < ${sql.ref("digitalProducts.price")}
  then ${sql.ref("digitalProducts.discountPrice")}
  else ${sql.ref("digitalProducts.price")}
end`;

/** Validation message for a teacher-entered discount, or null when it is fine. */
export function productDiscountError(price: number, discountPrice: number | null | undefined): string | null {
  if (discountPrice === null || discountPrice === undefined) return null;
  if (!(price > 0)) return "A free note cannot have a discounted price.";
  if (!(discountPrice > 0)) return "Discounted price must be more than 0.";
  if (discountPrice >= price) return "Discounted price must be less than the original price.";
  return null;
}
