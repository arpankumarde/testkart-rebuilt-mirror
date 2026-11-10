import { cashfreeRequest, getCashfreeConfig } from "./cashfree";
import type { CashfreeMode } from "./cashfreeCheckout";

/**
 * Cashfree Subscriptions (mandates) for live class packages, API version 2026-01-01.
 * Every package gets its own ON_DEMAND mandate capped at that teacher's biggest package. The
 * first cycle is taken as the mandate's authorisation payment (kept, not refunded); renewals are
 * raised with a CHARGE, and Cashfree sends the pre-debit notice itself in its default flow.
 */

export type CfAuthorization = {
  authorization_amount?: number | null;
  authorization_amount_refund?: boolean | null;
  authorization_status?: string | null;
  payment_group?: string | null;
  payment_method?: unknown;
};

export type CfSubscription = {
  cf_subscription_id?: string | number | null;
  subscription_id: string;
  subscription_session_id?: string | null;
  subscription_status: string;
  authorisation_details?: CfAuthorization | null;
  authorization_details?: CfAuthorization | null;
};

export type CfSubscriptionPayment = {
  payment_id: string;
  cf_payment_id?: string | number | null;
  payment_type?: string | null;
  payment_amount?: number | null;
  payment_status: string;
  payment_schedule_date?: string | null;
  failure_details?: { failure_reason?: string | null } | null;
  authorization_details?: CfAuthorization | null;
};

/** Subscription states after which the mandate can never be charged again. */
export const DEAD_SUBSCRIPTION_STATUSES = [
  "COMPLETED",
  "CUSTOMER_CANCELLED",
  "EXPIRED",
  "LINK_EXPIRED",
  "CARD_EXPIRED",
  "CANCELLED",
];

export const FAILED_SUBSCRIPTION_PAYMENT_STATUSES = ["FAILED", "CANCELLED", "USER_DROPPED"];

export function authorizationOf(sub: CfSubscription): CfAuthorization | null {
  return sub.authorisation_details ?? sub.authorization_details ?? null;
}

/** Reads the payment method from either the string or the keyed-object form the docs show. */
export function paymentMethodLabel(auth: CfAuthorization | null | undefined): string | null {
  if (!auth) return null;
  if (auth.payment_group) return String(auth.payment_group).toLowerCase();
  const method = auth.payment_method;
  if (typeof method === "string") return method.toLowerCase();
  if (method && typeof method === "object") {
    const key = Object.keys(method as Record<string, unknown>)[0];
    return key ? key.toLowerCase() : null;
  }
  return null;
}

export async function createCashfreeSubscription(input: {
  subscriptionId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  planName: string;
  maxAmount: number;
  authAmount: number;
  refundAuth: boolean;
  returnUrl: string;
  note: string;
}): Promise<{ subscriptionSessionId: string; cfSubscriptionId: string | null; status: string; mode: CashfreeMode }> {
  const config = getCashfreeConfig();
  const expiry = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);
  const sub = await cashfreeRequest<CfSubscription>(config, "POST", "/subscriptions", {
    subscription_id: input.subscriptionId,
    customer_details: {
      customer_name: input.customerName.slice(0, 100),
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone,
    },
    plan_details: {
      plan_name: input.planName.slice(0, 40),
      plan_type: "ON_DEMAND",
      plan_max_amount: Number(input.maxAmount.toFixed(2)),
      plan_currency: "INR",
      plan_note: input.note.slice(0, 100),
    },
    authorization_details: {
      authorization_amount: Number(input.authAmount.toFixed(2)),
      authorization_amount_refund: input.refundAuth,
      payment_methods: ["upi", "card"],
    },
    subscription_meta: {
      return_url: input.returnUrl,
    },
    subscription_expiry_time: expiry.toISOString(),
  });
  if (!sub?.subscription_session_id) {
    throw new Error("Cashfree did not return a mandate session.");
  }
  return {
    subscriptionSessionId: sub.subscription_session_id,
    cfSubscriptionId: sub.cf_subscription_id != null ? String(sub.cf_subscription_id) : null,
    status: sub.subscription_status,
    mode: config.mode,
  };
}

export async function fetchCashfreeSubscription(subscriptionId: string): Promise<CfSubscription> {
  return cashfreeRequest<CfSubscription>(getCashfreeConfig(), "GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export async function fetchCashfreeSubscriptionPayments(subscriptionId: string): Promise<CfSubscriptionPayment[]> {
  const payments = await cashfreeRequest<CfSubscriptionPayment[] | null>(
    getCashfreeConfig(),
    "GET",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`
  );
  return Array.isArray(payments) ? payments : [];
}

export async function fetchCashfreeSubscriptionPayment(subscriptionId: string, paymentId: string): Promise<CfSubscriptionPayment> {
  return cashfreeRequest<CfSubscriptionPayment>(
    getCashfreeConfig(),
    "GET",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments/${encodeURIComponent(paymentId)}`
  );
}

/** Raises a renewal debit. scheduleDate is YYYY-MM-DD, at least tomorrow and under 14 days out. */
export async function raiseCashfreeSubscriptionCharge(input: {
  subscriptionId: string;
  paymentId: string;
  amount: number;
  scheduleDate: string;
  remarks: string;
}): Promise<CfSubscriptionPayment> {
  return cashfreeRequest<CfSubscriptionPayment>(getCashfreeConfig(), "POST", "/subscriptions/pay", {
    subscription_id: input.subscriptionId,
    payment_id: input.paymentId,
    payment_type: "CHARGE",
    payment_amount: Number(input.amount.toFixed(2)),
    payment_schedule_date: input.scheduleDate,
    payment_remarks: input.remarks.slice(0, 100),
  });
}

export async function cancelCashfreeSubscription(subscriptionId: string): Promise<void> {
  await cashfreeRequest<CfSubscription>(
    getCashfreeConfig(),
    "POST",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/manage`,
    { subscription_id: subscriptionId, action: "CANCEL" }
  );
}

export async function cancelCashfreeSubscriptionPayment(subscriptionId: string, paymentId: string): Promise<void> {
  await cashfreeRequest<CfSubscriptionPayment>(
    getCashfreeConfig(),
    "POST",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments/${encodeURIComponent(paymentId)}/manage`,
    { subscription_id: subscriptionId, payment_id: paymentId, action: "CANCEL" }
  );
}
