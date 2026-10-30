import { tcoinsRupeeValue } from "./tcoinsMath";

/*
 * How an order was discounted at checkout, derived from the columns every
 * order already has (promo_code_id, discount_amount, tcoins_redeemed,
 * total_amount), so old and new orders read the same way with no extra
 * column to keep in sync. A promo code and Tcoins never combine; checkout
 * rejects the pair on the server (helpers/tcoins.tsx planTcoinsForOrder).
 */

export const ORDER_DISCOUNT_METHODS = ["promo_code", "tcoins", "none"] as const;
export type OrderDiscountMethod = (typeof ORDER_DISCOUNT_METHODS)[number];

export const ORDER_DISCOUNT_METHOD_LABELS: Record<OrderDiscountMethod, string> = {
  promo_code: "Promo code",
  tcoins: "Tcoins",
  none: "None",
};

export type OrderDiscountBreakdown = {
  method: OrderDiscountMethod;
  /** What the order was worth before the promo code or Tcoins: the items at their sale prices. */
  originalAmount: number;
  promoDiscount: number;
  tcoinsRedeemed: number;
  /** Rupee value of the redeemed coins. */
  tcoinsValue: number;
  /** What the student paid in cash (gateway or prize wallet). */
  finalAmount: number;
};

const paise = (n: number) => Math.round(n * 100) / 100;

export function orderDiscountBreakdown(order: {
  totalAmount: number;
  discountAmount: number;
  tcoinsRedeemed: number;
  promoCodeId: number | null;
}): OrderDiscountBreakdown {
  const tcoinsRedeemed = Math.max(0, order.tcoinsRedeemed || 0);
  const tcoinsValue = tcoinsRupeeValue(tcoinsRedeemed);
  const promoDiscount = Math.max(0, order.discountAmount || 0);
  const finalAmount = Math.max(0, order.totalAmount || 0);
  const method: OrderDiscountMethod =
    order.promoCodeId !== null ? "promo_code" : tcoinsRedeemed > 0 ? "tcoins" : "none";
  return {
    method,
    originalAmount: paise(finalAmount + promoDiscount + tcoinsValue),
    promoDiscount,
    tcoinsRedeemed,
    tcoinsValue,
    finalAmount,
  };
}

/** One short line for tables and exports: "Promo code: SAVE20", "100 Tcoins used" or "None". */
export function discountMethodLine(
  breakdown: Pick<OrderDiscountBreakdown, "method" | "tcoinsRedeemed">,
  promoCode: string | null
): string {
  if (breakdown.method === "promo_code") return `Promo code: ${promoCode ?? "Not available"}`;
  if (breakdown.method === "tcoins") return `${breakdown.tcoinsRedeemed.toLocaleString("en-IN")} Tcoins used`;
  return "None";
}