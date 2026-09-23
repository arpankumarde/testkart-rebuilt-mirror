export type PaymentFailureColumns = {
  paymentErrorCode: string | null;
  paymentErrorMessage: string | null;
  paymentBankMessage: string | null;
  paymentGatewayStatus: string | null;
};

// Field names as PayU sends them: the callback posts `error`, the Verify Payment API returns `error_code`.
export type PayUFailureFields = {
  status?: string | null;
  unmappedstatus?: string | null;
  error?: string | null;
  error_code?: string | null;
  error_Message?: string | null;
  field9?: string | null;
};

// Recorded when the Verify Payment API has no record of the transaction.
export const PAYU_NOT_FOUND_STATUS = "not_found";

const MAX_LENGTH = 500;
const PLACEHOLDER_VALUES = new Set(["", "na", "n/a", "null", "undefined", "no error", "e000"]);

const clean = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (PLACEHOLDER_VALUES.has(collapsed.toLowerCase())) return null;
  return collapsed.slice(0, MAX_LENGTH);
};

export function extractPayUFailure(fields: PayUFailureFields): PaymentFailureColumns {
  return {
    paymentErrorCode: clean(fields.error) ?? clean(fields.error_code),
    paymentErrorMessage: clean(fields.error_Message),
    paymentBankMessage: clean(fields.field9),
    paymentGatewayStatus: clean(fields.unmappedstatus) ?? clean(fields.status),
  };
}

// PayU keeps `status` to success/failure/pending and reports a press of Cancel in `unmappedstatus`.
export function isPayUCancellation(fields: Pick<PayUFailureFields, "status" | "unmappedstatus">): boolean {
  const status = (fields.status ?? "").toLowerCase();
  const unmappedStatus = (fields.unmappedstatus ?? "").trim().toLowerCase();
  return status.includes("cancel") || unmappedStatus === "usercancelled";
}

// The status an unpaid order closes with: "cancelled" for a Cancel or Back press, "failed" for anything else.
// Every path that closes an order from PayU's answer uses this, so a re-check never relabels a cancel as a failure.
export function unpaidOrderStatus(failure: PaymentFailureColumns | null | undefined): "cancelled" | "failed" {
  return isPayUCancellation({ unmappedstatus: failure?.paymentGatewayStatus }) ? "cancelled" : "failed";
}