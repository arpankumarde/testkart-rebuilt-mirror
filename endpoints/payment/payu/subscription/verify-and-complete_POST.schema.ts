import { z } from "zod";
import superjson from 'superjson';
import { TransactionStatus } from '../../../../helpers/schema';

export const schema = z.object({
  txnid: z.string().min(1).optional(),
  transactionId: z.number().int().positive().optional()
}).refine((data) => data.txnid || data.transactionId, {
  message: "Either txnid or transactionId must be provided"
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  status: Extract<TransactionStatus, 'completed' | 'pending' | 'failed'> | null;
  transactionId: number | null;
  subscriptionId?: number | null;
  message: string;
};

export const postPaymentPayuSubscriptionVerifyAndComplete = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/payment/payu/subscription/verify-and-complete`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!result.ok) {
    try {
      const errorObject = superjson.parse<OutputType>(await result.text());
      throw new Error(errorObject.message || "Subscription verification request failed");
    } catch (e) {
      throw new Error(`Subscription verification request failed with status ${result.status}`);
    }
  }

  return superjson.parse<OutputType>(await result.text());
};