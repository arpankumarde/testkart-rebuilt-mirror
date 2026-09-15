import { z } from "zod";
import type { Selectable } from "kysely";
import type { Orders } from "../../helpers/schema";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

type OrderListItem = Pick<
  Selectable<Orders>,
  "id" | "createdAt" | "status" | "totalAmount"
> & {
  itemCount: number;
};

export type OutputType = {
  orders: OrderListItem[];
};

export const getOrdersList = async (
  body?: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/orders/list`, {
    method: "GET",
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