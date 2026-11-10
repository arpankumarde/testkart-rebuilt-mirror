import { z } from "zod";
import superjson from "superjson";
import type { OrderStatus } from "../../../helpers/schema";

export const schema = z.object({
  orderId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  orderStatus: OrderStatus | null;
  orderId: number | null;
  message: string;
};

export const postPaymentCashfreeVerify = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/payment/cashfree/verify`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error?: string; message?: string }>(await result.text());
    throw new Error(errorObject.error || errorObject.message || "Payment verification failed");
  }
  return superjson.parse<OutputType>(await result.text());
};
