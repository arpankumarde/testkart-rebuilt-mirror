import { z } from "zod";
import superjson from "superjson";
import { OrderStatus } from "../../../helpers/schema";
import { VerifyPaymentResult } from "../../../helpers/verifyPayUPayment";

export const schema = z.object({
  orderId: z.number(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
  order: {
    id: number;
    previousStatus: OrderStatus;
    newStatus: OrderStatus;
  } | null;
  verificationDetails?: VerifyPaymentResult;
};

export const postReconcileOrder = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/orders/reconcile`, {
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