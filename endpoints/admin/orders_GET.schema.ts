import { z } from "zod";
import superjson from "superjson";
import { OrderStatus, OrderStatusArrayValues } from "../../helpers/schema";
import type { PaymentFailureDetails } from "../../helpers/paymentFailureReason";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type PurchasedItemDetail = {
  title: string;
  type: 'test' | 'course' | 'product' | 'live_test' | 'bundle';
  url: string;
};

export type Order = {
  id: number;
  createdAt: Date | null;
  studentName: string;
  studentEmail: string | null;
  studentPhone: string | null;
  isSponsored: boolean;
  teacherName: string | null;
  purchasedItems: string | null;
  purchasedItemDetails: PurchasedItemDetail[];
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: string | null;
  paymentTransactionId: string | null;
  invoiceNumber: string | null;
  // Only for failed and cancelled orders with a PayU reason on record
  paymentFailure: PaymentFailureDetails | null;
};

export type OutputType = Order[];

export const getAdminOrders = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/orders`, {
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