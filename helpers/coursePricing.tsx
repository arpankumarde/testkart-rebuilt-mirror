import { sql } from "kysely";

/*
 * Course pricing, in one place. A course has a list price and an optional
 * discounted price. The discount only counts when it sits strictly between 0
 * and the list price; anything else falls back to the list price, so a stale
 * or bad value can never make a paid course free or dearer.
 */

type Amount = number | string | null | undefined;

const toNumber = (value: Amount): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

/** The discount to show and charge, or null when there is no valid discount. */
export function courseDiscountPrice(price: Amount, discountPrice: Amount): number | null {
  const list = toNumber(price) ?? 0;
  const discount = toNumber(discountPrice);
  if (discount === null || discount <= 0 || discount >= list) return null;
  return discount;
}

/** What the student actually pays for the course. */
export function courseEffectivePrice(price: Amount, discountPrice: Amount): number {
  return courseDiscountPrice(price, discountPrice) ?? (toNumber(price) ?? 0);
}

/**
 * SQL for the same rule, for queries joining `courses`. Null when the course
 * row is missing (for example a left join onto a cart row for another item).
 */
export const courseEffectivePriceSql = sql<string | null>`case
  when ${sql.ref("courses.discountPrice")} > 0
   and ${sql.ref("courses.discountPrice")} < ${sql.ref("courses.price")}
  then ${sql.ref("courses.discountPrice")}
  else ${sql.ref("courses.price")}
end`;

/** Validation message for a teacher-entered discount, or null when it is fine. */
export function courseDiscountError(price: number, discountPrice: number | null | undefined): string | null {
  if (discountPrice === null || discountPrice === undefined) return null;
  if (!(price > 0)) return "A free course cannot have a discounted price.";
  if (!(discountPrice > 0)) return "Discounted price must be more than 0.";
  if (discountPrice >= price) return "Discounted price must be less than the price.";
  return null;
}
