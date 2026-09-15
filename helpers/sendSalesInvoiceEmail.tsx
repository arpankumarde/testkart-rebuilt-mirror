import { db } from "./db";
import { sendEmail } from "./sendEmail";
import { getBrandedEmailHtml } from "./emailBaseTemplate";
import { generateSalesInvoicePdf, InvoiceNotEligibleError } from "./generateSalesInvoicePdf";

// How long to keep retrying an order whose buyer has no email yet. Mobile-OTP
// signups routinely add an email minutes after checkout and the sweep runs
// every 5 minutes, so retrying rescues the common case for almost nothing.
// The window has to be bounded: an order that never gets an email would
// otherwise sit in the pending set forever, and since the sweep takes the 100
// oldest unsent orders, a growing backlog of those would eventually starve new
// orders out of the batch.
const NO_EMAIL_RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Emails the tax invoice PDF for a completed, paid order to the student.
 * Safe to call repeatedly and concurrently — the actual send is gated by an
 * atomic claim on orders.invoice_email_sent_at, so it can only ever fire
 * once per order. Never throws; failures are logged only, matching the
 * fire-and-forget convention used by sendOrderConfirmationEmails.
 *
 * An order whose buyer has no email yet is left UNCLAIMED so a later sweep can
 * still deliver it. Claiming it immediately used to lose the invoice for good:
 * the buyer verifies an email a minute after checkout, but the column is
 * already stamped and the sweep never looks at that order again.
 */
export async function sendSalesInvoiceEmail(orderId: number): Promise<void> {
  try {
    const existing = await db
      .selectFrom("orders")
      .innerJoin("users", "users.id", "orders.userId")
      .select(["orders.invoiceEmailSentAt", "orders.createdAt", "users.email as studentEmail"])
      .where("orders.id", "=", orderId)
      .executeTakeFirst();
    if (!existing) {
      console.log(`[sendSalesInvoiceEmail] Order ${orderId} not found or has no user row, skipping`);
      return;
    }
    if (existing.invoiceEmailSentAt) return;

    // Cheap check before the expensive PDF render, so an order waiting on an
    // email costs one indexed query per sweep rather than a full render.
    if (!existing.studentEmail) {
      const orderAge = Date.now() - new Date(existing.createdAt ?? Date.now()).getTime();
      if (orderAge < NO_EMAIL_RETRY_WINDOW_MS) {
        console.log(`[sendSalesInvoiceEmail] Order ${orderId} has no student email on file yet, leaving unclaimed for a later sweep`);
        return;
      }
      console.log(`[sendSalesInvoiceEmail] Order ${orderId} still has no student email after the retry window, marking as handled without sending`);
      await db.updateTable("orders").set({ invoiceEmailSentAt: new Date() }).where("id", "=", orderId).where("invoiceEmailSentAt", "is", null).execute();
      return;
    }

    // Generate first, claim second: a transient PDF-generation failure
    // (e.g. a font fetch blip) shouldn't permanently mark this order as
    // "emailed" and skip it on every future sweep run.
    const { pdfBuffer, invoiceNumber, studentName, studentEmail } = await generateSalesInvoicePdf(orderId);

    if (!studentEmail) {
      // Raced with the pre-check above - leave unclaimed so a later sweep retries.
      console.log(`[sendSalesInvoiceEmail] Order ${orderId} lost its student email between the pre-check and the render, leaving unclaimed`);
      return;
    }

    const claimed = await db
      .updateTable("orders")
      .set({ invoiceEmailSentAt: new Date() })
      .where("id", "=", orderId)
      .where("invoiceEmailSentAt", "is", null)
      .returning("id")
      .executeTakeFirst();

    if (!claimed) {
      console.log(`[sendSalesInvoiceEmail] Order ${orderId} invoice email already sent by another process, skipping`);
      return;
    }

    const html = getBrandedEmailHtml({
      title: `Your Invoice - ${invoiceNumber}`,
      icon: "🧾",
      accent: "success",
      heading: "Your Tax Invoice",
      subheading: `Invoice ${invoiceNumber}`,
      bodyHtml: `<p style="margin:0;">Hi ${studentName}, thank you for your purchase! Your tax invoice is attached to this email as a PDF for your records.</p>`,
      footerNote: "This is an automated invoice email sent from Testkart.",
    });

    const result = await sendEmail({
      to: studentEmail,
      subject: `Your Testkart Invoice - ${invoiceNumber}`,
      html,
      attachments: [
        {
          filename: `invoice-${invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (!result.success) {
      console.error(`[sendSalesInvoiceEmail] Failed to send invoice email for order ${orderId}:`, result.error);
    } else {
      console.log(`[sendSalesInvoiceEmail] Invoice email sent for order ${orderId} (${invoiceNumber})`);
    }
  } catch (error) {
    if (error instanceof InvoiceNotEligibleError) {
      console.log(`[sendSalesInvoiceEmail] Order ${orderId} not eligible for an invoice: ${error.message}`);
      return;
    }
    console.error(`[sendSalesInvoiceEmail] Unexpected error for order ${orderId}:`, error);
  }
}
