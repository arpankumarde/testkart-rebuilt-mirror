import { courseDiscountError, courseDiscountPrice, courseEffectivePrice } from "./coursePricing";

describe("courseDiscountPrice", () => {
  it("returns a discount that sits between 0 and the price", () => {
    expect(courseDiscountPrice("499.00", "299.00")).toBe(299);
    expect(courseDiscountPrice(499, 299)).toBe(299);
  });

  it("ignores missing, zero, equal or higher discounts", () => {
    expect(courseDiscountPrice(499, null)).toBeNull();
    expect(courseDiscountPrice(499, undefined)).toBeNull();
    expect(courseDiscountPrice(499, 0)).toBeNull();
    expect(courseDiscountPrice(499, 499)).toBeNull();
    expect(courseDiscountPrice(499, 600)).toBeNull();
    expect(courseDiscountPrice(0, 100)).toBeNull();
  });
});

describe("courseEffectivePrice", () => {
  it("charges the discount when valid, else the list price", () => {
    expect(courseEffectivePrice("499.00", "299.00")).toBe(299);
    expect(courseEffectivePrice("499.00", null)).toBe(499);
    expect(courseEffectivePrice("499.00", "0.00")).toBe(499);
    expect(courseEffectivePrice("0.00", null)).toBe(0);
  });
});

describe("courseDiscountError", () => {
  it("accepts no discount or a valid one", () => {
    expect(courseDiscountError(499, null)).toBeNull();
    expect(courseDiscountError(499, undefined)).toBeNull();
    expect(courseDiscountError(499, 299)).toBeNull();
  });

  it("rejects discounts that are not below the price, not positive, or on a free course", () => {
    expect(courseDiscountError(499, 499)).toMatch(/less than the price/);
    expect(courseDiscountError(499, 0)).toMatch(/more than 0/);
    expect(courseDiscountError(0, 100)).toMatch(/free course/);
  });
});
