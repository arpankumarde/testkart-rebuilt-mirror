import { discountMethodLine, orderDiscountBreakdown } from "./orderDiscountMethod";

describe("orderDiscountBreakdown", () => {
  it("reads a promo code order", () => {
    const b = orderDiscountBreakdown({ totalAmount: 399, discountAmount: 100, tcoinsRedeemed: 0, promoCodeId: 7 });
    expect(b.method).toBe("promo_code");
    expect(b.originalAmount).toBe(499);
    expect(discountMethodLine(b, "SAVE20")).toBe("Promo code: SAVE20");
  });

  it("reads a Tcoins order and values the coins", () => {
    const b = orderDiscountBreakdown({ totalAmount: 399, discountAmount: 0, tcoinsRedeemed: 100, promoCodeId: null });
    expect(b.method).toBe("tcoins");
    expect(b.tcoinsValue).toBe(100);
    expect(b.originalAmount).toBe(499);
    expect(discountMethodLine(b, null)).toBe("100 Tcoins used");
  });

  it("reads a plain order and a promo whose code is gone", () => {
    const plain = orderDiscountBreakdown({ totalAmount: 599, discountAmount: 0, tcoinsRedeemed: 0, promoCodeId: null });
    expect(plain.method).toBe("none");
    expect(plain.originalAmount).toBe(599);
    const gone = orderDiscountBreakdown({ totalAmount: 50, discountAmount: 10.5, tcoinsRedeemed: 0, promoCodeId: 9 });
    expect(discountMethodLine(gone, null)).toBe("Promo code: Not available");
    expect(gone.originalAmount).toBe(60.5);
  });
});