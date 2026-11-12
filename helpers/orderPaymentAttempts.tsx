import type { Kysely, Transaction } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import { paymentFailureReason } from "./paymentFailureReason";
import type { PaymentFailureColumns } from "./extractPayUFailure";

type Executor = Kysely<DB> | Transaction<DB>;

/**
 * Which checkout a failed order came from, when it can be paid again in place from its order page.
 * Pay-link orders (paid by someone else), sponsor and subscription payments, and non-PayU orders
 * keep their own flows.
 */
export type DirectRetryKind = "cart" | "bundle" | "live";

export function directRetryKind(order: {
  status: string;
  paymentMethod: string | null;
  payRequestId: number | null;
  paymentTransactionId: string | null;
  bundleId: number | null;
  paymentFailure: PaymentFailureColumns;
}): DirectRetryKind | null {
  if (order.status !== "failed" || order.paymentMethod !== "payu" || order.payRequestId !== null) return null;
  const txnid = order.paymentTransactionId;
  if (!txnid) return null;
  // PayU reported money on this order; it needs confirming, not a second payment.
  if (paymentFailureReason.describe(order.paymentFailure)?.reason === "payment_captured") return null;
  if (liveTestIdFromTxnid(txnid) !== null) return "live";
  if (!txnid.startsWith("testkart-")) return null;
  return order.bundleId !== null ? "bundle" : "cart";
}

export function liveTestIdFromTxnid(txnid: string): number | null {
  const match = /^live-test-(\d+)-/.exec(txnid);
  return match ? Number(match[1]) : null;
}

/** Keeps a PayU txnid an order has used. Repeats are ignored. */
export async function recordPaymentAttempt(
  trx: Transaction<DB>,
  orderId: number,
  txnid: string,
  createdAt?: Date
): Promise<void> {
  await trx
    .insertInto("orderPaymentAttempts")
    .values({ orderId, txnid, ...(createdAt ? { createdAt } : {}) })
    .onConflict((oc) => oc.column("txnid").doNothing())
    .execute();
}

/** The order a txnid belonged to, including txnids a retry has since replaced. */
export async function findAttemptOrderId(txnid: string, executor: Executor = db): Promise<number | null> {
  const row = await executor
    .selectFrom("orderPaymentAttempts")
    .select("orderId")
    .where("txnid", "=", txnid)
    .executeTakeFirst();
  return row?.orderId ?? null;
}

/**
 * PayU answered for an attempt that a retry already replaced. Keep the answer on the attempt, and when
 * PayU took money on an order that is not paid, put it on the order too so it shows as captured and
 * cannot be retried again. Returns the order id, or null when the txnid is unknown.
 */
export async function recordReplacedAttemptAnswer(
  txnid: string,
  columns: PaymentFailureColumns,
  succeeded: boolean
): Promise<number | null> {
  try {
    const attempt = await db
      .updateTable("orderPaymentAttempts")
      .set({ gatewayStatus: succeeded ? "success" : columns.paymentGatewayStatus ?? "failure", answeredAt: new Date() })
      .where("txnid", "=", txnid)
      .returning("orderId")
      .executeTakeFirst();
    if (!attempt) return null;
    if (succeeded) {
      console.error(`[PaymentAttempts] PayU captured money on replaced txnid ${txnid} of order ${attempt.orderId}. Needs reconciliation.`);
      await db
        .updateTable("orders")
        .set({ ...columns, paymentGatewayStatus: columns.paymentGatewayStatus ?? "success" })
        .where("id", "=", attempt.orderId)
        .where("status", "in", ["failed", "cancelled"])
        .execute();
    }
    return attempt.orderId;
  } catch (error) {
    console.error(`[PaymentAttempts] Could not record the answer for replaced txnid ${txnid}:`, error);
    return null;
  }
}
