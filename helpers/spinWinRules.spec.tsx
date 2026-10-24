import {
  computeSpinDiscount,
  dateToZonedInput,
  flatMinimumOrder,
  probabilityProblems,
  rewardTermsProblems,
  spinCampaignPhase,
  zonedInputToDate,
  type SpinCouponTerms,
} from "./spinWinRules";

const ALL = ["test_series", "courses", "study_notes"];

const flat = (value: number, min: number): SpinCouponTerms => ({
  discountType: "flat",
  discountValue: value,
  minOrderValue: min,
  maxDiscountAmount: null,
  maxDiscountPercent: 18,
  eligibleCategories: ALL,
});

describe("flatMinimumOrder", () => {
  it("matches the PRD table", () => {
    expect(flatMinimumOrder(50)).toBe(278);
    expect(flatMinimumOrder(100)).toBe(556);
    expect(flatMinimumOrder(150)).toBe(834);
  });
});

describe("computeSpinDiscount", () => {
  it("rejects a flat coupon below its minimum eligible cart", () => {
    const result = computeSpinDiscount(flat(50, 278), [{ type: "test", id: 1, price: 277 }]);
    expect(result.ok).toBe(false);
  });

  it("gives the flat discount at the minimum and never above 18%", () => {
    const result = computeSpinDiscount(flat(50, 278), [{ type: "test", id: 1, price: 278 }]);
    expect(result.ok && result.discount).toBe(50);
    if (result.ok) expect(result.discount).toBeLessThanOrEqual(278 * 0.18);
  });

  it("caps a flat coupon at 18% even if the minimum was set too low", () => {
    const result = computeSpinDiscount(flat(150, 0), [{ type: "course", id: 1, price: 500 }]);
    expect(result.ok && result.discount).toBe(90);
  });

  it("counts only eligible categories toward the minimum and the discount", () => {
    const terms = { ...flat(100, 556), eligibleCategories: ["courses"] };
    const lines = [
      { type: "course" as const, id: 1, price: 300 },
      { type: "test" as const, id: 2, price: 400 },
    ];
    expect(computeSpinDiscount(terms, lines).ok).toBe(false);
  });

  it("never applies to bundles or live tests", () => {
    const result = computeSpinDiscount(flat(50, 0), [{ type: "bundle", id: 1, price: 1000 }]);
    expect(result.ok).toBe(false);
  });

  it("applies a percentage to the eligible total with the rupee cap", () => {
    const terms: SpinCouponTerms = { ...flat(0, 0), discountType: "percentage", discountValue: 18, maxDiscountAmount: 120 };
    const lines = [
      { type: "test" as const, id: 1, price: 1000 },
      { type: "digitalProduct" as const, id: 2, price: 0 },
    ];
    const result = computeSpinDiscount(terms, lines);
    expect(result.ok && result.discount).toBe(120);
  });

  it("matches the PRD worked example: 18% of 1000 is 180", () => {
    const terms: SpinCouponTerms = { ...flat(0, 0), discountType: "percentage", discountValue: 18 };
    const result = computeSpinDiscount(terms, [{ type: "course", id: 1, price: 1000 }]);
    expect(result.ok && result.discount).toBe(180);
  });

  it("floors to paise so the cap is never exceeded", () => {
    const terms: SpinCouponTerms = { ...flat(0, 0), discountType: "percentage", discountValue: 18 };
    const result = computeSpinDiscount(terms, [{ type: "course", id: 1, price: 99.99 }]);
    expect(result.ok && result.discount).toBe(17.99);
  });
});

describe("probabilityProblems", () => {
  it("accepts active rewards that total exactly 100", () => {
    const rewards = [
      { name: "A", isActive: true, probability: 33.333 },
      { name: "B", isActive: true, probability: 33.333 },
      { name: "C", isActive: true, probability: 33.334 },
      { name: "Grand Prize", isActive: false, probability: 0 },
    ];
    expect(probabilityProblems(rewards)).toEqual([]);
  });

  it("rejects totals off 100 and active rewards at 0%", () => {
    expect(probabilityProblems([{ name: "A", isActive: true, probability: 99.9 }]).length).toBe(1);
    expect(
      probabilityProblems([
        { name: "A", isActive: true, probability: 100 },
        { name: "B", isActive: true, probability: 0 },
      ]).length
    ).toBe(1);
    expect(probabilityProblems([]).length).toBeGreaterThan(0);
  });
});

describe("rewardTermsProblems", () => {
  it("rejects percentages above the cap and flat rewards below the minimum", () => {
    expect(rewardTermsProblems({ rewardType: "percentage", discountType: "percentage", discountValue: 20, minOrderValue: null, maxDiscountAmount: null }, 18).length).toBe(1);
    expect(rewardTermsProblems({ rewardType: "flat", discountType: "flat", discountValue: 100, minOrderValue: 500, maxDiscountAmount: null }, 18).length).toBe(1);
    expect(rewardTermsProblems({ rewardType: "flat", discountType: "flat", discountValue: 100, minOrderValue: 556, maxDiscountAmount: null }, 18)).toEqual([]);
    expect(rewardTermsProblems({ rewardType: "grand_prize", discountType: null, discountValue: null, minOrderValue: null, maxDiscountAmount: null }, 18)).toEqual([]);
  });
});

describe("spinCampaignPhase", () => {
  const window = { startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-10T00:00:00Z" };
  it("derives scheduled, active and expired from the dates", () => {
    expect(spinCampaignPhase({ ...window, status: "published" }, new Date("2026-10-31T00:00:00Z"))).toBe("scheduled");
    expect(spinCampaignPhase({ ...window, status: "published" }, new Date("2026-11-05T00:00:00Z"))).toBe("active");
    expect(spinCampaignPhase({ ...window, status: "published" }, new Date("2026-11-10T00:00:00Z"))).toBe("expired");
    expect(spinCampaignPhase({ ...window, status: "paused" }, new Date("2026-11-05T00:00:00Z"))).toBe("paused");
    expect(spinCampaignPhase({ ...window, status: "draft" }, new Date("2026-11-05T00:00:00Z"))).toBe("draft");
  });
});

describe("zoned datetime inputs", () => {
  it("reads wall time in the campaign timezone and round-trips", () => {
    const date = zonedInputToDate("2026-11-08T18:00", "Asia/Kolkata");
    expect(date?.toISOString()).toBe("2026-11-08T12:30:00.000Z");
    expect(dateToZonedInput(date, "Asia/Kolkata")).toBe("2026-11-08T18:00");
    expect(zonedInputToDate("2026-11-08T18:00", "UTC")?.toISOString()).toBe("2026-11-08T18:00:00.000Z");
  });
});
