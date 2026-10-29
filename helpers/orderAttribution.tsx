/**
 * Shared vocabulary for where an order came from and how it was paid. Pure
 * functions only, so the admin pages and the endpoints read the same labels.
 * The values themselves are captured by helpers/orderClientInfo when an order
 * is created and by the PayU completion paths (payment mode).
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

/** Groups of PayU mode codes an admin filters by. */
export const ORDER_PAYMENT_MODES = ["upi", "card", "netbanking", "wallet", "emi", "other", "unknown"] as const;
export type OrderPaymentModeGroup = (typeof ORDER_PAYMENT_MODES)[number];

export const ORDER_PAYMENT_MODE_GROUP_LABELS: Record<OrderPaymentModeGroup, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  wallet: "Wallet (via PayU)",
  emi: "EMI or pay later",
  other: "Other PayU mode",
  unknown: "Not recorded",
};

export const PAYMENT_MODE_GROUP_CODES: Record<Exclude<OrderPaymentModeGroup, "other" | "unknown">, string[]> = {
  upi: ["UPI", "UPI_INTENT", "UPI_COLLECT", "QR"],
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

/** PayU's mode code (stored as returned) to a readable label. */
export function paymentModeLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return PAYMENT_MODE_LABELS[code] ?? code;
}

/** Shape-checks a PayU mode code before it is stored; anything odd is dropped. */
export function normalizePaymentMode(mode: string | null | undefined): string | null {
  const code = mode?.trim().toUpperCase();
  return code && /^[A-Z_]{2,20}$/.test(code) ? code : null;
}

export const ORDER_GATEWAYS = ["payu", "none"] as const;
export type OrderGateway = (typeof ORDER_GATEWAYS)[number];

export const ORDER_GATEWAY_LABELS: Record<OrderGateway, string> = {
  payu: "PayU",
  none: "No gateway",
};

export const ORDER_PAYMENT_METHOD_LABELS: Record<string, string> = {
  payu: "PayU",
  wallet: "Testkart wallet",
  free: "Free",
  teacher_sponsored: "Teacher sponsored",
};

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "Not recorded";
  return ORDER_PAYMENT_METHOD_LABELS[method] ?? method.charAt(0).toUpperCase() + method.slice(1);
}
