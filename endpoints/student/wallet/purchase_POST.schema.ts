import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  promoCodeId: z.number().optional(),
  /** Pay part of the order with Tcoins. Rejected together with a promo code; Tcoins also replace the teacher offers. */
  useTcoins: z.boolean().optional(),
  /** Older single-offer form of autoPromoCodeIds (0 for none). */
  autoPromoCodeId: z.number().int().nonnegative().optional(),
  /**
   * The automatic teacher offers the cart showed (cart/quote autoOffers). The purchase stops if
   * one is gone or replaced; the server still prices them itself. promoCodeId is added on top.
   */
  autoPromoCodeIds: z.array(z.number().int().positive()).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  orderId: number;
  walletBalanceAfter: number;
  amountDeducted: number;
  tcoinsRedeemed: number;
  tcoinsCashback: number;
};

export const postStudentWalletPurchase = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/student/wallet/purchase`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};