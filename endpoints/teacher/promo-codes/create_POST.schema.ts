import { z } from "zod";
import superjson from "superjson";
import { DiscountTypeArrayValues, PromoCodeAppliesToArrayValues } from "../../../helpers/schema";
import { Selectable } from "kysely";
import { PromoCodes } from "../../../helpers/schema";

export const schema = z.object({
    code: z.string().min(3, "Code must be at least 3 characters").max(50, "Code cannot exceed 50 characters").toUpperCase(),
    discountType: z.enum(DiscountTypeArrayValues),
    discountValue: z.number().positive("Discount value must be positive"),
    appliesTo: z.enum(PromoCodeAppliesToArrayValues),
    targetItemIds: z.array(z.number().int().positive()).optional(),
    minPurchaseAmount: z.number().nonnegative().optional().nullable(),
    maxDiscountAmount: z.number().positive().optional().nullable(),
    usageLimit: z.number().int().positive().optional().nullable(),
    perUserLimit: z.number().int().positive().optional().nullable(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional().nullable(),
}).refine(data => {
    if (data.discountType === 'percentage') {
        return data.discountValue <= 100;
    }
    return true;
}, {
    message: "Percentage discount cannot exceed 100",
    path: ["discountValue"],
}).refine(data => {
    if (data.validUntil && data.validFrom) {
        return data.validUntil > data.validFrom;
    }
    return true;
}, {
    message: "End date must be after start date",
    path: ["validUntil"],
});

export type InputType = z.infer<typeof schema>;
export type OutputType = Selectable<PromoCodes>;

export const postTeacherPromoCodesCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/promo-codes/create`, {
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