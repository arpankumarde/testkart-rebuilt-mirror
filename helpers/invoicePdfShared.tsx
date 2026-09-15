import type { BillingDetails } from "../endpoints/account/billing-details_GET.schema";
import { BRAND_LOGO_LIGHT } from "./brandAssets";

// Module-level cache: the logo is the same for every invoice, so we only
// want to hit the CDN once per warm serverless instance rather than on
// every single PDF generation. `undefined` = not yet attempted, `null` =
// attempted and failed (so we stop retrying within this instance's
// lifetime rather than re-fetching on every invoice).
let cachedLogoDataUri: string | null | undefined;

/**
 * Fetches the Testkart logo from the CDN and returns it as a base64 data
 * URI, ready to embed directly in a pdfmake `image` node (pdfmake can't
 * fetch remote URLs itself — images must be provided as data URIs or raw
 * base64). Returns null if the fetch fails for any reason, so invoice
 * generation degrades gracefully (falls back to text-only header) instead
 * of failing the whole PDF over a logo.
 */
export async function getInvoiceLogoDataUri(): Promise<string | null> {
  if (cachedLogoDataUri !== undefined) {
    return cachedLogoDataUri;
  }

  try {
    const response = await fetch(BRAND_LOGO_LIGHT);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${BRAND_LOGO_LIGHT}`);
    }
    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    cachedLogoDataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error("Failed to fetch invoice logo, falling back to text-only header:", err);
    cachedLogoDataUri = null;
  }

  return cachedLogoDataUri;
}

/**
 * pdfmake only wraps text at whitespace boundaries. Long unbroken tokens
 * (payment transaction IDs, order references, etc.) would otherwise overflow
 * their cell/column and get visually cropped at the page edge instead of
 * wrapping to a new line. This inserts zero-width spaces at safe intervals
 * so long tokens can still break cleanly, without adding any visible
 * character to the rendered text.
 */
export function breakLongToken(text: string, chunkSize = 20): string {
  if (!text) return text;
  return text.replace(
    new RegExp(`(\\S{${chunkSize}})(?=\\S)`, "g"),
    "$1​"
  );
}

/**
 * Builds the "BILLED TO" stack content for an invoice PDF. Prefers the
 * account's saved billing details (private, profile-only info meant
 * specifically for invoices) and falls back to whatever basic contact info
 * we have on file so invoices are never missing a name/email entirely.
 */
export function buildBilledToStack(params: {
  billingDetails: BillingDetails | null;
  fallbackName: string;
  fallbackEmail?: string | null;
  fallbackPhone?: string | null;
  secondaryLine?: string | null;
}): any[] {
  const { billingDetails, fallbackName, fallbackEmail, fallbackPhone, secondaryLine } = params;

  const name = billingDetails?.name || fallbackName;
  const email = billingDetails?.email || fallbackEmail || null;
  const phone = billingDetails?.phone || fallbackPhone || null;
  const address = billingDetails?.address || null;
  const gstin = billingDetails?.gstin || null;

  const stack: any[] = [
    { text: "BILLED TO", bold: true, fontSize: 10, color: "#666666", margin: [0, 0, 0, 8] },
    { text: name, bold: true, margin: [0, 0, 0, 4] },
  ];

  if (secondaryLine) {
    stack.push({ text: secondaryLine, margin: [0, 0, 0, 4] });
  }
  if (email) {
    stack.push({ text: email, margin: [0, 0, 0, 4] });
  }
  if (phone) {
    stack.push({ text: phone, margin: [0, 0, 0, 4] });
  }
  if (address) {
    stack.push({ text: address, margin: [0, 0, 0, 4] });
  }
  if (gstin) {
    stack.push({ text: `GSTIN: ${gstin}`, margin: [0, 0, 0, 0] });
  }

  return stack;
}

/**
 * The invoice metadata box (number / date / payment reference). Payment
 * references (gateway transaction IDs) can be long unbroken alphanumeric
 * strings, so this gives that field its own full-width row beneath the
 * number/date pair — previously all three shared one cramped column and the
 * reference would get cropped at the page edge instead of wrapping.
 */
export function buildInvoiceMetaBox(params: {
  invoiceNumber: string;
  invoiceDate: string;
  paymentReference: string | null;
}): any {
  const { invoiceNumber, invoiceDate, paymentReference } = params;

  const rows: any[][] = [
    [
      {
        stack: [
          { text: "INVOICE NUMBER", fontSize: 9, color: "#666666", margin: [0, 0, 0, 4] },
          { text: invoiceNumber, bold: true, fontSize: 11 },
        ],
        fillColor: "#F5F5F5",
        margin: [10, 10, 5, 10],
        border: [false, false, false, false],
      },
      {
        stack: [
          { text: "INVOICE DATE", fontSize: 9, color: "#666666", margin: [0, 0, 0, 4] },
          { text: invoiceDate, bold: true, fontSize: 11 },
        ],
        fillColor: "#F5F5F5",
        margin: [5, 10, 10, 10],
        border: [false, false, false, false],
      },
    ],
    [
      {
        stack: [
          { text: "PAYMENT REFERENCE", fontSize: 9, color: "#666666", margin: [0, 0, 0, 4] },
          {
            text: paymentReference ? breakLongToken(paymentReference) : "N/A",
            bold: true,
            fontSize: 10,
          },
        ],
        colSpan: 2,
        fillColor: "#F5F5F5",
        margin: [10, 0, 10, 10],
        border: [false, false, false, false],
      },
      {},
    ],
  ];

  return {
    table: {
      widths: ["*", "*"],
      body: rows,
    },
    layout: "noBorders",
    margin: [0, 0, 0, 25],
  };
}
