import {
  formatHistoryPrice,
  formatPercent,
  formatPriceDelta,
  permittedPriceHistoryTypes,
  priceChangePercent,
  priceMovement,
} from "./productPriceHistory";
import { priceChangeActor } from "./productPriceHistoryServer";

describe("priceMovement", () => {
  it("names increases and decreases", () => {
    expect(priceMovement(99, 149)).toBe("increase");
    expect(priceMovement(199, 149)).toBe("decrease");
  });

  it("names free to paid and paid to free ahead of increase and decrease", () => {
    expect(priceMovement(0, 199)).toBe("free_to_paid");
    expect(priceMovement(129, 0)).toBe("paid_to_free");
  });

  it("treats an unchanged selling price as a list price change", () => {
    expect(priceMovement(249, 249)).toBe("list_only");
  });
});

describe("priceChangePercent", () => {
  it("rounds to one decimal", () => {
    expect(priceChangePercent(99, 149)).toBe(50.5);
    expect(priceChangePercent(199, 149)).toBe(-25.1);
  });

  it("has no percentage from a free price", () => {
    expect(priceChangePercent(0, 199)).toBeNull();
  });
});

describe("price formatting", () => {
  it("shows free and rupees with paise only when present", () => {
    expect(formatHistoryPrice(0)).toBe("Free");
    expect(formatHistoryPrice(1499)).toBe("₹1,499");
    expect(formatHistoryPrice(149.5)).toBe("₹149.50");
    expect(formatHistoryPrice(null)).toBe("-");
  });

  it("signs the difference", () => {
    expect(formatPriceDelta(99, 149)).toBe("+₹50");
    expect(formatPriceDelta(149, 99.5)).toBe("-₹49.50");
    expect(formatPriceDelta(10, 10)).toBe("₹0");
    expect(formatPercent(50.5)).toBe("+50.5%");
    expect(formatPercent(-25.1)).toBe("-25.1%");
  });
});

describe("permittedPriceHistoryTypes", () => {
  it("unlocks only the types whose section the admin holds", () => {
    expect(permittedPriceHistoryTypes(["notes", "bundles", "dashboard"])).toEqual(["digital_product", "course_bundle"]);
    expect(permittedPriceHistoryTypes(["teachers"])).toEqual([]);
    expect(permittedPriceHistoryTypes(null)).toEqual([]);
  });
});

describe("priceChangeActor", () => {
  const session = {};

  it("records the teacher who owns the account", () => {
    expect(priceChangeActor({ user: { id: 7, role: "teacher" }, teacherRole: "owner", impersonatorAdminId: null, session })).toEqual({
      userId: 7,
      adminId: null,
      source: "teacher",
    });
  });

  it("records a team member under their own id", () => {
    expect(priceChangeActor({ user: { id: 42, role: "teacher" }, teacherRole: "manager", session }).source).toBe("team_member");
  });

  it("records the admin behind an admin editor session", () => {
    expect(
      priceChangeActor({ user: { id: 7, role: "teacher" }, teacherRole: "owner", impersonatorAdminId: 3, session: { adminEditType: "course" } })
    ).toEqual({ userId: 7, adminId: 3, source: "admin_editor" });
  });

  it("records an admin signed in as the teacher", () => {
    expect(priceChangeActor({ user: { id: 7, role: "teacher" }, impersonatorAdminId: 3, session }).source).toBe("admin_impersonation");
  });
});
