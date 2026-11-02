import {
  bestCourseCouponOffer,
  bestItemCouponOffer,
  coursePriceView,
  describeOfferItems,
  formatOfferInr,
  rankCartAutoCoupons,
  type CourseCouponCandidate,
} from "./courseCouponOffer";

const coupon = (overrides: Partial<CourseCouponCandidate>): CourseCouponCandidate => ({
  id: 1,
  code: "SAVE",
  discountType: "percentage",
  discountValue: 25,
  minPurchaseAmount: null,
  maxDiscountAmount: null,
  appliesTo: "all",
  targetItemIds: null,
  createdByTeacherId: 7,
  validUntil: null,
  ...overrides,
});

const course = { id: 10, teacherId: 7, price: 1999, discountPrice: null };

describe("bestCourseCouponOffer", () => {
  it("applies a percentage coupon to the list price", () => {
    const offer = bestCourseCouponOffer([coupon({ discountValue: 25 })], { ...course, price: 2000 });
    expect(offer?.discountAmount).toBe(500);
    expect(offer?.finalPrice).toBe(1500);
    expect(offer?.percentOff).toBe(25);
  });

  it("applies a fixed coupon and never goes below zero", () => {
    expect(bestCourseCouponOffer([coupon({ discountType: "fixed", discountValue: 500 })], course)?.finalPrice).toBe(1499);
    expect(bestCourseCouponOffer([coupon({ discountType: "fixed", discountValue: 5000 })], course)?.finalPrice).toBe(0);
  });

  it("takes the coupon off the sale price and reports the saving against the list price", () => {
    const offer = bestCourseCouponOffer([coupon({ discountValue: 10 })], { ...course, price: 2000, discountPrice: 1800 });
    expect(offer?.basePrice).toBe(1800);
    expect(offer?.finalPrice).toBe(1620);
    expect(offer?.percentOff).toBe(19);
  });

  it("picks the coupon that takes the most off, and the older one on a tie", () => {
    const offer = bestCourseCouponOffer(
      [
        coupon({ id: 3, code: "TEN", discountValue: 10 }),
        coupon({ id: 2, code: "FLAT300", discountType: "fixed", discountValue: 300 }),
        coupon({ id: 1, code: "ALSO300", discountType: "fixed", discountValue: 300 }),
      ],
      course
    );
    expect(offer?.code).toBe("ALSO300");
  });

  it("respects the percentage cap and the minimum purchase", () => {
    expect(bestCourseCouponOffer([coupon({ discountValue: 50, maxDiscountAmount: 200 })], course)?.discountAmount).toBe(200);
    expect(bestCourseCouponOffer([coupon({ minPurchaseAmount: 2500 })], course)).toBeNull();
  });

  it("ignores another teacher's coupon, a coupon for other courses and free courses", () => {
    expect(bestCourseCouponOffer([coupon({ createdByTeacherId: 8 })], course)).toBeNull();
    expect(bestCourseCouponOffer([coupon({ appliesTo: "courses", targetItemIds: [11] })], course)).toBeNull();
    expect(bestCourseCouponOffer([coupon({ appliesTo: "courses", targetItemIds: [10] })], course)).not.toBeNull();
    expect(bestCourseCouponOffer([coupon({})], { ...course, price: 0 })).toBeNull();
  });
});

describe("bestItemCouponOffer for study notes", () => {
  const note = { id: 40, teacherId: 7, price: 599, discountPrice: null };

  it("applies a percentage coupon scoped to all items or to study notes", () => {
    const offer = bestItemCouponOffer([coupon({ discountValue: 20, minPurchaseAmount: 499, maxDiscountAmount: 600 })], "digitalProduct", note);
    expect(offer?.discountAmount).toBe(119.8);
    expect(offer?.finalPrice).toBe(479.2);
    expect(offer?.percentOff).toBe(20);
    expect(bestItemCouponOffer([coupon({ appliesTo: "digital_products" })], "digitalProduct", note)).not.toBeNull();
  });

  it("applies a fixed coupon and caps a percentage one", () => {
    expect(bestItemCouponOffer([coupon({ discountType: "fixed", discountValue: 100 })], "digitalProduct", note)?.finalPrice).toBe(499);
    expect(bestItemCouponOffer([coupon({ discountValue: 50, maxDiscountAmount: 150 })], "digitalProduct", note)?.finalPrice).toBe(449);
  });

  it("ignores a course-only coupon, another teacher's coupon, an unmet minimum and other notes", () => {
    expect(bestItemCouponOffer([coupon({ appliesTo: "courses" })], "digitalProduct", note)).toBeNull();
    expect(bestItemCouponOffer([coupon({ createdByTeacherId: 8 })], "digitalProduct", note)).toBeNull();
    expect(bestItemCouponOffer([coupon({ minPurchaseAmount: 600 })], "digitalProduct", note)).toBeNull();
    expect(bestItemCouponOffer([coupon({ appliesTo: "digital_products", targetItemIds: [41] })], "digitalProduct", note)).toBeNull();
  });

  it("does not let a notes-only coupon discount a course", () => {
    expect(bestCourseCouponOffer([coupon({ appliesTo: "digital_products" })], course)).toBeNull();
  });
});

describe("rankCartAutoCoupons", () => {
  it("spreads one coupon across the teacher's courses and caps it per order", () => {
    const lines = [
      { kind: "course" as const, id: 10, teacherId: 7, price: 1000 },
      { kind: "course" as const, id: 11, teacherId: 7, price: 500 },
      { kind: "course" as const, id: 12, teacherId: 9, price: 800 },
    ];
    const [best] = rankCartAutoCoupons([coupon({ discountValue: 20, maxDiscountAmount: 250 })], lines);
    expect(best.discountAmount).toBe(250);
    expect(best.eligibleCourseIds).toEqual([10, 11]);
    expect(best.eligibleDigitalProductIds).toEqual([]);
  });

  it("covers the teacher's courses and study notes together", () => {
    const lines = [
      { kind: "course" as const, id: 10, teacherId: 7, price: 1000 },
      { kind: "digitalProduct" as const, id: 40, teacherId: 7, price: 599 },
    ];
    const [best] = rankCartAutoCoupons([coupon({ discountValue: 20 })], lines);
    expect(best.discountAmount).toBe(319.8);
    expect(best.eligibleCourseIds).toEqual([10]);
    expect(best.eligibleDigitalProductIds).toEqual([40]);
  });

  it("returns a single best offer when two teachers both have one", () => {
    const lines = [
      { kind: "course" as const, id: 10, teacherId: 7, price: 1000 },
      { kind: "course" as const, id: 12, teacherId: 9, price: 800 },
    ];
    const ranked = rankCartAutoCoupons(
      [coupon({ id: 1, code: "A", discountValue: 10 }), coupon({ id: 2, code: "B", createdByTeacherId: 9, discountValue: 50 })],
      lines
    );
    expect(ranked.map((r) => r.code)).toEqual(["B", "A"]);
    expect(ranked[0].eligibleCourseIds).toEqual([12]);
  });

  it("checks the minimum purchase against the eligible items", () => {
    const lines = [
      { kind: "course" as const, id: 10, teacherId: 7, price: 400 },
      { kind: "digitalProduct" as const, id: 40, teacherId: 7, price: 400 },
    ];
    expect(rankCartAutoCoupons([coupon({ minPurchaseAmount: 700 })], lines).length).toBe(1);
    expect(rankCartAutoCoupons([coupon({ minPurchaseAmount: 900 })], lines).length).toBe(0);
  });
});

describe("coursePriceView", () => {
  it("shows the list price struck through and the offer price", () => {
    const offer = bestCourseCouponOffer([coupon({ discountType: "fixed", discountValue: 500 })], course);
    const view = coursePriceView(1999, null, offer);
    expect(view.finalPrice).toBe(1499);
    expect(view.originalPrice).toBe(1999);
    expect(view.percentOff).toBe(25);
    expect(view.offer?.code).toBe("SAVE");
  });

  it("falls back to the sale price, then the list price, without an offer", () => {
    expect(coursePriceView(1999, 1499).finalPrice).toBe(1499);
    expect(coursePriceView(1999, 1499).offer).toBeNull();
    expect(coursePriceView(1999, null).originalPrice).toBeNull();
    expect(coursePriceView(0, null).isFree).toBe(true);
  });

  it("formats paise only when present", () => {
    expect(formatOfferInr(1499)).toBe("₹1,499");
    expect(formatOfferInr(1619.1)).toBe("₹1,619.10");
  });

  it("names the items an offer covers", () => {
    expect(describeOfferItems(2, 0)).toBe("2 courses");
    expect(describeOfferItems(0, 1)).toBe("1 study note");
    expect(describeOfferItems(1, 2)).toBe("1 course and 2 study notes");
  });
});
