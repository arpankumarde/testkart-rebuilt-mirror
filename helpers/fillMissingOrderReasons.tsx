import { db } from "./db";
import { lookupPayUTransactions } from "./lookupPayUTransactions";
import { extractPayUFailure, PAYU_NOT_FOUND_STATUS, type PaymentFailureColumns } from "./extractPayUFailure";

const PAYU_BATCH_SIZE = 25;
// PayU settles an abandoned attempt (bounced, dropped) a few minutes after the payer leaves.
const SETTLE_MINUTES = 15;
const USER_LOOKBACK_DAYS = 30;

const NOT_FOUND_COLUMNS: PaymentFailureColumns = {
  paymentErrorCode: null,
  paymentErrorMessage: null,
  paymentBankMessage: null,
  paymentGatewayStatus: PAYU_NOT_FOUND_STATUS,
};

/**
 * Records PayU's reason on failed or cancelled PayU orders that have none, mostly checkouts replaced by a newer
 * one before PayU answered. Scoped to one student when userId is given. Never changes an order's status, and
 * skips attempts PayU still reports as pending. Returns how many orders got a reason.
 */
export async function fillMissingOrderReasons(options: { userId?: number; limit: number }): Promise<number> {
  const settledBefore = new Date(Date.now() - SETTLE_MINUTES * 60 * 1000);

  let query = db
    .selectFrom("orders")
    .select(["id", "paymentTransactionId"])
    .where("paymentMethod", "=", "payu")
    .where("status", "in", ["failed", "cancelled"])
    .where("paymentTransactionId", "is not", null)
    .where("paymentGatewayStatus", "is", null)
    .where("paymentErrorCode", "is", null)
    .where("paymentErrorMessage", "is", null)
    .where("paymentBankMessage", "is", null)
    .where("createdAt", "<", settledBefore);

  if (options.userId !== undefined) {
    query = query
      .where("userId", "=", options.userId)
      .where("createdAt", ">", new Date(Date.now() - USER_LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
  }

  const candidates = await query.orderBy("id", "desc").limit(options.limit).execute();
  let filled = 0;

  for (let start = 0; start < candidates.length; start += PAYU_BATCH_SIZE) {
    const batch = candidates.slice(start, start + PAYU_BATCH_SIZE);
    const lookup = await lookupPayUTransactions(batch.map((row) => row.paymentTransactionId!));
    if (!lookup.ok) {
      console.warn(`[fillMissingOrderReasons] PayU lookup failed (${lookup.status}); ${batch.length} orders left for later.`);
      continue;
    }

    for (const row of batch) {
      const details = lookup.transactions[row.paymentTransactionId!];
      if (details && !["success", "failure"].includes(details.status.toLowerCase())) continue;

      const result = await db
        .updateTable("orders")
        .set(details ? extractPayUFailure(details) : NOT_FOUND_COLUMNS)
        .where("id", "=", row.id)
        .where("status", "in", ["failed", "cancelled"])
        .where("paymentGatewayStatus", "is", null)
        .executeTakeFirst();
      filled += Number(result.numUpdatedRows);
    }
  }

  return filled;
}