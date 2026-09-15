import { z } from "zod";
import superjson from "superjson";
import { OrderStatus } from "../../../helpers/schema";

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
};

export const postMarkOrderFailed = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/orders/mark-failed`, {
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