import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema } from "./invoice-zip_POST.schema";
import superjson from "superjson";
import JSZip from "jszip";
import { generateSubscriptionInvoicePdf, InvoiceNotEligibleError } from "../../../helpers/generateSubscriptionInvoicePdf";
import { processSubscriptionInvoiceQueue } from "../../../helpers/invoiceNumbering";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "billing_manager"]);

    const json = superjson.parse(await request.text());
    const { transactionIds } = schema.parse(json);

    await processSubscriptionInvoiceQueue();

    const zip = new JSZip();
    let includedCount = 0;
    const skipped: number[] = [];

    for (const transactionId of transactionIds) {
      try {
        const { pdfBuffer, invoiceNumber } = await generateSubscriptionInvoicePdf(transactionId, {
          skipQueueProcessing: true,
        });
        zip.file(`invoice-${invoiceNumber}.pdf`, pdfBuffer);
        includedCount++;
      } catch (error) {
        if (error instanceof InvoiceNotEligibleError) {
          skipped.push(transactionId);
          continue;
        }
        console.error(`[invoice-zip] Failed to generate invoice for subscription transaction ${transactionId}:`, error);
        skipped.push(transactionId);
      }
    }

    if (includedCount === 0) {
      return new Response(
        superjson.stringify({ error: "None of the selected transactions have an eligible invoice." }),
        { status: 400 }
      );
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="subscription-invoices.zip"`,
      },
    });
  } catch (error) {
    console.error("[admin/subscription-transactions/invoice-zip] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
