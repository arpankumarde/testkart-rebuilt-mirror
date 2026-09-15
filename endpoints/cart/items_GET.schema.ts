import { z } from "zod";
import superjson from "superjson";

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
};

export type CartItem = CartItemTest | CartItemCourse | CartItemDigitalProduct;

export type OutputType = {
  items: CartItem[];
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