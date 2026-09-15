import { db } from "./db";
import { sql, type Transaction } from "kysely";
import type { DB } from "./schema";

/**
 * Gapless, chronologically-ordered invoice numbering.
 *
 * Design notes (read before touching this file):
 *
 * - Numbers are assigned lazily via a "queue" of completed, non-free
 *   records that don't have a number yet, processed strictly in
 *   created_at/id order. This is what guarantees there are never gaps:
 *   a number is only ever consumed once we're certain the row it belongs
 *   to will keep it (we hold a row lock for the duration of the check).
 * - IMPORTANT: this app's DB pool is configured with max: 1 connection
 *   (see helpers/db.tsx). That means a `db.transaction()` call made from
 *   INSIDE another already-open transaction's callback will deadlock
 *   forever (the outer transaction holds the only connection, and the
 *   inner one queues waiting for a connection that will never free up).
 *   Every function below that participates in a batch (the
 *   process*InvoiceQueue functions) therefore takes an explicit
 *   Transaction<DB> and never opens a new one internally.
 * - The whole queue-walk is serialized with a Postgres advisory lock
 *   (auto-released at transaction end) so the scheduled sweep and an
 *   on-demand admin download can never race each other into assigning
 *   numbers out of chronological order.
 * - Both series (sales and subscription) start fresh from 00001 and cover
 *   the FULL order history — every completed, non-free order/transaction
 *   ever recorded gets picked up and numbered in strict chronological
 *   order the first time the queue runs, with no special-cased anchor.
 */

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function formatSalesInvoiceNumber(seq: number, date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1, 2);
  return `${year}-${month}-${pad(seq, 5)}`;
}

export function formatSubscriptionInvoiceNumber(seq: number, date: Date): string {
  const d = new Date(date);
  const yy = pad(d.getFullYear() % 100, 2);
  const mm = pad(d.getMonth() + 1, 2);
  return `S-${yy}-${mm}-${pad(seq, 5)}`;
}

async function incrementCounter(trx: Transaction<DB>, series: "sales" | "subscription"): Promise<number> {
  const result = await trx
    .updateTable("invoiceCounters")
    .set((eb) => ({ lastNumber: eb("lastNumber", "+", 1), updatedAt: new Date() }))
    .where("series", "=", series)
    .returning("lastNumber")
    .executeTakeFirstOrThrow();
  return result.lastNumber;
}

async function assignOneSalesInvoiceNumberInTrx(trx: Transaction<DB>, orderId: number): Promise<string | null> {
  const order = await trx
    .selectFrom("orders")
    .select(["id", "totalAmount", "status", "invoiceNumber", "createdAt"])
    .where("id", "=", orderId)
    .forUpdate()
    .executeTakeFirst();

  if (!order || order.status !== "completed") return null;
  if (order.invoiceNumber) return order.invoiceNumber;

  const totalAmount = parseFloat(order.totalAmount as unknown as string);
  if (totalAmount <= 0) return null;

  const seq = await incrementCounter(trx, "sales");
  const invoiceNumber = formatSalesInvoiceNumber(seq, order.createdAt ?? new Date());

  await trx.updateTable("orders").set({ invoiceNumber }).where("id", "=", orderId).execute();

  return invoiceNumber;
}

async function assignOneSubscriptionInvoiceNumberInTrx(trx: Transaction<DB>, transactionId: number): Promise<string | null> {
  const txn = await trx
    .selectFrom("subscriptionTransactions")
    .select(["id", "amount", "status", "invoiceNumber", "createdAt"])
    .where("id", "=", transactionId)
    .forUpdate()
    .executeTakeFirst();

  if (!txn || txn.status !== "completed") return null;
  if (txn.invoiceNumber) return txn.invoiceNumber;

  const amount = parseFloat(txn.amount as unknown as string);
  if (amount <= 0) return null;

  const seq = await incrementCounter(trx, "subscription");
  const invoiceNumber = formatSubscriptionInvoiceNumber(seq, txn.createdAt ?? new Date());

  await trx
    .updateTable("subscriptionTransactions")
    .set({ invoiceNumber })
    .where("id", "=", transactionId)
    .execute();

  return invoiceNumber;
}

/**
 * Assigns an invoice number to a single completed, non-free order if it
 * doesn't have one yet. Opens its own transaction — do NOT call this from
 * inside another already-open transaction (see the pool-size note above).
 * Idempotent — safe to call repeatedly.
 */
export async function assignOneSalesInvoiceNumber(orderId: number): Promise<string | null> {
  return db.transaction().execute((trx) => assignOneSalesInvoiceNumberInTrx(trx, orderId));
}

/** Same as assignOneSalesInvoiceNumber, for teacher subscription payments. */
export async function assignOneSubscriptionInvoiceNumber(transactionId: number): Promise<string | null> {
  return db.transaction().execute((trx) => assignOneSubscriptionInvoiceNumberInTrx(trx, transactionId));
}

/**
 * Walks the queue of unnumbered, eligible completed orders in strict
 * created_at/id order and assigns each one a number. Call this before
 * reading an order's invoice_number if it might not have been processed by
 * the scheduled sweep yet (e.g. an admin downloading an invoice moments
 * after payment) — it guarantees any earlier-completed orders get their
 * numbers first, preserving chronological ordering.
 *
 * Runs entirely inside ONE transaction (advisory lock + every row) — see
 * the file-level note on why nested transactions must never happen here.
 */
export async function processSalesInvoiceQueue(limit = 2000): Promise<number> {
  let assignedCount = 0;
  await db.transaction().execute(async (trx) => {
    const lockResult = await sql<{ locked: boolean }>`SELECT pg_try_advisory_xact_lock(hashtext('invoice_sales_queue')) as locked`.execute(trx);
    if (!lockResult.rows[0]?.locked) {
      console.log("[invoiceNumbering] Sales invoice queue is already being processed elsewhere, skipping");
      return;
    }

    const pending = await trx
      .selectFrom("orders")
      .select(["id"])
      .where("status", "=", "completed")
      .where("invoiceNumber", "is", null)
      .where("totalAmount", ">", "0")
      .orderBy("createdAt", "asc")
      .orderBy("id", "asc")
      .limit(limit)
      .execute();

    for (const row of pending) {
      const assigned = await assignOneSalesInvoiceNumberInTrx(trx, row.id);
      if (assigned) assignedCount++;
    }
  });
  return assignedCount;
}

/** Same as processSalesInvoiceQueue, for teacher subscription payments. */
export async function processSubscriptionInvoiceQueue(limit = 2000): Promise<number> {
  let assignedCount = 0;
  await db.transaction().execute(async (trx) => {
    const lockResult = await sql<{ locked: boolean }>`SELECT pg_try_advisory_xact_lock(hashtext('invoice_subscription_queue')) as locked`.execute(trx);
    if (!lockResult.rows[0]?.locked) {
      console.log("[invoiceNumbering] Subscription invoice queue is already being processed elsewhere, skipping");
      return;
    }

    const pending = await trx
      .selectFrom("subscriptionTransactions")
      .select(["id"])
      .where("status", "=", "completed")
      .where("invoiceNumber", "is", null)
      .where("amount", ">", "0")
      .orderBy("createdAt", "asc")
      .orderBy("id", "asc")
      .limit(limit)
      .execute();

    for (const row of pending) {
      const assigned = await assignOneSubscriptionInvoiceNumberInTrx(trx, row.id);
      if (assigned) assignedCount++;
    }
  });
  return assignedCount;
}
