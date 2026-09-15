import { PAYU_NOT_FOUND_STATUS, type PaymentFailureColumns } from "./extractPayUFailure";

export const PAYMENT_FAILURE_REASONS = [
  "payment_captured",
  "cancelled",
  "left_payment_page",
  "not_confirmed",
  "not_started",
  "authentication_failed",
  "debit_failed",
  "limit_exceeded",
  "card_declined",
  "upi_failed",
  "bank_declined",
  "technical_error",
  "unknown",
] as const;

export type PaymentFailureReason = (typeof PAYMENT_FAILURE_REASONS)[number];

// For the person who paid: a student buying, or a teacher paying for a subscription.
export type PaymentFailureDescription = {
  reason: PaymentFailureReason;
  label: string;
  payerMessage: string;
};

// For admins: the classified reason next to PayU's own fields.
export type PaymentFailureDetails = {
  reason: PaymentFailureReason;
  label: string;
  errorCode: string | null;
  errorMessage: string | null;
  bankMessage: string | null;
  gatewayStatus: string | null;
};

const COPY: Record<PaymentFailureReason, { label: string; payerMessage: string }> = {
  payment_captured: {
    label: "Captured at PayU",
    payerMessage: "PayU shows this payment as received. Please contact support so we can complete your order.",
  },
  cancelled: {
    label: "Cancelled at PayU",
    payerMessage: "The payment was cancelled on the payment page.",
  },
  left_payment_page: {
    label: "Left payment page",
    payerMessage: "The payment page was closed or timed out before the payment was made.",
  },
  not_confirmed: {
    label: "Bank did not confirm",
    payerMessage: "Your bank or UPI app did not confirm the payment in time.",
  },
  not_started: {
    label: "Never reached PayU",
    payerMessage: "The payment was not started.",
  },
  authentication_failed: {
    label: "Authentication failed",
    payerMessage: "Your bank could not verify the payment. Check the OTP or PIN and try again.",
  },
  debit_failed: {
    label: "Debit failed",
    payerMessage: "Your bank could not debit the amount. Check your balance or try another payment method.",
  },
  limit_exceeded: {
    label: "Limit exceeded",
    payerMessage: "The amount is over your card, UPI or account limit. Try another payment method.",
  },
  card_declined: {
    label: "Card declined",
    payerMessage: "Your card was declined. It may not be enabled for online payments.",
  },
  upi_failed: {
    label: "UPI failed",
    payerMessage: "The UPI payment did not go through. Check your UPI ID and approve the request in your UPI app in time.",
  },
  bank_declined: {
    label: "Bank declined",
    payerMessage: "Your bank declined the payment. Try again or use another payment method.",
  },
  technical_error: {
    label: "Technical error",
    payerMessage: "The payment could not be processed because of a technical error. Please try again.",
  },
  unknown: {
    label: "Other failure",
    payerMessage: "The payment could not be completed. Please try again.",
  },
};

const classify = (failure: PaymentFailureColumns): PaymentFailureReason | null => {
  const gateway = (failure.paymentGatewayStatus ?? "").toLowerCase();
  const text = [failure.paymentErrorCode, failure.paymentErrorMessage, failure.paymentBankMessage]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!gateway && !text) return null;

  if (gateway === "captured" || gateway === "success") return "payment_captured";
  if (gateway === "usercancelled") return "cancelled";
  if (gateway === "bounced") return "left_payment_page";
  if (gateway === "dropped") return "not_confirmed";
  if (gateway === PAYU_NOT_FOUND_STATUS) return "not_started";

  if (/authenticat|\botp\b|3d ?secure|\bpin\b/.test(text)) return "authentication_failed";
  if (/insufficient|balance|debit/.test(text)) return "debit_failed";
  if (/limit/.test(text)) return "limit_exceeded";
  if (/card/.test(text) && /declin|restrict|not enabled|block|expired|invalid/.test(text)) return "card_declined";
  if (/upi|vpa|collect|address resolution|customer's application/.test(text)) return "upi_failed";
  if (/declin|bank end|reject|do not honou?r/.test(text)) return "bank_declined";
  if (/cancel/.test(text)) return "cancelled";
  if (/in progress|pending/.test(text)) return "not_confirmed";
  if (/hash|technical/.test(text)) return "technical_error";
  return "unknown";
};

const toDescription = (reason: PaymentFailureReason): PaymentFailureDescription => ({
  reason,
  ...COPY[reason],
});

export const paymentFailureReason = {
  describe(failure: PaymentFailureColumns): PaymentFailureDescription | null {
    const reason = classify(failure);
    return reason ? toDescription(reason) : null;
  },
  details(failure: PaymentFailureColumns): PaymentFailureDetails | null {
    const reason = classify(failure);
    return reason
      ? {
          reason,
          label: COPY[reason].label,
          errorCode: failure.paymentErrorCode,
          errorMessage: failure.paymentErrorMessage,
          bankMessage: failure.paymentBankMessage,
          gatewayStatus: failure.paymentGatewayStatus,
        }
      : null;
  },
  // For reason codes read back from a URL or deep link: anything unrecognised is ignored.
  parse(value: string | null | undefined): PaymentFailureDescription | null {
    const match = PAYMENT_FAILURE_REASONS.find((reason) => reason === value);
    return match ? toDescription(match) : null;
  },
};
