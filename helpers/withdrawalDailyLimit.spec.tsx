import {
  formatIstDateTime,
  getWithdrawalDailyLimit,
  istDayStart,
  latestRequestedAt,
  nextIstDayStart,
} from "./withdrawalDailyLimit";

describe("withdrawal daily limit", () => {
  it("starts the IST day at 18:30 UTC the evening before", () => {
    expect(istDayStart(new Date("2026-11-17T10:00:00Z")).toISOString()).toBe("2026-11-16T18:30:00.000Z");
    expect(istDayStart(new Date("2026-11-16T18:30:00Z")).toISOString()).toBe("2026-11-16T18:30:00.000Z");
    expect(istDayStart(new Date("2026-11-16T18:29:59.999Z")).toISOString()).toBe("2026-11-15T18:30:00.000Z");
    expect(nextIstDayStart(new Date("2026-11-17T10:00:00Z")).toISOString()).toBe("2026-11-17T18:30:00.000Z");
  });

  it("handles month and year boundaries", () => {
    expect(istDayStart(new Date("2026-12-31T20:00:00Z")).toISOString()).toBe("2026-12-31T18:30:00.000Z");
    expect(nextIstDayStart(new Date("2026-12-31T17:00:00Z")).toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });

  it("allows the first request when there is none", () => {
    expect(getWithdrawalDailyLimit(null, new Date("2026-11-17T10:00:00Z"))).toEqual({
      lastRequestedAt: null,
      nextAvailableAt: null,
    });
  });

  it("blocks a second request the same IST day until 12:00 AM IST", () => {
    const limit = getWithdrawalDailyLimit("2026-11-17T03:00:00Z", new Date("2026-11-17T17:00:00Z"));
    expect(limit.nextAvailableAt?.toISOString()).toBe("2026-11-17T18:30:00.000Z");
    expect(limit.lastRequestedAt?.toISOString()).toBe("2026-11-17T03:00:00.000Z");
  });

  it("treats 11:59 PM IST and 12:00 AM IST as different days", () => {
    const lateNight = "2026-11-17T18:29:00Z";
    expect(getWithdrawalDailyLimit(lateNight, new Date("2026-11-17T18:29:30Z")).nextAvailableAt).not.toBeNull();
    expect(getWithdrawalDailyLimit(lateNight, new Date("2026-11-17T18:30:00Z")).nextAvailableAt).toBeNull();
  });

  it("allows a request on the next calendar day", () => {
    expect(getWithdrawalDailyLimit("2026-11-16T10:00:00Z", new Date("2026-11-17T04:00:00Z")).nextAvailableAt).toBeNull();
  });

  it("finds the latest request whatever the order", () => {
    const latest = latestRequestedAt([
      { requestedDate: new Date("2026-11-15T10:00:00Z") },
      { requestedDate: null },
      { requestedDate: "2026-11-17T09:00:00Z" },
      { requestedDate: new Date("2026-11-16T10:00:00Z") },
    ]);
    expect(latest?.toISOString()).toBe("2026-11-17T09:00:00.000Z");
  });

  it("formats in IST", () => {
    expect(formatIstDateTime("2026-11-17T10:12:00Z")).toMatch(/17 Nov 2026, 3:42\s?pm IST/i);
  });
});
