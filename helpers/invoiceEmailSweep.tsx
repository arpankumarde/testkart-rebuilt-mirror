import { db } from "./db";
import { processSalesInvoiceQueue, processSubscriptionInvoiceQueue } from "./invoiceNumbering";
import { sendSubscriptionInvoiceEmail } from "./sendSubscriptionInvoiceEmail";

// How many subscription invoices to email per run. Numbering has no such cap
// since it is cheap; sending (PDF render + outbound email) is bounded and the
// next run (5 minutes later) picks up any remainder.
const EMAIL_BATCH_SIZE = 100;

/**
 * Scheduled job: the single mechanism that (a) assigns gapless invoice
 * numbers to newly-completed, paid orders and subscription payments, and
 * (b) emails the PDF invoice for teacher subscription payments.
 *
 * Student order invoices are no longer emailed (since 20-11-2026); students
 * download them from their Orders page.
 *
 * Deliberately NOT wired into the payment/checkout code paths directly —
 * this runs as a periodic sweep instead, which keeps invoice numbering and
 * emailing completely decoupled from (and unable to ever regress) live
 * payment processing. A few minutes' delay between "payment completes" and
 * "invoice email arrives" is an acceptable trade-off for that safety.
 */
export async function invoiceEmailSweep(): Promise<void> {
  console.log("[invoiceEmailSweep] Starting scheduled job...");

  let salesNumbered = 0;
  let subscriptionNumbered = 0;
  try {
    salesNumbered = await processSalesInvoiceQueue();
  } catch (error) {
    console.error("[invoiceEmailSweep] Failed to process sales invoice queue:", error);
  }
  try {
    subscriptionNumbered = await processSubscriptionInvoiceQueue();
  } catch (error) {
    console.error("[invoiceEmailSweep] Failed to process subscription invoice queue:", error);
  }
  console.log(`[invoiceEmailSweep] Assigned ${salesNumbered} sales invoice number(s), ${subscriptionNumbered} subscription invoice number(s)`);

  let subscriptionEmailed = 0;
  try {
    const pendingSubscriptionEmails = await db
      .selectFrom("subscriptionTransactions")
      .select(["id"])
      .where("status", "=", "completed")
      .where("invoiceNumber", "is not", null)
      .where("invoiceEmailSentAt", "is", null)
      .orderBy("createdAt", "asc")
      .limit(EMAIL_BATCH_SIZE)
      .execute();

    for (const txn of pendingSubscriptionEmails) {
      await sendSubscriptionInvoiceEmail(txn.id);
      subscriptionEmailed++;
    }
  } catch (error) {
    console.error("[invoiceEmailSweep] Failed to sweep subscription invoice emails:", error);
  }

  console.log(`[invoiceEmailSweep] Sent ${subscriptionEmailed} subscription invoice email(s)`);
  console.log("[invoiceEmailSweep] Scheduled job completed.");
}
