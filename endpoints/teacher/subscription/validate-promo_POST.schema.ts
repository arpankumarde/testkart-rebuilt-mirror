import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  code: z.string().min(1, "Enter a promo code"),
  planId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  promoCodeId: number;
  code: string;
  discountAmount: number;
  finalPrice: number;
  recurringScope: "first_month" | "every_month";
};

export const postTeacherSubscriptionValidatePromo = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/subscription/validate-promo`, {
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
