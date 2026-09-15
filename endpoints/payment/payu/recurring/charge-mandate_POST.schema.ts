import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  subscriptionId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
};

export const postPaymentPayuRecurringChargeMandate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/payment/payu/recurring/charge-mandate`, {
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