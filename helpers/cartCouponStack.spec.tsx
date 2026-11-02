import { pickAutoOffers, priceCouponStack, spreadDiscount, type ChosenCoupon, type StackLine, type StackPromo } from "./cartCouponStack";
import type { CourseCouponCandidate } from "./courseCouponOffer";

const teacherCoupon = (overrides: Partial<CourseCouponCandidate>): CourseCouponCandidate => ({
  id: 1,
  code: "NET20",
  discountType: "percentage",
  discountValue: 20,
  minPurchaseAmount: null,
  maxDiscountAmount: null,
  appliesTo: "all",
  targetItemIds: null,
  createdByTeacherId: 7,
  validUntil: null,
  ...overrides,
});

const promo = (overrides: Partial<StackPromo>): StackPromo => ({
  id: 900,
  code: "SAVE10",
  discountType: "percentage",
  discountValue: 10,
  minPurchaseAmount: null,
  maxDiscountAmount: null,
  appliesTo: "all",
  targetItemIds: null,
  createdByTeacherId: null,
  ...overrides,
});

const spin = (overrides: Partial<Extract<ChosenCoupon, { source: "spin" }>["spin"]> = {}): ChosenCoupon => ({
  source: "spin",
  promo: promo({ id: 950, code: "DIWALI-ABC" }),
  spin: {
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 10,
    maxDiscountAmount: null,
    maxDiscountPercent: 18,
    eligibleCategories: ["test_series", "courses", "study_notes"],
    ...overrides,
  },
});

const course: StackLine = { kind: "course", id: 10, teacherId: 7, price: 999 };
const otherCourse: StackLine = { kind: "course", id: 20, teacherId: 9, price: 500 };
const test: StackLine = { kind: "test", id: 77, teacherId: 7, price: 200 };
const note: StackLine = { kind: "digitalProduct", id: 40, teacherId: 7, price: 599 };
const otherNote: StackLine = { kind: "digitalProduct", id: 41, teacherId: 9, price: 300 };

describe("spreadDiscount", () => {
  it("splits by weight and adds up to the paisa", () => {
    const shares = spreadDiscount(100, [
      { key: "a", weight: 1 },
      { key: "b", weight: 1 },
      { key: "c", weight: 1 },
    ]);
    const total = [...shares.values()].reduce((s, v) => s + v, 0);
    expect(Math.round(total * 100)).toBe(10000);
    expect(shares.get("a")).toBe(33.34);
    expect(shares.get("c")).toBe(33.33);
  });
});

describe("pickAutoOffers", () => {
  it("gives each teacher's courses their own offer, one per course", () => {
    const offers = pickAutoOffers(
      [teacherCoupon({}), teacherCoupon({ id: 2, code: "PHY50", createdByTeacherId: 9, discountValue: 50 })],
      [course, otherCourse]
    );
    expect(offers.map((o) => o.code).sort()).toEqual(["NET20", "PHY50"]);
    expect(offers.find((o) => o.code === "NET20")?.eligibleCourseIds).toEqual([10]);
  });

  it("never puts two offers on the same course", () => {
    const offers = pickAutoOffers([teacherCoupon({}), teacherCoupon({ id: 2, code: "NET10", discountValue: 10 })], [course]);
    expect(offers.map((o) => o.code)).toEqual(["NET20"]);
  });

  it("gives study notes the teacher's offer, and never tests", () => {
    const offers = pickAutoOffers([teacherCoupon({})], [note, test]);
    expect(offers.length).toBe(1);
    expect(offers[0].eligibleDigitalProductIds).toEqual([40]);
    expect(offers[0].discountAmount).toBe(119.8);
  });
});

describe("priceCouponStack", () => {
  it("applies the teacher offer by itself", () => {
    const result = priceCouponStack({ lines: [course], autoCandidates: [teacherCoupon({})], chosen: null });
    expect(result.teacherDiscount).toBe(199.8);
    expect(result.payable).toBe(799.2);
    expect(result.lines[0].autoDiscount).toBe(199.8);
  });

  it("applies the teacher offer to a study note by itself", () => {
    const result = priceCouponStack({ lines: [note], autoCandidates: [teacherCoupon({ minPurchaseAmount: 499, maxDiscountAmount: 600 })], chosen: null });
    expect(result.teacherDiscount).toBe(119.8);
    expect(result.payable).toBe(479.2);
    expect(result.lines[0].autoDiscount).toBe(119.8);
  });

  it("skips the offer when the notes miss its minimum, and leaves a note with no coupon at full price", () => {
    const short = priceCouponStack({ lines: [{ ...note, price: 299 }], autoCandidates: [teacherCoupon({ minPurchaseAmount: 499 })], chosen: null });
    expect(short.autoOffers).toEqual([]);
    expect(short.payable).toBe(299);
    const none = priceCouponStack({ lines: [otherNote], autoCandidates: [teacherCoupon({})], chosen: null });
    expect(none.payable).toBe(300);
  });

  it("spreads one offer over a teacher's course and note, and gives each teacher their own", () => {
    const result = priceCouponStack({
      lines: [course, note, otherNote],
      autoCandidates: [teacherCoupon({}), teacherCoupon({ id: 2, code: "PHY10", createdByTeacherId: 9, discountValue: 10 })],
      chosen: null,
    });
    expect(result.autoOffers.map((o) => o.code).sort()).toEqual(["NET20", "PHY10"]);
    expect(result.lines.find((l) => l.key === "course:10")?.autoDiscount).toBe(199.8);
    expect(result.lines.find((l) => l.key === "digitalProduct:40")?.autoDiscount).toBe(119.8);
    expect(result.lines.find((l) => l.key === "digitalProduct:41")?.autoDiscount).toBe(30);
    expect(result.payable).toBe(1548.4);
  });

  it("adds a platform coupon on a note's price after the teacher offer", () => {
    const result = priceCouponStack({
      lines: [note],
      autoCandidates: [teacherCoupon({})],
      chosen: { source: "platform", promo: promo({}) },
    });
    expect(result.teacherDiscount).toBe(119.8);
    expect(result.chosen?.discountAmount).toBe(47.92);
    expect(result.payable).toBe(431.28);
  });

  it("lets a typed teacher code replace the offer on a note and reports it", () => {
    const result = priceCouponStack({
      lines: [note],
      autoCandidates: [teacherCoupon({})],
      chosen: { source: "teacher", promo: promo({ id: 3, code: "VIP40", discountValue: 40, createdByTeacherId: 7 }) },
    });
    expect(result.autoOffers).toEqual([]);
    expect(result.chosen?.replacesAutoOnKeys).toEqual(["digitalProduct:40"]);
    expect(result.chosen?.replacesAutoOn).toEqual([]);
    expect(result.discountAmount).toBe(239.6);
  });

  it("adds a platform coupon on the price after the teacher offer", () => {
    const result = priceCouponStack({
      lines: [course],
      autoCandidates: [teacherCoupon({})],
      chosen: { source: "platform", promo: promo({}) },
    });
    expect(result.teacherDiscount).toBe(199.8);
    expect(result.chosen?.discountAmount).toBe(79.92);
    expect(result.discountAmount).toBe(279.72);
    expect(result.payable).toBe(719.28);
    expect(result.lines[0].chosenDiscount).toBe(79.92);
  });

  it("keeps the teacher offer whichever platform coupon is chosen", () => {
    const a = priceCouponStack({ lines: [course, test], autoCandidates: [teacherCoupon({})], chosen: spin() });
    const b = priceCouponStack({
      lines: [course, test],
      autoCandidates: [teacherCoupon({})],
      chosen: { source: "platform", promo: promo({ discountType: "fixed", discountValue: 50 }) },
    });
    expect(a.autoOffers.map((o) => o.code)).toEqual(["NET20"]);
    expect(b.autoOffers.map((o) => o.code)).toEqual(["NET20"]);
    expect(b.chosen?.discountAmount).toBe(50);
  });

  it("checks a Spin & Win coupon's minimum and cap after the teacher offer, and says so", () => {
    const tooSmall = priceCouponStack({
      lines: [course],
      autoCandidates: [teacherCoupon({})],
      chosen: spin({ minOrderValue: 900 }),
    });
    expect(tooSmall.chosen).toBeNull();
    expect(tooSmall.chosenError).toContain("Teacher offers come off first");
    expect(tooSmall.teacherDiscount).toBe(199.8);

    const capped = priceCouponStack({ lines: [course], autoCandidates: [teacherCoupon({})], chosen: spin({ discountValue: 18, maxDiscountAmount: 100 }) });
    expect(capped.chosen?.discountAmount).toBe(100);
  });

  it("explains a platform minimum that the teacher offer pushes out of reach", () => {
    const result = priceCouponStack({
      lines: [course],
      autoCandidates: [teacherCoupon({})],
      chosen: { source: "platform", promo: promo({ minPurchaseAmount: 900 }) },
    });
    expect(result.chosen).toBeNull();
    expect(result.chosenError).toContain("after the teacher discount");
    expect(result.payable).toBe(799.2);
  });

  it("does not count the automatic code twice when it is typed", () => {
    const result = priceCouponStack({
      lines: [course],
      autoCandidates: [teacherCoupon({})],
      chosen: { source: "teacher", promo: promo({ id: 1, code: "NET20", discountValue: 20, createdByTeacherId: 7 }) },
    });
    expect(result.chosenAlreadyAuto).toBe(true);
    expect(result.discountAmount).toBe(199.8);
  });

  it("lets a typed teacher code replace the automatic offer only on the items it covers", () => {
    const result = priceCouponStack({
      lines: [course, otherCourse],
      autoCandidates: [teacherCoupon({}), teacherCoupon({ id: 2, code: "PHY50", createdByTeacherId: 9, discountValue: 50 })],
      chosen: { source: "teacher", promo: promo({ id: 3, code: "VIP40", discountValue: 40, createdByTeacherId: 7 }) },
    });
    expect(result.autoOffers.map((o) => o.code)).toEqual(["PHY50"]);
    expect(result.chosen?.discountAmount).toBe(399.6);
    expect(result.chosen?.replacesAutoOn).toEqual([10]);
    expect(result.lines.find((l) => l.id === 10)?.autoDiscount).toBe(0);
  });

  it("restores the automatic offers when the chosen coupon cannot apply", () => {
    const result = priceCouponStack({
      lines: [course],
      autoCandidates: [teacherCoupon({})],
      chosen: { source: "teacher", promo: promo({ id: 3, code: "VIP40", createdByTeacherId: 7, minPurchaseAmount: 5000 }) },
    });
    expect(result.chosen).toBeNull();
    expect(result.autoOffers.map((o) => o.code)).toEqual(["NET20"]);
    expect(result.chosenError).toContain("minimum purchase");
  });

  it("keeps per-line shares equal to the order discount", () => {
    const result = priceCouponStack({
      lines: [course, test, otherCourse],
      autoCandidates: [teacherCoupon({ maxDiscountAmount: 150 })],
      chosen: spin({ discountValue: 15 }),
    });
    const total = result.lines.reduce((s, l) => s + l.autoDiscount + l.chosenDiscount, 0);
    expect(Math.round(total * 100)).toBe(Math.round(result.discountAmount * 100));
  });
});
