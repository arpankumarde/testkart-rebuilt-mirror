import {
  expiryCutoff,
  expiryLastDay,
  formatExpiryDay,
  isExpired,
  isExpiringSoon,
  listingStatus,
  todayIst,
} from "./contentExpiry";

describe("expiry dates (IST)", () => {
  it("keeps 15 Nov on sale all day and expires it at 16 Nov 00:00 IST", () => {
    const cutoff = expiryCutoff("2026-11-15");
    expect(cutoff.toISOString()).toBe("2026-11-15T18:30:00.000Z");
    expect(isExpired({ expiresAt: cutoff, expiredAt: null }, new Date("2026-11-15T18:29:59.999Z"))).toBe(false);
    expect(isExpired({ expiresAt: cutoff, expiredAt: null }, new Date("2026-11-15T18:30:00.000Z"))).toBe(true);
  });

  it("round-trips the last day on sale", () => {
    for (const day of ["2026-11-15", "2026-12-31", "2027-01-01", "2028-02-29"]) {
      expect(expiryLastDay(expiryCutoff(day))).toBe(day);
    }
  });

  it("reads today in IST, not UTC", () => {
    expect(todayIst(new Date("2026-11-15T18:29:00Z"))).toBe("2026-11-15");
    expect(todayIst(new Date("2026-11-15T18:31:00Z"))).toBe("2026-11-16");
  });

  it("formats a day without a timezone shift", () => {
    expect(formatExpiryDay("2026-11-15")).toContain("15");
    expect(formatExpiryDay("2026-11-15")).toContain("2026");
  });
});

describe("listingStatus", () => {
  const now = new Date("2026-11-11T06:00:00Z");
  const base = { live: true, visibility: "public" as const, expiresAt: null, expiredAt: null };

  it("leaves items without an expiry as they are", () => {
    expect(listingStatus(base, now)).toBe("active");
    expect(listingStatus({ ...base, visibility: "unlisted" }, now)).toBe("unlisted");
    expect(listingStatus({ ...base, live: false }, now)).toBe("draft");
  });

  it("flags the last week as expiring soon", () => {
    const soon = { ...base, expiresAt: expiryCutoff("2026-11-15") };
    const later = { ...base, expiresAt: expiryCutoff("2026-12-31") };
    expect(isExpiringSoon(soon, now)).toBe(true);
    expect(listingStatus(soon, now)).toBe("expiring_soon");
    expect(listingStatus(later, now)).toBe("active");
  });

  it("shows Expired, not Unlisted, once the system unlisted it", () => {
    const expired = {
      ...base,
      visibility: "unlisted" as const,
      expiresAt: expiryCutoff("2026-11-01"),
      expiredAt: new Date("2026-11-01T18:31:00Z"),
    };
    expect(listingStatus(expired, now)).toBe("expired");
  });

  it("counts an item past its date as expired before the sweep runs", () => {
    expect(listingStatus({ ...base, expiresAt: expiryCutoff("2026-11-10") }, now)).toBe("expired");
  });

  it("keeps an expired item expired after its date is extended, until relisted", () => {
    const extended = {
      ...base,
      visibility: "unlisted" as const,
      expiresAt: expiryCutoff("2026-12-31"),
      expiredAt: new Date("2026-11-01T18:31:00Z"),
    };
    expect(listingStatus(extended, now)).toBe("expired");
  });
});
