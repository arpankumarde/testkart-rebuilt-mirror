import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  planId: z.number().int().positive(),
  useWallet: z.boolean(),
});

export type InputType = z.infer<typeof schema>;

export type PayUFormData = {
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
  udf1: string;
};

export type OutputType = 
  | { status: "completed" }
  | { status: "payment_required"; walletDeducted: number; payuData: PayUFormData };

export const postTeacherSubscriptionWalletSubscribe = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/subscription/wallet-subscribe`, {
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