import { db } from "./db";
import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import { getRobotoFonts } from "./robotoPdfFonts";
import { processSalesInvoiceQueue } from "./invoiceNumbering";
import { buildBilledToStack, buildInvoiceMetaBox, getInvoiceLogoDataUri } from "./invoicePdfShared";
import type { BillingDetails } from "../endpoints/account/billing-details_GET.schema";

export class InvoiceNotEligibleError extends Error {}

const formatDate = (date: Date | null): string => {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatCurrency = (amount: number): string => `Rs. ${amount.toFixed(2)}`;

export type SalesInvoiceResult = {
  pdfBuffer: Buffer;
  invoiceNumber: string;
  studentName: string;
  studentEmail: string | null;
};

/**
 * Builds the tax invoice PDF for a student purchase (order). Throws
 * InvoiceNotEligibleError with a user-facing message if the order doesn't
 * exist, isn't completed, or is a free order (no invoice number assigned).
 *
 * This is the single source of truth for sales invoice PDFs — used by both
 * the admin on-demand download endpoint and the automated post-payment
 * email sweep, so the PDF and invoice number are always identical wherever
 * this invoice is seen.
 *
 * Pass skipQueueProcessing: true when calling this in a loop (e.g. bulk ZIP
 * export) — the caller should run processSalesInvoiceQueue() itself ONCE
 * before the loop instead of once per order.
 */
export async function generateSalesInvoicePdf(
  orderId: number,
  options?: { skipQueueProcessing?: boolean }
): Promise<SalesInvoiceResult> {
  // Catch up any earlier-completed orders that haven't been numbered yet so
  // this order's number (if it gets one) is never assigned out of order.
  if (!options?.skipQueueProcessing) {
    await processSalesInvoiceQueue();
  }

  const order = await db
    .selectFrom("orders")
    .innerJoin("users", "users.id", "orders.userId")
    .where("orders.id", "=", orderId)
    .select([
      "orders.id",
      "orders.createdAt",
      "orders.totalAmount",
      "orders.status",
      "orders.paymentMethod",
      "orders.paymentTransactionId",
      "orders.invoiceNumber",
      "users.displayName as studentName",
      "users.email as studentEmail",
      "users.mobileNumber as studentPhone",
      "users.billingDetails as studentBillingDetails",
    ])
    .executeTakeFirst();

  if (!order) {
    throw new InvoiceNotEligibleError("Order not found");
  }
  if (order.status !== "completed") {
    throw new InvoiceNotEligibleError("Invoice can only be generated for completed orders");
  }

  const totalAmount = parseFloat(order.totalAmount as unknown as string);

  if (totalAmount <= 0) {
    throw new InvoiceNotEligibleError("Invoice cannot be generated for free orders");
  }

  const invoiceNumber = order.invoiceNumber;

  if (!invoiceNumber) {
    throw new InvoiceNotEligibleError(
      "This order's invoice number hasn't been assigned yet — please try again in a few minutes"
    );
  }

  const rawItems = await db
    .selectFrom("orderItems")
    .leftJoin("mockTests", "mockTests.id", "orderItems.mockTestId")
    .leftJoin("courses", "courses.id", "orderItems.courseId")
    .leftJoin("digitalProducts", "digitalProducts.id", "orderItems.digitalProductId")
    .where("orderItems.orderId", "=", orderId)
    .select([
      "orderItems.priceAtPurchase",
      "mockTests.title as mockTestTitle",
      "courses.title as courseTitle",
      "digitalProducts.title as digitalProductTitle",
    ])
    .execute();

  const items = rawItems.map((item) => ({
    title: item.mockTestTitle ?? item.courseTitle ?? item.digitalProductTitle ?? "Unknown Item",
    priceAtPurchase: item.priceAtPurchase,
  }));

  const companyName = "Digikind Education Private Limited";
  const companyAddress = "Sonvarsha Ghat, Chatham, Khagaria, Bihar, 851201";
  const companyGstin = "10AALCD1070H1Z5";
  const companyEmail = "account@testkart.in";
  const hsnSacCode = "999293";
  const taxRate = 0.18; // 18% IGST

  const tableBody: TableCell[][] = items.map((item) => {
    const price = parseFloat(item.priceAtPurchase as unknown as string);
    const taxableValue = price / (1 + taxRate);
    return [
      { text: item.title, margin: [5, 5, 5, 5] },
      { text: hsnSacCode, alignment: "center", margin: [5, 5, 5, 5] },
      { text: "1", alignment: "center", margin: [5, 5, 5, 5] },
      { text: formatCurrency(taxableValue), alignment: "right", margin: [5, 5, 5, 5] },
      { text: formatCurrency(taxableValue), alignment: "right", margin: [5, 5, 5, 5] },
    ];
  });

  const taxableValueTotal = totalAmount / (1 + taxRate);
  const igstTotal = totalAmount - taxableValueTotal;

  const billingDetails = (order.studentBillingDetails as BillingDetails | null) ?? null;
  const logoDataUri = await getInvoiceLogoDataUri();

  const contentArray: any[] = [
    {
      columns: [
        {
          width: "*",
          stack: [
            ...(logoDataUri ? [{ image: logoDataUri, fit: [150, 50] as [number, number], margin: [0, 0, 0, 8] }] : []),
            { text: companyName, fontSize: 20, bold: true, margin: [0, 0, 0, 4] },
            { text: companyAddress, fontSize: 9, color: "#666666" },
          ],
        },
        {
          width: "auto",
          text: "TAX INVOICE",
          fontSize: 28,
          bold: true,
          color: "#666666",
          alignment: "right",
          margin: [0, 0, 0, 0],
        },
      ],
      margin: [0, 0, 0, 10],
    },
    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#CCCCCC" }], margin: [0, 0, 0, 20] },
    {
      columns: [
        {
          width: "*",
          stack: [
            { text: "FROM", bold: true, fontSize: 10, color: "#666666", margin: [0, 0, 0, 8] },
            { text: companyName, bold: true, margin: [0, 0, 0, 4] },
            { text: companyAddress, margin: [0, 0, 0, 4] },
            { text: `GSTIN: ${companyGstin}`, margin: [0, 0, 0, 4] },
            { text: `Email: ${companyEmail}`, margin: [0, 0, 0, 0] },
          ],
        },
        {
          width: "*",
          stack: buildBilledToStack({
            billingDetails,
            fallbackName: order.studentName,
            fallbackEmail: order.studentEmail,
            fallbackPhone: order.studentPhone,
          }),
        },
      ],
      columnGap: 20,
      margin: [0, 0, 0, 20],
    },
    buildInvoiceMetaBox({
      invoiceNumber,
      invoiceDate: formatDate(order.createdAt),
      paymentReference: order.paymentTransactionId,
    }),
    {
      table: {
        headerRows: 1,
        widths: ["*", "auto", "auto", "auto", "auto"],
        body: [
          [
            { text: "DESCRIPTION", bold: true, fontSize: 10, fillColor: "#E8E8E8", margin: [5, 8, 5, 8] },
            { text: "HSN/SAC", bold: true, fontSize: 10, fillColor: "#E8E8E8", alignment: "center", margin: [5, 8, 5, 8] },
            { text: "QTY", bold: true, fontSize: 10, fillColor: "#E8E8E8", alignment: "center", margin: [5, 8, 5, 8] },
            { text: "RATE", bold: true, fontSize: 10, fillColor: "#E8E8E8", alignment: "right", margin: [5, 8, 5, 8] },
            { text: "AMOUNT", bold: true, fontSize: 10, fillColor: "#E8E8E8", alignment: "right", margin: [5, 8, 5, 8] },
          ],
          ...tableBody,
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    },
    {
      columns: [
        { width: "*", text: "" },
        {
          width: "auto",
          table: {
            widths: [120, 100],
            body: [
              [
                { text: "Taxable Value", margin: [5, 5, 5, 5], border: [false, false, false, false] },
                { text: formatCurrency(taxableValueTotal), alignment: "right", margin: [5, 5, 5, 5], border: [false, false, false, false] },
              ],
              [
                { text: "IGST @ 18%", margin: [5, 5, 5, 5], border: [false, false, false, false] },
                { text: formatCurrency(igstTotal), alignment: "right", margin: [5, 5, 5, 5], border: [false, false, false, false] },
              ],
              [
                { text: "TOTAL AMOUNT", bold: true, fillColor: "#F5F5F5", margin: [8, 8, 8, 8], border: [false, false, false, false] },
                { text: formatCurrency(totalAmount), alignment: "right", bold: true, fillColor: "#F5F5F5", margin: [8, 8, 8, 8], border: [false, false, false, false] },
              ],
            ],
          },
          layout: "noBorders",
        },
      ],
      margin: [0, 0, 0, 25],
    },
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                { text: "PAYMENT INFORMATION", bold: true, fontSize: 11, margin: [0, 0, 0, 10] },
                {
                  columns: [
                    { text: "Payment Method:", width: 120 },
                    { text: order.paymentMethod || "N/A", width: "*" },
                  ],
                  margin: [0, 0, 0, 6],
                },
                {
                  columns: [
                    { text: "Payment Status:", width: 120 },
                    { text: "PAID", color: "#00A86B", bold: true, width: "*" },
                  ],
                },
              ],
              fillColor: "#F5F5F5",
              margin: [15, 15, 15, 15],
              border: [false, false, false, false],
            },
          ],
        ],
      },
      layout: "noBorders",
    },
  ];

  const docDefinition: TDocumentDefinitions = {
    pageMargins: [40, 40, 40, 40],
    content: contentArray,
    footer: function () {
      return {
        text: "This is a computer-generated invoice and does not require a signature.",
        alignment: "center",
        fontSize: 8,
        italics: true,
        color: "#999999",
        margin: [0, 0, 0, 20],
      };
    },
    defaultStyle: {
      fontSize: 10,
      font: "Roboto",
    },
  };

  const robotoFonts = await getRobotoFonts();
  const printer = new PdfPrinter({ Roboto: robotoFonts });
  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve());
    pdfDoc.on("error", (err) => reject(err));
    pdfDoc.end();
  });

  return {
    pdfBuffer: Buffer.concat(chunks),
    invoiceNumber,
    studentName: order.studentName,
    studentEmail: order.studentEmail,
  };
}
