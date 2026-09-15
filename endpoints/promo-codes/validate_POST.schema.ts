import { z } from "zod";
import superjson from "superjson";

// New format with item type information
const itemSchema = z.object({
  id: z.number().int().positive(),
  type: z.enum(["course", "test", "live_test", "bundle", "digital_product"]),
  price: z.number(),
});

// Support both old and new formats
export const schema = z.object({
  code: z.string().min(1, "Promo code is required."),
  // Old format (for backward compatibility)
  itemType: z.enum(["course", "test", "live_test", "bundle", "digital_product"]).optional(),
  itemIds: z.array(z.number().int().positive()).optional(),
  // New format
  items: z.array(itemSchema).optional(),
  totalAmount: z.number().positive("Total amount must be positive."),
}).refine(
  (data) => {
    // Either old format (itemType + itemIds) or new format (items) must be provided
    return (data.itemType && data.itemIds && data.itemIds.length > 0) || 
           (data.items && data.items.length > 0);
  },
  {
    message: "Either itemType and itemIds, or items array must be provided.",
  }
);

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  valid: boolean;
  discountAmount?: number;
  eligibleItemIds?: number[];
  ineligibleItemIds?: number[];
  message: string;
  promoCodeId?: number;
  discountBreakdown?: string;
};

export const postPromoCodesValidate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/promo-codes/validate`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: any }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};