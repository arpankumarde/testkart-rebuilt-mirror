import type { CartItem } from "../endpoints/cart/items_GET.schema";
import type { QuoteLine } from "../endpoints/cart/quote_POST.schema";
import type { StackLineKind } from "./cartCouponStack";

/*
 * How one cart item is priced on screen. Every coupon figure comes from the
 * server's cart quote (the same pricing checkout charges); this only lines the
 * quote up with the cart rows and works out the list-price view around it.
 */

export type CartItemPricing = {
  key: string;
  kind: StackLineKind;
  id: number;
  cartItemId: number;
  title: string;
  /** The list price (MRP). */
  mrp: number;
  /** What the item sells for before coupons. */
  salePrice: number;
  /** mrp - salePrice: the item's own price drop. */
  saleDiscount: number;
  /** This item's share of its automatic teacher offer. */
  teacherDiscount: number;
  teacherCode: string | null;
  /** What the item costs after its sale price and teacher offer. */
  finalPrice: number;
  /** Saving against the list price, in whole percent. */
  percentOff: number;
  savings: number;
};

const roundPaise = (amount: number) => Math.round(amount * 100) / 100;

export const cartItemRef = (item: CartItem): { kind: StackLineKind; id: number } =>
  item.type === "test"
    ? { kind: "test", id: item.mockTestId }
    : item.type === "course"
      ? { kind: "course", id: item.courseId }
      : { kind: "digitalProduct", id: item.digitalProductId };

/** Teacher offers count only while coupons are active (Tcoins replace them) and the quote has loaded. */
export function priceCartItems(items: CartItem[], lines: QuoteLine[] | undefined, couponsActive: boolean): CartItemPricing[] {
  return items.map((item) => {
    const { kind, id } = cartItemRef(item);
    const line = couponsActive ? lines?.find((l) => l.kind === kind && l.id === id) : undefined;
    const mrp = item.price;
    const salePrice = item.discountPrice !== null && item.discountPrice < item.price ? item.discountPrice : item.price;
    const teacherDiscount = line?.autoDiscount ?? 0;
    const finalPrice = roundPaise(Math.max(0, salePrice - teacherDiscount));
    const savings = roundPaise(mrp - finalPrice);
    return {
      key: `${kind}:${id}`,
      kind,
      id,
      cartItemId: item.cartItemId,
      title: item.title,
      mrp,
      salePrice,
      saleDiscount: roundPaise(mrp - salePrice),
      teacherDiscount,
      teacherCode: teacherDiscount > 0 ? line?.autoCode ?? null : null,
      finalPrice,
      percentOff: mrp > 0 && savings > 0 ? Math.round((savings / mrp) * 100) : 0,
      savings,
    };
  });
}
