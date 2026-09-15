import type { Kysely } from "kysely";
import type { DB } from "./schema";

export class BundleRuleError extends Error {}

export type BundleItemIds = {
  courseIds: number[];
  testIds: number[];
  digitalProductIds: number[];
};

export type BundlePricing = {
  originalPrice: number;
  discountPercentage: number;
  priceError: string | null;
};

const toAmount = (value: number | string | null | undefined): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const roundMoney = (n: number) => Math.round(n * 100) / 100;

export const formatInr = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

// The one definition of a bundle's original price and discount. The form shows
// it live and the server stores it, both from the items' current prices, so the
// two can never disagree about whether a price is allowed.
export function computeBundlePricing(
  itemPrices: Array<number | string | null | undefined>,
  price: number
): BundlePricing {
  const originalPrice = roundMoney(itemPrices.reduce<number>((sum, p) => sum + toAmount(p), 0));
  const discountPercentage =
    originalPrice > 0 && price >= 0 && price < originalPrice
      ? roundMoney(((originalPrice - price) / originalPrice) * 100)
      : 0;
  let priceError: string | null = null;
  if (!Number.isFinite(price) || price < 0) {
    priceError = "Price cannot be negative.";
  } else if (price >= originalPrice) {
    priceError = `Bundle price must be less than the items' combined price of ${formatInr(originalPrice)}.`;
  }
  return { originalPrice, discountPercentage, priceError };
}

export async function loadBundleItemPrices(
  trx: Kysely<DB>,
  teacherId: number,
  ids: BundleItemIds,
  requireOwnership: boolean
): Promise<number[]> {
  const prices: number[] = [];
  const sources = [
    { table: "courses", ids: ids.courseIds, label: "courses" },
    { table: "mockTests", ids: ids.testIds, label: "tests" },
    { table: "digitalProducts", ids: ids.digitalProductIds, label: "digital products" },
  ] as const;

  for (const source of sources) {
    const uniqueIds = Array.from(new Set(source.ids));
    if (uniqueIds.length === 0) continue;
    let query = trx
      .selectFrom(source.table)
      .select(["id", "price"])
      .where("id", "in", uniqueIds);
    if (requireOwnership) query = query.where("teacherId", "=", teacherId);
    const rows = await query.execute();
    if (requireOwnership && rows.length !== uniqueIds.length) {
      throw new BundleRuleError(`One or more ${source.label} are invalid or do not belong to you.`);
    }
    for (const row of rows) prices.push(toAmount(row.price));
  }
  return prices;
}
