import { directRetryKind, liveTestIdFromTxnid } from "./orderPaymentAttempts";

const noFailure = { paymentErrorCode: null, paymentErrorMessage: null, paymentBankMessage: null, paymentGatewayStatus: null };
const failedOrder = {
  status: "failed",
  paymentMethod: "payu",
  payRequestId: null,
  paymentTransactionId: "testkart-AbCdEfGhIjKl",
  bundleId: null,
  paymentFailure: { ...noFailure, paymentGatewayStatus: "bounced" },
};

describe("directRetryKind", () => {
  it("retries failed cart, bundle and live test orders in place", () => {
    expect(directRetryKind(failedOrder)).toBe("cart");
    expect(directRetryKind({ ...failedOrder, bundleId: 7 })).toBe("bundle");
    expect(directRetryKind({ ...failedOrder, paymentTransactionId: "testkart-bundle-12-1700000000000", bundleId: 7 })).toBe("bundle");
    expect(directRetryKind({ ...failedOrder, paymentTransactionId: "live-test-42-AbCdEfGhIjKl" })).toBe("live");
  });

  it("leaves pending, cancelled and paid orders alone", () => {
    for (const status of ["pending", "cancelled", "completed", "refunded"]) {
      expect(directRetryKind({ ...failedOrder, status })).toBeNull();
    }
  });

  it("leaves pay links, other gateways and other PayU flows alone", () => {
    expect(directRetryKind({ ...failedOrder, payRequestId: 3 })).toBeNull();
    expect(directRetryKind({ ...failedOrder, paymentMethod: "cashfree" })).toBeNull();
    expect(directRetryKind({ ...failedOrder, paymentTransactionId: "sponsor-AbCdEfGhIjKl" })).toBeNull();
    expect(directRetryKind({ ...failedOrder, paymentTransactionId: null })).toBeNull();
  });

  it("never offers a second payment when PayU reported money on the order", () => {
    expect(directRetryKind({ ...failedOrder, paymentFailure: { ...noFailure, paymentGatewayStatus: "captured" } })).toBeNull();
    expect(directRetryKind({ ...failedOrder, paymentFailure: { ...noFailure, paymentGatewayStatus: "success" } })).toBeNull();
  });
});

describe("liveTestIdFromTxnid", () => {
  it("reads the live test id from its txnid", () => {
    expect(liveTestIdFromTxnid("live-test-42-AbCdEfGhIjKl")).toBe(42);
    expect(liveTestIdFromTxnid("testkart-AbCdEfGhIjKl")).toBeNull();
  });
});
