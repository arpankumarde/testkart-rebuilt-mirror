import { nextSendTime, offerCoins, pickVariant } from "./autopilotRules";

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("nextSendTime", () => {
  it("keeps a time inside the 09:00-22:00 IST window", () => {
    const due = new Date("2026-11-14T06:30:00Z"); // 12:00 IST
    expect(nextSendTime(due, 9, 22).toISOString()).toBe(due.toISOString());
  });

  it("moves a night-time send to 09:00 IST the next morning", () => {
    const due = new Date("2026-11-14T18:00:00Z"); // 23:30 IST
    expect(nextSendTime(due, 9, 22).toISOString()).toBe("2026-11-15T03:30:00.000Z");
  });

  it("moves an early-morning send to 09:00 IST the same day", () => {
    const due = new Date("2026-11-14T00:30:00Z"); // 06:00 IST
    expect(nextSendTime(due, 9, 22).toISOString()).toBe("2026-11-14T03:30:00.000Z");
  });
});

describe("pickVariant", () => {
  it("favours the variant that converts better", () => {
    const random = seeded(7);
    let a = 0;
    for (let i = 0; i < 500; i++) {
      const pick = pickVariant(
        [
          { key: "a", sends: 400, conversions: 80 },
          { key: "b", sends: 400, conversions: 20 },
        ],
        random
      );
      if (pick === "a") a++;
    }
    expect(a).toBeGreaterThan(480);
  });

  it("splits traffic when nothing is known yet", () => {
    const random = seeded(11);
    let a = 0;
    for (let i = 0; i < 1000; i++) {
      if (pickVariant([{ key: "a", sends: 0, conversions: 0 }, { key: "b", sends: 0, conversions: 0 }], random) === "a") a++;
    }
    expect(a).toBeGreaterThan(400);
    expect(a).toBeLessThan(600);
  });
});

describe("offerCoins", () => {
  const base = { marginShare: 0.5, redeemPercent: 10, maxRedeem: 200, budgetLeftRupees: 500 };

  it("is limited by what checkout lets the student redeem", () => {
    expect(offerCoins({ ...base, takeRupees: 27, cartRupees: 99 })).toBe(9);
  });

  it("is limited by Testkart's share on a large cart", () => {
    expect(offerCoins({ ...base, takeRupees: 140, cartRupees: 999 })).toBe(70);
  });

  it("offers nothing when the budget is spent or the value is tiny", () => {
    expect(offerCoins({ ...base, takeRupees: 140, cartRupees: 999, budgetLeftRupees: 3 })).toBe(0);
    expect(offerCoins({ ...base, takeRupees: 6, cartRupees: 30 })).toBe(0);
  });
});