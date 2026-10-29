import { z } from "zod";
import superjson from "superjson";
import type { OrderStatus } from "../../../helpers/schema";
import type { PaymentFailureDetails } from "../../../helpers/paymentFailureReason";
import type { OrderClientDeviceType, OrderClientSource, OrderPlatform } from "../../../helpers/orderAttribution";
import { adminOrderFiltersSchema, adminOrderSortSchema } from "../../../helpers/adminOrderFilters";
import type { PurchasedItemDetail } from "../orders_GET.schema";

export const schema = z.object({
  filters: adminOrderFiltersSchema,
  sort: adminOrderSortSchema,
  page: z.number().int().min(1).max(10_000).default(1),
  pageSize: z.number().int().min(10).max(200).default(50),
});

export type InputType = z.input<typeof schema>;

/** Where an order was placed from; null for orders created before 05-11-2026. */
export type AdminOrderClient = {
  source: OrderClientSource;
  platform: OrderPlatform;
  deviceType: OrderClientDeviceType;
  osName: string | null;
  osVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  deviceBrand: string | null;
  deviceModel: string | null;
  appVersion: string | null;
  screen: string | null;
  referrer: string | null;
  userAgent: string | null;
  ip: string | null;
};

export type AdminOrderRow = {
  id: number;
  createdAt: Date | null;
  paidAt: Date | null;
  studentId: number;
  studentName: string;
  studentEmail: string | null;
  studentPhone: string | null;
  isSponsored: boolean;
  teacherId: number | null;
  teacherName: string | null;
  purchasedItems: string | null;
  purchasedItemDetails: PurchasedItemDetail[];
  totalAmount: number;
  discountAmount: number;
  tcoinsRedeemed: number;
  status: OrderStatus;
  paymentMethod: string | null;
  paymentMode: string | null;
  paymentTransactionId: string | null;
  invoiceNumber: string | null;
  promoCodeId: number | null;
  promoCode: string | null;
  refundedAt: Date | null;
  refundReason: string | null;
  /** Only for failed and cancelled orders with a PayU reason on record. */
  paymentFailure: PaymentFailureDetails | null;
  client: AdminOrderClient | null;
};

export type OutputType = {
  rows: AdminOrderRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Rows that Reconcile all pending would pick up, across every order, not just this filter. */
  reconcilable: number;
};

export const postAdminOrdersSearch = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/orders/search`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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
