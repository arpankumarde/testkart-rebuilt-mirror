import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  planId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
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
  // Standing Instruction (SI) parameters
  si: string;
  si_details: string; // JSON string containing billingAmount, billingCycle, billingInterval, paymentStartDate, paymentEndDate, billingCurrency
};

export const postPaymentPayuRecurringCreateMandate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/payment/payu/recurring/create-mandate`, {
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