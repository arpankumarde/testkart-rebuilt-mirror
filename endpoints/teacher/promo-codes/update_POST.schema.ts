import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { PromoCodes, DiscountTypeArrayValues, PromoCodeAppliesToArrayValues } from "../../../helpers/schema";

// Manually define update schema with optional fields (no refine validations)
export const schema = z.object({
  promoCodeId: z.number().int().positive(),
  code: z.string().min(3).max(50).toUpperCase().optional(),
  discountType: z.enum(DiscountTypeArrayValues).optional(),
  discountValue: z.number().positive().optional(),
  appliesTo: z.enum(PromoCodeAppliesToArrayValues).optional(),
  targetItemIds: z.array(z.number().int().positive()).optional(),
  minPurchaseAmount: z.number().nonnegative().optional().nullable(),
  maxDiscountAmount: z.number().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = Selectable<PromoCodes>;

export const postTeacherPromoCodesUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/promo-codes/update`, {
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