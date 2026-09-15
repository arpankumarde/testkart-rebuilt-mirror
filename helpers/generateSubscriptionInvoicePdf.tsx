import { db } from "./db";
import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import { getRobotoFonts } from "./robotoPdfFonts";
import { processSubscriptionInvoiceQueue } from "./invoiceNumbering";
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

export type SubscriptionInvoiceResult = {
  pdfBuffer: Buffer;
  invoiceNumber: string;
  teacherName: string;
  teacherEmail: string | null;
};

/**
 * Builds the tax invoice PDF for a teacher's subscription payment. Mirrors
 * generateSalesInvoicePdf.tsx's design/layout, but billed to the teacher,
 * with SAC 998314 and its own "S-YY-MM-NNNNN" invoice number series.
 *
 * Pass skipQueueProcessing: true when calling this in a loop (e.g. bulk ZIP
 * export) — the caller should run processSubscriptionInvoiceQueue() itself
 * ONCE before the loop instead of once per transaction.
 */
export async function generateSubscriptionInvoicePdf(
  transactionId: number,
  options?: { skipQueueProcessing?: boolean }
): Promise<SubscriptionInvoiceResult> {
  if (!options?.skipQueueProcessing) {
    await processSubscriptionInvoiceQueue();
  }

  const txn = await db
    .selectFrom("subscriptionTransactions")
    .innerJoin("users", "users.id", "subscriptionTransactions.teacherId")
    .innerJoin("subscriptionPlans", "subscriptionPlans.id", "subscriptionTransactions.planId")
    .where("subscriptionTransactions.id", "=", transactionId)
    .select([
      "subscriptionTransactions.id",
      "subscriptionTransactions.createdAt",
      "subscriptionTransactions.amount",
      "subscriptionTransactions.status",
      "subscriptionTransactions.paymentMethod",
      "subscriptionTransactions.transactionId as paymentTransactionId",
      "subscriptionTransactions.invoiceNumber",
      "subscriptionPlans.name as planName",
      "subscriptionPlans.durationDays",
      "users.displayName as teacherName",
      "users.email as teacherEmail",
      "users.mobileNumber as teacherPhone",
      "users.academyName",
      "users.billingDetails as teacherBillingDetails",
    ])
    .executeTakeFirst();

  if (!txn) {
    throw new InvoiceNotEligibleError("Subscription transaction not found");
  }
  if (txn.status !== "completed") {
    throw new InvoiceNotEligibleError("Invoice can only be generated for completed transactions");
  }
  if (!txn.invoiceNumber) {
    throw new InvoiceNotEligibleError(
      "Invoice cannot be generated for this transaction (it may be free, or its number hasn't been assigned yet — please try again shortly)"
    );
  }

  const amount = parseFloat(txn.amount as unknown as string);

  const companyName = "Digikind Education Private Limited";
  const companyAddress = "Sonvarsha Ghat, Chatham, Khagaria, Bihar, 851201";
  const companyGstin = "10AALCD1070H1Z5";
  const companyEmail = "account@testkart.in";
  const hsnSacCode = "998314";
  const taxRate = 0.18; // 18% IGST

  const invoiceNumber = txn.invoiceNumber;
  const description = `Subscription - ${txn.planName}${txn.durationDays ? ` (${txn.durationDays} days)` : ""}`;

  const taxableValue = amount / (1 + taxRate);
  const igstTotal = amount - taxableValue;

  const billingDetails = (txn.teacherBillingDetails as BillingDetails | null) ?? null;
  const logoDataUri = await getInvoiceLogoDataUri();

  const tableBody: TableCell[][] = [
    [
      { text: description, margin: [5, 5, 5, 5] },
      { text: hsnSacCode, alignment: "center", margin: [5, 5, 5, 5] },
      { text: "1", alignment: "center", margin: [5, 5, 5, 5] },
      { text: formatCurrency(taxableValue), alignment: "right", margin: [5, 5, 5, 5] },
      { text: formatCurrency(taxableValue), alignment: "right", margin: [5, 5, 5, 5] },
    ],
  ];

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
            fallbackName: txn.academyName || txn.teacherName,
            fallbackEmail: txn.teacherEmail,
            fallbackPhone: txn.teacherPhone,
            secondaryLine: !billingDetails && txn.academyName ? txn.teacherName : null,
          }),
        },
      ],
      columnGap: 20,
      margin: [0, 0, 0, 20],
    },
    buildInvoiceMetaBox({
      invoiceNumber,
      invoiceDate: formatDate(txn.createdAt),
      paymentReference: txn.paymentTransactionId,
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
                { text: formatCurrency(taxableValue), alignment: "right", margin: [5, 5, 5, 5], border: [false, false, false, false] },
              ],
              [
                { text: "IGST @ 18%", margin: [5, 5, 5, 5], border: [false, false, false, false] },
                { text: formatCurrency(igstTotal), alignment: "right", margin: [5, 5, 5, 5], border: [false, false, false, false] },
              ],
              [
                { text: "TOTAL AMOUNT", bold: true, fillColor: "#F5F5F5", margin: [8, 8, 8, 8], border: [false, false, false, false] },
                { text: formatCurrency(amount), alignment: "right", bold: true, fillColor: "#F5F5F5", margin: [8, 8, 8, 8], border: [false, false, false, false] },
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
                    { text: txn.paymentMethod || "N/A", width: "*" },
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
    teacherName: txn.teacherName,
    teacherEmail: txn.teacherEmail,
  };
}
