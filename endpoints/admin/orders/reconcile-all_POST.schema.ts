import { z } from "zod";
import superjson from "superjson";
import { OrderStatus } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  totalPending: number;
  reconciled: number;
  markedFailed: number;
  stillPending: number;
  errors: number;
  details: Array<{
    orderId: number;
    previousStatus: OrderStatus;
    newStatus: OrderStatus;
    message: string;
  }>;
};

export const postReconcileAllOrders = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/orders/reconcile-all`, {
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