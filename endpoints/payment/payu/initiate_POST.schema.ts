import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  promoCodeId: z.number().optional(),
  deepLinkUrl: z.string().optional(),
  /** Pay part of the order with Tcoins. Rejected together with a promo code; Tcoins also replace the teacher offers. */
  useTcoins: z.boolean().optional(),
  /** Older single-offer form of autoPromoCodeIds (0 for none). */
  autoPromoCodeId: z.number().int().nonnegative().optional(),
  /**
   * The automatic teacher offers the cart showed (cart/items autoCoupons). Checkout stops if one
   * is gone or replaced; the server still prices them itself. promoCodeId is added on top.
   */
  autoPromoCodeIds: z.array(z.number().int().positive()).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  payuUrl: string;
  udf1?: string;
};

export const postPaymentPayuInitiate = async (
  body: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/payment/payu/initiate`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(
      await result.text()
    );
    throw new Error(errorObject.details || errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};