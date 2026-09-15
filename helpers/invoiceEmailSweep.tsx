import { db } from "./db";
import { processSalesInvoiceQueue, processSubscriptionInvoiceQueue } from "./invoiceNumbering";
import { sendSalesInvoiceEmail } from "./sendSalesInvoiceEmail";
import { sendSubscriptionInvoiceEmail } from "./sendSubscriptionInvoiceEmail";

// How many newly-eligible records to email per run. The queue-processing
// step above this (processSalesInvoiceQueue/processSubscriptionInvoiceQueue)
// has no such cap since numbering is cheap; sending is comparatively
// expensive (PDF render + outbound email), so we bound it and let the next
// run (5 minutes later) pick up any remainder.
const EMAIL_BATCH_SIZE = 100;

/**
 * Scheduled job: the single mechanism that (a) assigns gapless invoice
 * numbers to newly-completed, paid orders and subscription payments, and
 * (b) emails the resulting PDF invoice to the student/teacher.
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

  let salesEmailed = 0;
  try {
    const pendingSalesEmails = await db
      .selectFrom("orders")
      .select(["id"])
      .where("status", "=", "completed")
      .where("invoiceNumber", "is not", null)
      .where("invoiceEmailSentAt", "is", null)
      .orderBy("createdAt", "asc")
      .limit(EMAIL_BATCH_SIZE)
      .execute();

    for (const order of pendingSalesEmails) {
      await sendSalesInvoiceEmail(order.id);
      salesEmailed++;
    }
  } catch (error) {
    console.error("[invoiceEmailSweep] Failed to sweep sales invoice emails:", error);
  }

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

  console.log(`[invoiceEmailSweep] Sent ${salesEmailed} sales invoice email(s), ${subscriptionEmailed} subscription invoice email(s)`);
  console.log("[invoiceEmailSweep] Scheduled job completed.");
}
