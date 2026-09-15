import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  promoCodeId: z.number().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  orderId: number;
  walletBalanceAfter: number;
  amountDeducted: number;
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