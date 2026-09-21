import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema } from "./invoice-zip_POST.schema";
import superjson from "superjson";
import JSZip from "jszip";
import { generateSalesInvoicePdf, InvoiceNotEligibleError } from "../../../helpers/generateSalesInvoicePdf";
import { processSalesInvoiceQueue } from "../../../helpers/invoiceNumbering";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { orderIds } = schema.parse(json);

    // Run the numbering queue ONCE up front rather than once per invoice
    // (generateSalesInvoicePdf normally does this itself, but that would
    // mean one advisory-lock transaction per order in this loop).
    await processSalesInvoiceQueue();

    const zip = new JSZip();
    let includedCount = 0;
    const skipped: number[] = [];

    for (const orderId of orderIds) {
      try {
        const { pdfBuffer, invoiceNumber } = await generateSalesInvoicePdf(orderId, {
          skipQueueProcessing: true,
        });
        zip.file(`invoice-${invoiceNumber}.pdf`, pdfBuffer);
        includedCount++;
      } catch (error) {
        if (error instanceof InvoiceNotEligibleError) {
          skipped.push(orderId);
          continue;
        }
        console.error(`[invoice-zip] Failed to generate invoice for order ${orderId}:`, error);
        skipped.push(orderId);
      }
    }

    if (includedCount === 0) {
      return new Response(
        superjson.stringify({ error: "None of the selected orders have an eligible invoice." }),
        { status: 400 }
      );
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="sales-invoices.zip"`,
      },
    });
  } catch (error) {
    console.error("[admin/orders/invoice-zip] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
