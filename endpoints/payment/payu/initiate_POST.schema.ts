import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  promoCodeId: z.number().optional(),
  deepLinkUrl: z.string().optional(),
  /** Pay part of the order with Tcoins. Rejected together with a promo code. */
  useTcoins: z.boolean().optional(),
  /**
   * The automatic teacher offer the cart showed (0 for none), from cart/items autoCoupon.
   * Checkout stops if that offer is gone or replaced; the server still prices it itself.
   */
  autoPromoCodeId: z.number().int().nonnegative().optional(),
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