import { getMandateChargeRefusal, MandateChargeCandidate } from "./mandateChargeEligibility";

const now = new Date("2026-09-11T12:00:00Z");

const due: MandateChargeCandidate = {
  status: "active",
  autoRenew: true,
  mandateId: "mandate-1",
  mandateStatus: "active",
  nextChargeDate: new Date("2026-09-10T12:00:00Z"),
  preDebitSentAt: new Date("2026-09-08T12:00:00Z"),
};

describe("getMandateChargeRefusal", () => {
  it("allows an active, auto-renewing, due subscription whose pre-debit notice went out", () => {
    expect(getMandateChargeRefusal(due, now)).toBeNull();
  });

  it("refuses subscription 6403 as it stood on 2026-09-11 (expired, mandate still active)", () => {
    expect(
      getMandateChargeRefusal(
        {
          status: "expired",
          autoRenew: false,
          mandateId: "mandate-6403",
          mandateStatus: "active",
          nextChargeDate: "2026-08-14T14:29:11.643",
          preDebitSentAt: "2026-08-12T00:30:12.063+00:00",
        },
        now
      )
    ).toBe("This subscription is not set to renew automatically.");
  });

  it("refuses subscription 5294 as it stood on 2026-09-11 (cancelled, mandate still active)", () => {
    expect(
      getMandateChargeRefusal(
        {
          status: "cancelled",
          autoRenew: false,
          mandateId: "mandate-5294",
          mandateStatus: "active",
          nextChargeDate: "2026-07-28T03:24:41.489",
          preDebitSentAt: null,
        },
        now
      )
    ).toBe("This subscription is not set to renew automatically.");
  });

  it("refuses an active subscription with auto-renew switched off or unset", () => {
    for (const autoRenew of [false, null]) {
      expect(getMandateChargeRefusal({ ...due, autoRenew }, now)).toBe(
        "This subscription is not set to renew automatically."
      );
    }
  });

  it("refuses without an active mandate", () => {
    expect(getMandateChargeRefusal({ ...due, mandateStatus: "cancelled" }, now)).toBe(
      "No active mandate found for this subscription."
    );
    expect(getMandateChargeRefusal({ ...due, mandateId: null }, now)).toBe(
      "No active mandate found for this subscription."
    );
  });

  it("refuses before the charge date", () => {
    expect(getMandateChargeRefusal({ ...due, nextChargeDate: new Date("2026-09-12T12:00:00Z") }, now)).toBe(
      "Subscription is not yet due for renewal."
    );
  });

  it("refuses until the pre-debit notice has gone out", () => {
    expect(getMandateChargeRefusal({ ...due, preDebitSentAt: null }, now)).toBe(
      "The pre-debit notice for this renewal has not been sent yet."
    );
  });
});
