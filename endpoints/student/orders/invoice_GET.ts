import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema } from "./invoice_GET.schema";
import superjson from "superjson";
import { generateSalesInvoicePdf, InvoiceNotEligibleError } from "../../../helpers/generateSalesInvoicePdf";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can download their own invoices." }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const queryParams = {
      orderId: url.searchParams.get("orderId"),
    };

    const { orderId } = schema.parse(queryParams);

    // Ownership check — students may only download invoices for their own orders.
    const order = await db
      .selectFrom("orders")
      .where("id", "=", orderId)
      .select(["id", "userId"])
      .executeTakeFirst();

    if (!order || order.userId !== user.id) {
      return new Response(
        superjson.stringify({ error: "Order not found." }),
        { status: 404 }
      );
    }

    const { pdfBuffer, invoiceNumber } = await generateSalesInvoicePdf(orderId);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate student invoice:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: error instanceof InvoiceNotEligibleError ? 400 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
