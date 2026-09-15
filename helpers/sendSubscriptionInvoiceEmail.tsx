import { db } from "./db";
import { sendEmail } from "./sendEmail";
import { getBrandedEmailHtml } from "./emailBaseTemplate";
import { generateSubscriptionInvoicePdf, InvoiceNotEligibleError } from "./generateSubscriptionInvoicePdf";

/**
 * Emails the tax invoice PDF for a completed, paid subscription transaction
 * to the teacher. Same idempotency/retry design as sendSalesInvoiceEmail.
 */
export async function sendSubscriptionInvoiceEmail(transactionId: number): Promise<void> {
  try {
    const existing = await db
      .selectFrom("subscriptionTransactions")
      .select(["invoiceEmailSentAt"])
      .where("id", "=", transactionId)
      .executeTakeFirst();
    if (existing?.invoiceEmailSentAt) return;

    const { pdfBuffer, invoiceNumber, teacherName, teacherEmail } = await generateSubscriptionInvoicePdf(transactionId);

    if (!teacherEmail) {
      console.log(`[sendSubscriptionInvoiceEmail] Transaction ${transactionId} has no teacher email on file, marking as handled without sending`);
      await db.updateTable("subscriptionTransactions").set({ invoiceEmailSentAt: new Date() }).where("id", "=", transactionId).where("invoiceEmailSentAt", "is", null).execute();
      return;
    }

    const claimed = await db
      .updateTable("subscriptionTransactions")
      .set({ invoiceEmailSentAt: new Date() })
      .where("id", "=", transactionId)
      .where("invoiceEmailSentAt", "is", null)
      .returning("id")
      .executeTakeFirst();

    if (!claimed) {
      console.log(`[sendSubscriptionInvoiceEmail] Transaction ${transactionId} invoice email already sent by another process, skipping`);
      return;
    }

    const html = getBrandedEmailHtml({
      title: `Your Subscription Invoice - ${invoiceNumber}`,
      icon: "🧾",
      accent: "success",
      heading: "Your Tax Invoice",
      subheading: `Invoice ${invoiceNumber}`,
      bodyHtml: `<p style="margin:0;">Hi ${teacherName}, thank you for your subscription payment! Your tax invoice is attached to this email as a PDF for your records.</p>`,
      footerNote: "This is an automated invoice email sent from Testkart.",
    });

    const result = await sendEmail({
      to: teacherEmail,
      subject: `Your Testkart Subscription Invoice - ${invoiceNumber}`,
      html,
      attachments: [
        {
          filename: `invoice-${invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (!result.success) {
      console.error(`[sendSubscriptionInvoiceEmail] Failed to send invoice email for transaction ${transactionId}:`, result.error);
    } else {
      console.log(`[sendSubscriptionInvoiceEmail] Invoice email sent for transaction ${transactionId} (${invoiceNumber})`);
    }
  } catch (error) {
    if (error instanceof InvoiceNotEligibleError) {
      console.log(`[sendSubscriptionInvoiceEmail] Transaction ${transactionId} not eligible for an invoice: ${error.message}`);
      return;
    }
    console.error(`[sendSubscriptionInvoiceEmail] Unexpected error for transaction ${transactionId}:`, error);
  }
}
