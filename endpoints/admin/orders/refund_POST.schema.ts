import { z } from "zod";
import superjson from "superjson";
import { OrderStatus } from "../../../helpers/schema";

export const schema = z.object({
  orderId: z.number(),
  // Shown to the student on their order and to the teacher in their earnings.
  reason: z.string().trim().min(1, "Add a reason for the refund").max(500),
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
};

export const postRefundOrder = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/orders/refund`, {
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