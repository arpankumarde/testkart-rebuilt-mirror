import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Orders } from "../../helpers/schema";
import type { PaymentFailureReason } from "../../helpers/paymentFailureReason";

export const schema = z.object({
  id: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type ItemType = "test" | "course" | "product" | "bundle";

export type OrderItem = {
  orderItemId: number;
  itemType: ItemType;
  mockTestId: number | null;
  courseId: number | null;
  digitalProductId: number | null;
  bundleId: number | null;
  title: string;
  thumbnailUrl: string | null;
  priceAtPurchase: number;
};

export type OutputType = {
  id: number;
  status: Selectable<Orders>["status"];
  subtotal: number;
  discountAmount: number;
  promoCode: string | null;
  totalAmount: number;
  createdAt: Date | null;
  paymentTransactionId: string | null;
  items: OrderItem[];
  // Only for failed and cancelled orders with a PayU reason on record
  paymentFailure: {
    reason: PaymentFailureReason;
    message: string;
  } | null;
};

export const getOrdersDetails = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    id: validatedParams.id.toString(),
  });

  const result = await fetch(`/_api/orders/details?${searchParams.toString()}`, {
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