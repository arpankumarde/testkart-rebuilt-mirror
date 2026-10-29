import { z } from "zod";
import superjson from "superjson";
import { TransactionStatus } from "../../../helpers/schema";
import type { PaymentFailureDetails } from "../../../helpers/paymentFailureReason";
import type { AdminOrderClient } from "../orders/search_POST.schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type SubscriptionTransactionItem = {
  id: number;
  transactionDate: Date | null;
  teacherName: string;
  teacherEmail: string | null;
  planName: string;
  amount: number;
  status: TransactionStatus;
  paymentMethod: string | null;
  transactionId: string | null;
  invoiceNumber: string | null;
  // Only for failed payments with a PayU reason on record
  paymentFailure: PaymentFailureDetails | null;
  /** Where the payment was started from; null for payments before 2026-11-09. */
  client: AdminOrderClient | null;
  /** Set on server-started renewals: the transaction whose source was copied. */
  clientInheritedFrom: number | null;
};

export type OutputType = SubscriptionTransactionItem[];

export const getAdminSubscriptionTransactions = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/subscription-transactions/list`, {
    method: "GET",
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