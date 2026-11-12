import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  orderId: z.number().int().positive(),
  /** The new total the student accepted after an amountChanged answer. Omit on the first try. */
  confirmedAmount: z.number().nonnegative().optional(),
});

export type InputType = z.infer<typeof schema>;

export type PayuFormFields = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  payuUrl: string;
};

export type OutputType =
  // Post these fields to PayU (postPaymentPayuRedirect). The order is pending under a new txnid.
  | { kind: "redirect"; orderId: number; payu: PayuFormFields }
  // Nothing was changed: the order now costs a different amount. Retry with confirmedAmount to pay it.
  | { kind: "amountChanged"; orderId: number; previousAmount: number; newAmount: number; notes: string[] };

export const postOrdersRetryPayment = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/orders/retry-payment`, {
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
