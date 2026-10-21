import { z } from "zod";
import superjson from "superjson";

export const schema = z
  .object({
    subscriptionId: z.number().int().positive(),
    promoDuration: z.enum(["first_month", "every_month"]).nullable(),
    promoDiscountAmount: z.number().positive().nullable(),
  })
  .refine((data) => (data.promoDuration === null) === (data.promoDiscountAmount === null), {
    message: "Set both the duration and the discount amount, or clear both.",
  });
export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
};

export const postAdminMandatesOverride = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/mandates/override`, {
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
