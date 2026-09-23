import { promoCodeAppliesToItem, promoCodeCoversTeacher } from "./promoCodeEligibility";

describe("promoCodeCoversTeacher", () => {
  it("covers only the creating teacher's items, or any item for an admin code", () => {
    expect(promoCodeCoversTeacher(7, 7)).toBe(true);
    expect(promoCodeCoversTeacher(7, 8)).toBe(false);
    expect(promoCodeCoversTeacher(7, null)).toBe(false);
    expect(promoCodeCoversTeacher(null, 8)).toBe(true);
  });
});

describe("promoCodeAppliesToItem", () => {
  it("accepts every item type for an 'all' code with no targets", () => {
    const promo = { appliesTo: "all", targetItemIds: null };
    expect(promoCodeAppliesToItem(promo, "course", 1)).toBe(true);
    expect(promoCodeAppliesToItem(promo, "test", 1)).toBe(true);
    expect(promoCodeAppliesToItem(promo, "live_test", 1)).toBe(true);
    expect(promoCodeAppliesToItem(promo, "bundle", 1)).toBe(true);
    expect(promoCodeAppliesToItem(promo, "digital_product", 1)).toBe(true);
  });

  it("limits a typed code to its own item type", () => {
    const promo = { appliesTo: "courses", targetItemIds: [] };
    expect(promoCodeAppliesToItem(promo, "course", 5)).toBe(true);
    expect(promoCodeAppliesToItem(promo, "test", 5)).toBe(false);
    expect(promoCodeAppliesToItem({ appliesTo: "digital_products", targetItemIds: null }, "digital_product", 5)).toBe(true);
    expect(promoCodeAppliesToItem({ appliesTo: "live_tests", targetItemIds: null }, "live_test", 5)).toBe(true);
  });

  it("requires the item to be listed when targets are set", () => {
    const promo = { appliesTo: "bundles", targetItemIds: [3, 4] };
    expect(promoCodeAppliesToItem(promo, "bundle", 3)).toBe(true);
    expect(promoCodeAppliesToItem(promo, "bundle", 9)).toBe(false);
  });

  it("does not let a matching id on another item type through", () => {
    const promo = { appliesTo: "courses", targetItemIds: [3] };
    expect(promoCodeAppliesToItem(promo, "bundle", 3)).toBe(false);
  });
});
