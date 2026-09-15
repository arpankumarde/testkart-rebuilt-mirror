import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { lookupPayUTransactions } from "../../../helpers/lookupPayUTransactions";
import { extractPayUFailure, PAYU_NOT_FOUND_STATUS, PaymentFailureColumns } from "../../../helpers/extractPayUFailure";
import { schema, OutputType, BackfillFailureReasonResult, BackfillSource } from "./backfill-failure-reasons_POST.schema";
import superjson from "superjson";

const DEFAULT_LIMIT = 100;
const PAYU_BATCH_SIZE = 25;

const EMPTY_COLUMNS: PaymentFailureColumns = {
  paymentErrorCode: null,
  paymentErrorMessage: null,
  paymentBankMessage: null,
  paymentGatewayStatus: null,
};

type Candidate = { id: number; status: string; paymentTransactionId: string | null };

const ordersWithoutReason = (beforeId?: number) => {
  let query = db
    .selectFrom("orders")
    .where("paymentMethod", "=", "payu")
    .where("status", "in", ["failed", "cancelled"])
    .where("paymentTransactionId", "is not", null)
    .where("paymentErrorCode", "is", null)
    .where("paymentErrorMessage", "is", null)
    .where("paymentBankMessage", "is", null)
    .where("paymentGatewayStatus", "is", null);
  if (beforeId) query = query.where("id", "<", beforeId);
  return query;
};

const subscriptionsWithoutReason = (beforeId?: number) => {
  let query = db
    .selectFrom("subscriptionTransactions")
    .where("paymentMethod", "in", ["payu", "payu_recurring"])
    .where("status", "=", "failed")
    .where("transactionId", "is not", null)
    .where("paymentErrorCode", "is", null)
    .where("paymentErrorMessage", "is", null)
    .where("paymentBankMessage", "is", null)
    .where("paymentGatewayStatus", "is", null);
  if (beforeId) query = query.where("id", "<", beforeId);
  return query;
};

const fetchCandidates = (source: BackfillSource, limit: number, beforeId?: number): Promise<Candidate[]> =>
  source === "subscriptions"
    ? subscriptionsWithoutReason(beforeId)
        .select(["id", "status", "transactionId as paymentTransactionId"])
        .orderBy("id", "desc")
        .limit(limit)
        .execute()
    : ordersWithoutReason(beforeId)
        .select(["id", "status", "paymentTransactionId"])
        .orderBy("id", "desc")
        .limit(limit)
        .execute();

const countCandidates = async (source: BackfillSource, beforeId: number): Promise<number> => {
  const row =
    source === "subscriptions"
      ? await subscriptionsWithoutReason(beforeId).select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirst()
      : await ordersWithoutReason(beforeId).select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirst();
  return Number(row?.count ?? 0);
};

// Writes only the four reason columns, and only while the row still has none.
const writeColumns = (source: BackfillSource, id: number, columns: PaymentFailureColumns) =>
  source === "subscriptions"
    ? db
        .updateTable("subscriptionTransactions")
        .set(columns)
        .where("id", "=", id)
        .where("status", "=", "failed")
        .where("paymentGatewayStatus", "is", null)
        .execute()
    : db
        .updateTable("orders")
        .set(columns)
        .where("id", "=", id)
        .where("status", "in", ["failed", "cancelled"])
        .where("paymentGatewayStatus", "is", null)
        .execute();

/**
 * Fills the payment failure columns for PayU payments that have none, by asking the PayU Verify
 * Payment API. Payment status is never changed.
 */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "billing_manager"]);

    const text = await request.text();
    const input = schema.parse(text ? superjson.parse(text) : {});
    const source = input.source ?? "orders";
    const limit = input.limit ?? DEFAULT_LIMIT;
    const dryRun = input.dryRun ?? false;

    const candidates = await fetchCandidates(source, limit, input.beforeId);
    const results: BackfillFailureReasonResult[] = [];

    for (let start = 0; start < candidates.length; start += PAYU_BATCH_SIZE) {
      const batch = candidates.slice(start, start + PAYU_BATCH_SIZE);
      const lookup = await lookupPayUTransactions(batch.map((row) => row.paymentTransactionId!));

      for (const row of batch) {
        if (!lookup.ok) {
          results.push({ id: row.id, status: row.status, outcome: "lookup_error", ...EMPTY_COLUMNS });
          continue;
        }

        const details = lookup.transactions[row.paymentTransactionId!];
        const columns: PaymentFailureColumns = details
          ? extractPayUFailure(details)
          : { ...EMPTY_COLUMNS, paymentGatewayStatus: PAYU_NOT_FOUND_STATUS };

        if (!dryRun) {
          await writeColumns(source, row.id, columns);
        }

        results.push({ id: row.id, status: row.status, outcome: details ? "updated" : "not_found", ...columns });
      }
    }

    const nextBeforeId = candidates.length === limit ? candidates[candidates.length - 1].id : null;
    const remaining = nextBeforeId !== null ? await countCandidates(source, nextBeforeId) : 0;
    const lookupErrors = results.filter((r) => r.outcome === "lookup_error").length;

    console.log(
      `[BackfillFailureReasons] source=${source} processed=${results.length} lookupErrors=${lookupErrors} dryRun=${dryRun} nextBeforeId=${nextBeforeId}`
    );

    return new Response(
      superjson.stringify({
        source,
        dryRun,
        processed: results.length,
        updated: results.filter((r) => r.outcome === "updated").length,
        notFound: results.filter((r) => r.outcome === "not_found").length,
        lookupErrors,
        nextBeforeId,
        remaining,
        results,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[BackfillFailureReasons] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}