import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { PromoCodes } from "../../../helpers/schema";

export const schema = z.object({
  id: z.number().int().positive().optional(),
  code: z
    .string()
    .trim()
    .min(3, "Code must be at least 3 characters")
    .max(40, "Code must be 40 characters or fewer")
    .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, hyphens and underscores are allowed"),
  description: z.string().optional().nullable(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().positive("Discount value must be positive"),
  maxDiscountAmount: z.number().positive().optional().nullable(),
  recurringScope: z.enum(["first_month", "every_month"]),
  planIds: z.array(z.number().int().positive()).optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  validUntil: z.coerce.date().optional().nullable(),
  isActive: z.boolean(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<PromoCodes>;

export const postAdminUpsertPromoCode = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/promo-codes/upsert`, {
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
