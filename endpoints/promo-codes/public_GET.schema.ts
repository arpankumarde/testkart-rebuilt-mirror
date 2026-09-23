import { z } from "zod";
import superjson from "superjson";
import { PROMO_ITEM_TYPES } from "../../helpers/promoCodeEligibility";

export const schema = z.object({
  itemType: z.enum(PROMO_ITEM_TYPES),
  itemId: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type PublicPromoCode = {
  id: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minPurchaseAmount: number | null;
  maxDiscountAmount: number | null;
  validUntil: Date | null;
};

export type OutputType = {
  promoCodes: PublicPromoCode[];
};

export const getPublicPromoCodes = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    itemType: validatedParams.itemType,
    itemId: String(validatedParams.itemId),
  });

  const result = await fetch(`/_api/promo-codes/public?${searchParams.toString()}`, {
    method: "GET",
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
