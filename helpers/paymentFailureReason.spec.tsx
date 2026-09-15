import { paymentFailureReason, type PaymentFailureReason } from "./paymentFailureReason";
import { extractPayUFailure, isPayUCancellation } from "./extractPayUFailure";

// Field combinations PayU returned for Testkart orders during the 2026-09-11 backfill.
const observed: Array<[Parameters<typeof extractPayUFailure>[0], PaymentFailureReason]> = [
  [{ unmappedstatus: "bounced", error: "E408", field9: "Marked bounced as transaction has timed out" }, "left_payment_page"],
  [{ unmappedstatus: "bounced", error_code: "E4179", field9: "MER_025|No Transaction exists with given merchant id : MER0000005118097|Completed Using Verify API" }, "left_payment_page"],
  [{ unmappedstatus: "dropped", error: "E231", error_Message: "Transaction was marked as dropped", field9: "Marked dropped as transaction has timed out" }, "not_confirmed"],
  [{ unmappedstatus: "userCancelled", error: "E1605", error_Message: "Transaction failed due to customer pressing cancel button.", field9: "Cancelled by user" }, "cancelled"],
  [{ unmappedstatus: "userCancelled", error: "E1206", error_Message: "Transaction interrupted by pressing back button", field9: "User interrupted by pressing back button--Retry exhausted" }, "cancelled"],
  [{ unmappedstatus: "captured", field9: "0|SUCCESS|Completed Using Callback" }, "payment_captured"],
  [{ unmappedstatus: "failed", error: "E4179", error_Message: "Transaction failed as debit failed from the customer's account", field9: "U30|DEBIT HAS BEEN FAILED|Completed Using Callback" }, "debit_failed"],
  [{ unmappedstatus: "failed", error: "E4178", error_Message: "Transaction failed due to technical error at customer's application", field9: "U29|ADDRESS RESOLUTION IS FAILED|Completed Using Callback" }, "upi_failed"],
  [{ unmappedstatus: "failed", error: "E4218", error_Message: "Transaction failed due to collect request expired", field9: "U69|COLLECT EXPIRED|Completed Using Callback" }, "upi_failed"],
  [{ unmappedstatus: "failed", error: "E204", error_Message: "Bank was unable to authenticate.", field9: "Bank was unable to authenticate." }, "authentication_failed"],
  [{ unmappedstatus: "failed", error: "E325", error_Message: "Transaction declined due to card not enabled for online transactions or user / Bank Defined Restrictions" }, "card_declined"],
  [{ unmappedstatus: "failed", error: "E1626", error_Message: "Restricted card", field9: "Restricted card" }, "card_declined"],
  [{ unmappedstatus: "failed", error: "E308", error_Message: "Transaction Failed at bank end.", field9: "Charge cancelled as contract is invalid due to contract expiration: 2026-08-13T19:15:36.540Z" }, "bank_declined"],
  [{ unmappedstatus: "failed", error: "E225", error_Message: "Transaction in Progress", field9: "P|PENDING|Completed Using Verify API" }, "not_confirmed"],
  [{ unmappedstatus: "failed", error: "E700", error_Message: "Validation of secure hash failed", field9: "E700|Verification of Secure Hash Failed with Bank|Completed Using Callback" }, "technical_error"],
];

describe("paymentFailureReason.describe", () => {
  it("classifies every combination PayU returned for real orders", () => {
    for (const [fields, expected] of observed) {
      expect(paymentFailureReason.describe(extractPayUFailure(fields))?.reason).withContext(JSON.stringify(fields)).toBe(expected);
    }
  });

  it("treats a PayU miss as never started and no data as no reason", () => {
    expect(paymentFailureReason.describe({ paymentErrorCode: null, paymentErrorMessage: null, paymentBankMessage: null, paymentGatewayStatus: "not_found" })?.reason).toBe("not_started");
    expect(paymentFailureReason.describe({ paymentErrorCode: null, paymentErrorMessage: null, paymentBankMessage: null, paymentGatewayStatus: null })).toBeNull();
  });

  it("falls back to unknown with a generic student message", () => {
    const description = paymentFailureReason.describe(extractPayUFailure({ status: "failure", error_Message: "Something odd" }));
    expect(description?.reason).toBe("unknown");
    expect(description?.payerMessage).toBe("The payment could not be completed. Please try again.");
  });

  it("details keeps PayU's own fields next to the label", () => {
    const columns = extractPayUFailure({ unmappedstatus: "failed", error: "E1626", error_Message: "Restricted card", field9: "Restricted card" });
    expect(paymentFailureReason.details(columns)).toEqual({
      reason: "card_declined",
      label: "Card declined",
      errorCode: "E1626",
      errorMessage: "Restricted card",
      bankMessage: "Restricted card",
      gatewayStatus: "failed",
    });
  });
});

describe("paymentFailureReason.parse", () => {
  it("accepts only known reason codes", () => {
    expect(paymentFailureReason.parse("upi_failed")?.label).toBe("UPI failed");
    for (const value of [null, undefined, "", "Your account is blocked, call 99999", "UPI_FAILED", "toString", "__proto__"]) {
      expect(paymentFailureReason.parse(value)).toBeNull();
    }
  });
});

describe("extractPayUFailure", () => {
  it("drops placeholders, collapses whitespace and caps length", () => {
    const columns = extractPayUFailure({ status: "failure", unmappedstatus: " failed ", error: "E000", error_Message: "No Error", field9: `a  b${"x".repeat(600)}` });
    expect(columns.paymentErrorCode).toBeNull();
    expect(columns.paymentErrorMessage).toBeNull();
    expect(columns.paymentGatewayStatus).toBe("failed");
    expect(columns.paymentBankMessage?.startsWith("a b")).toBe(true);
    expect(columns.paymentBankMessage?.length).toBe(500);
  });

  it("falls back to status when unmappedstatus is missing", () => {
    expect(extractPayUFailure({ status: "failure" }).paymentGatewayStatus).toBe("failure");
  });
});

describe("isPayUCancellation", () => {
  it("reads a Cancel or Back press from unmappedstatus, as PayU sends it", () => {
    expect(isPayUCancellation({ status: "failure", unmappedstatus: "userCancelled" })).toBe(true);
    expect(isPayUCancellation({ status: "failure", unmappedstatus: "bounced" })).toBe(false);
    expect(isPayUCancellation({ status: "failure", unmappedstatus: "failed" })).toBe(false);
    expect(isPayUCancellation({ status: "success", unmappedstatus: "captured" })).toBe(false);
  });

  it("control: the previous status-only check missed PayU's real cancellation shape", () => {
    const status: string = "failure";
    expect(status === "userCancelled" || status.toLowerCase().includes("cancel")).toBe(false);
  });
});