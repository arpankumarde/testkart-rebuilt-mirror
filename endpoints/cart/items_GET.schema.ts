import { z } from "zod";
import superjson from "superjson";
import type { CartAutoCoupon } from "../../helpers/courseCouponOffer";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type CartItemTest = {
  type: 'test';
  cartItemId: number;
  mockTestId: number;
  slug: string;
  title: string;
  price: number;
  discountPrice: number | null;
  thumbnailUrl: string | null;
  creatorName: string | null;
  /** Past its expiry: checkout refuses the cart until it is removed. */
  expired?: boolean;
};

export type CartItemCourse = {
  type: 'course';
  cartItemId: number;
  courseId: number;
  slug: string;
  title: string;
  price: number;
  discountPrice: number | null;
  thumbnailUrl: string | null;
  thumbnailImageUrl: string | null;
  teacherName: string | null;
  expired?: boolean;
};

export type CartItemDigitalProduct = {
  type: 'digitalProduct';
  cartItemId: number;
  digitalProductId: number;
  slug: string;
  title: string;
  price: number;
  discountPrice: number | null;
  thumbnailUrl: string | null;
  teacherName: string | null;
  expired?: boolean;
};

export type CartItem = CartItemTest | CartItemCourse | CartItemDigitalProduct;

export type OutputType = {
  items: CartItem[];
  /** The largest of autoCoupons, or null. Kept for clients that read a single offer. */
  autoCoupon: CartAutoCoupon | null;
  /**
   * The teacher offers checkout applies by itself unless Tcoins are used, at
   * most one per course or study note. A coupon the student chooses is added
   * on top; the cart/quote endpoint prices that combination.
   */
  autoCoupons: CartAutoCoupon[];
};

export const getCartItems = async (
  params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/cart/items`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};