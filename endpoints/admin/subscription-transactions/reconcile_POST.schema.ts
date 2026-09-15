import { z } from "zod";
import superjson from "superjson";
import { TransactionStatus } from "../../../helpers/schema";
import { VerifyPaymentResult } from "../../../helpers/verifyPayUPayment";

export const schema = z.object({
  transactionId: z.number(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
  transaction: {
    id: number;
    previousStatus: TransactionStatus;
    newStatus: TransactionStatus;
  } | null;
  verificationDetails?: VerifyPaymentResult;
};

export const postReconcileSubscriptionTransaction = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/subscription-transactions/reconcile`, {
    method: "POST",
    body: superjson.stringify(body),
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