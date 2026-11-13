/**
 * Shared vocabulary for where an order came from and how it was paid. Pure
 * functions only, so the admin pages and the endpoints read the same labels.
 * The values themselves are captured by helpers/orderClientInfo when an order
 * is created and by the PayU and Cashfree completion paths (payment mode).
 */

export type OrderClientSource = "web" | "android_app" | "ios_app" | "unknown";
export type OrderClientDeviceType = "mobile" | "tablet" | "desktop" | "unknown";

export const ORDER_PLATFORMS = [
  "android_app",
  "ios_app",
  "mobile_web",
  "desktop_web",
  "tablet_web",
  "unknown",
] as const;
export type OrderPlatform = (typeof ORDER_PLATFORMS)[number];

export const ORDER_PLATFORM_LABELS: Record<OrderPlatform, string> = {
  android_app: "Android app",
  ios_app: "iOS app",
  mobile_web: "Mobile web",
  desktop_web: "Desktop web",
  tablet_web: "Tablet web",
  unknown: "Not captured",
};

/** Native app orders are identified by the app's own headers; a phone browser stays mobile_web. */
export function orderPlatform(
  source: string | null | undefined,
  deviceType: string | null | undefined
): OrderPlatform {
  if (source === "android_app" || source === "ios_app") return source;
  if (source === "web") {
    if (deviceType === "mobile") return "mobile_web";
    if (deviceType === "tablet") return "tablet_web";
    if (deviceType === "desktop") return "desktop_web";
  }
  return "unknown";
}

export const ORDER_DEVICE_TYPES = ["mobile", "tablet", "desktop", "unknown"] as const;

export const ORDER_DEVICE_TYPE_LABELS: Record<OrderClientDeviceType, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
  unknown: "Not known",
};

/** Groups of payment mode codes an admin filters by. Cashfree modes are stored in the same codes. */
export const ORDER_PAYMENT_MODES = ["upi", "card", "netbanking", "wallet", "emi", "other", "unknown"] as const;
export type OrderPaymentModeGroup = (typeof ORDER_PAYMENT_MODES)[number];

export const ORDER_PAYMENT_MODE_GROUP_LABELS: Record<OrderPaymentModeGroup, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  wallet: "Wallet (via the gateway)",
  emi: "EMI or pay later",
  other: "Other gateway mode",
  unknown: "Not recorded",
};

export const PAYMENT_MODE_GROUP_CODES: Record<Exclude<OrderPaymentModeGroup, "other" | "unknown">, string[]> = {
  upi: ["UPI", "UPI_INTENT", "UPI_COLLECT", "QR", "UPICC", "UPIPPI"],
  card: ["CC", "DC", "CREDITCARD", "DEBITCARD", "AMEX", "CARD"],
  netbanking: ["NB", "NETBANKING"],
  wallet: ["CASH", "WALLET"],
  emi: ["EMI", "BNPL", "PAYLATER", "CLW"],
};

const PAYMENT_MODE_LABELS: Record<string, string> = {
  UPI: "UPI",
  UPI_INTENT: "UPI",
  UPI_COLLECT: "UPI",
  QR: "UPI QR",
  UPICC: "Credit card on UPI",
  UPIPPI: "Wallet on UPI",
  CC: "Credit card",
  DC: "Debit card",
  CREDITCARD: "Credit card",
  DEBITCARD: "Debit card",
  AMEX: "Amex card",
  CARD: "Card",
  NB: "Net banking",
  NETBANKING: "Net banking",
  CASH: "Wallet",
  WALLET: "Wallet",
  EMI: "EMI",
  BNPL: "Pay later",
  PAYLATER: "Pay later",
  CLW: "Cardless EMI",
};

/** A gateway mode code (stored as returned) to a readable label. */
export function paymentModeLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return PAYMENT_MODE_LABELS[code] ?? code;
}

/** Shape-checks a PayU mode code before it is stored; anything odd is dropped. */
export function normalizePaymentMode(mode: string | null | undefined): string | null {
  const code = mode?.trim().toUpperCase();
  return code && /^[A-Z_]{2,20}$/.test(code) ? code : null;
}

export const ORDER_GATEWAYS = ["payu", "cashfree", "none"] as const;
export type OrderGateway = (typeof ORDER_GATEWAYS)[number];

export const ORDER_GATEWAY_LABELS: Record<OrderGateway, string> = {
  payu: "PayU",
  cashfree: "Cashfree",
  none: "No gateway",
};

/** Live classes and live courses are paid through Cashfree: one-off orders and autopay package cycles. */
export const CASHFREE_PAYMENT_METHODS = ["cashfree", "cashfree_mandate"] as const;

export function orderGateway(method: string | null | undefined): OrderGateway {
  if (method === "payu") return "payu";
  if (method && (CASHFREE_PAYMENT_METHODS as readonly string[]).includes(method)) return "cashfree";
  return "none";
}

export const ORDER_PAYMENT_METHOD_LABELS: Record<string, string> = {
  payu: "PayU",
  cashfree: "Cashfree",
  cashfree_mandate: "Cashfree autopay",
  live_balance: "Live class balance",
  wallet: "Testkart wallet",
  free: "Free",
  teacher_sponsored: "Teacher sponsored",
};

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "Not recorded";
  return ORDER_PAYMENT_METHOD_LABELS[method] ?? method.charAt(0).toUpperCase() + method.slice(1);
}
