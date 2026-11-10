import { createHmac, timingSafeEqual } from "crypto";
import type { CashfreeMode } from "./cashfreeCheckout";

/** One version for orders and subscriptions. Webhook versions are set to match in the Cashfree dashboard. */
const CASHFREE_API_VERSION = "2026-01-01";

export type CashfreeConfig = {
  appId: string;
  secretKey: string;
  mode: CashfreeMode;
  baseUrl: string;
};

/**
 * CASHFREE_APP_ID and CASHFREE_SECRET_KEY are required. CASHFREE_ENV is "sandbox" or
 * "production"; anything else (including unset) means sandbox, so the live gateway is
 * only ever used when it is set to "production" on purpose.
 */
export function getCashfreeConfig(): CashfreeConfig {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  if (!appId || !secretKey) {
    throw new Error("Cashfree is not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.");
  }
  const mode: CashfreeMode = process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
  const baseUrl = mode === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
  return { appId, secretKey, mode, baseUrl };
}

export type CashfreeOrderStatus = "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED" | string;

export type CashfreeOrder = {
  cf_order_id: string | number;
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: CashfreeOrderStatus;
  payment_session_id?: string;
};

export type CashfreePayment = {
  cf_payment_id: string | number;
  payment_status: "SUCCESS" | "FAILED" | "PENDING" | "NOT_ATTEMPTED" | "USER_DROPPED" | "CANCELLED" | "VOID" | string;
  payment_amount: number;
  payment_group?: string;
  payment_time?: string;
  payment_message?: string;
  error_details?: {
    error_code?: string;
    error_description?: string;
    error_reason?: string;
  } | null;
};

export async function cashfreeRequest<T>(config: CashfreeConfig, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      "x-client-id": config.appId,
      "x-client-secret": config.secretKey,
      "x-api-version": CASHFREE_API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object" && "message" in parsed && typeof (parsed as { message: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : `Cashfree request failed with status ${response.status}`;
    console.error(`[Cashfree] ${method} ${path} failed (${response.status}): ${message}`);
    throw new Error(message);
  }
  return parsed as T;
}

export type CreateCashfreeOrderInput = {
  cashfreeOrderId: string;
  amount: number;
  customerId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
  notifyUrl: string;
  note: string;
};

export async function createCashfreeOrder(input: CreateCashfreeOrderInput): Promise<{ paymentSessionId: string; mode: CashfreeMode }> {
  const config = getCashfreeConfig();
  const order = await cashfreeRequest<CashfreeOrder>(config, "POST", "/orders", {
    order_id: input.cashfreeOrderId,
    order_amount: Number(input.amount.toFixed(2)),
    order_currency: "INR",
    order_note: input.note.slice(0, 200),
    customer_details: {
      customer_id: `user_${input.customerId}`,
      customer_name: input.customerName.slice(0, 100),
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone,
    },
    order_meta: {
      return_url: input.returnUrl,
      notify_url: input.notifyUrl,
    },
  });
  if (!order?.payment_session_id) {
    throw new Error("Cashfree did not return a payment session.");
  }
  return { paymentSessionId: order.payment_session_id, mode: config.mode };
}

export async function fetchCashfreeOrder(cashfreeOrderId: string): Promise<CashfreeOrder> {
  const config = getCashfreeConfig();
  return cashfreeRequest<CashfreeOrder>(config, "GET", `/orders/${encodeURIComponent(cashfreeOrderId)}`);
}

export async function fetchCashfreePayments(cashfreeOrderId: string): Promise<CashfreePayment[]> {
  const config = getCashfreeConfig();
  const payments = await cashfreeRequest<CashfreePayment[] | null>(
    config,
    "GET",
    `/orders/${encodeURIComponent(cashfreeOrderId)}/payments`
  );
  return Array.isArray(payments) ? payments : [];
}

/** Cashfree signs "<timestamp><raw body>" with the secret key, base64 encoded. */
export function isValidCashfreeWebhookSignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  if (!timestamp || !signature) return false;
  const { secretKey } = getCashfreeConfig();
  const expected = createHmac("sha256", secretKey).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

const PAYMENT_GROUP_TO_MODE: Record<string, string> = {
  upi: "UPI",
  credit_card: "CC",
  debit_card: "DC",
  net_banking: "NB",
  wallet: "WALLET",
  paylater: "PAYLATER",
  cardless_emi: "CLW",
  emi: "EMI",
};

/** Maps Cashfree's payment group onto the mode codes the orders table already uses. */
export function cashfreeModeCode(paymentGroup: string | null | undefined): string | null {
  if (!paymentGroup) return null;
  return PAYMENT_GROUP_TO_MODE[paymentGroup.trim().toLowerCase()] ?? null;
}
