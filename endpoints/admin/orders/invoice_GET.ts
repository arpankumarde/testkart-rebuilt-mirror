import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema } from "./invoice_GET.schema";
import superjson from "superjson";
import { generateSalesInvoicePdf, InvoiceNotEligibleError } from "../../../helpers/generateSalesInvoicePdf";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const queryParams = {
      orderId: url.searchParams.get("orderId"),
    };

    const { orderId } = schema.parse(queryParams);

    const { pdfBuffer, invoiceNumber } = await generateSalesInvoicePdf(orderId);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate invoice:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: error instanceof InvoiceNotEligibleError ? 400 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
