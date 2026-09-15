import { z } from "zod";
import superjson from 'superjson';
import { OrderStatus, OrderStatusArrayValues } from '../../../helpers/schema';

export const schema = z.object({
  txnid: z.string().min(1).optional(),
  orderId: z.number().optional()
}).refine(data => data.txnid || data.orderId, {
  message: "Either txnid or orderId must be provided"
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  orderStatus: OrderStatus | null;
  orderId: number | null;
  message: string;
};

export const postPaymentPayuVerifyAndComplete = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/payment/payu/verify-and-complete`, {
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
      throw new Error(errorObject.message || "Verification request failed");
    } catch (e) {
      // Fallback if parsing fails
      throw new Error(`Verification request failed with status ${result.status}`);
    }
  }

  return superjson.parse<OutputType>(await result.text());
};