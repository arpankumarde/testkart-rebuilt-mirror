import { z } from "zod";
import superjson from "superjson";

// No input schema needed for this POST request
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  verifiedCount: number;
  updatedOrders: {
    orderId: number;
    previousStatus: "pending";
    newStatus: "completed" | "failed";
  }[];
  verifiedSubscriptionTransactionsCount: number;
  updatedSubscriptionTransactions: {
    transactionId: number;
    previousStatus: "pending";
    newStatus: "completed" | "failed";
  }[];
};

export const postVerifyPendingPayments = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/payment/payu/verify-pending`, {
    method: "POST",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};