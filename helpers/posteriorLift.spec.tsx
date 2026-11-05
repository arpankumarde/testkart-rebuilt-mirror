import { posteriorLift } from "./posteriorLift";

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

describe("posteriorLift", () => {
  it("finds a clear lift with large groups", () => {
    const result = posteriorLift({ conversions: 200, total: 1000 }, { conversions: 10, total: 100 }, { random: seeded(1) });
    expect(result.treatedRate).toBeCloseTo(0.2, 5);
    expect(result.holdoutRate).toBeCloseTo(0.1, 5);
    expect(result.lift).toBeGreaterThan(0.05);
    expect(result.low).toBeGreaterThan(0);
    expect(result.probabilityPositive).toBeGreaterThan(0.95);
    expect(result.enoughData).toBeTrue();
  });

  it("keeps a small sample inconclusive", () => {
    const result = posteriorLift({ conversions: 3, total: 20 }, { conversions: 0, total: 3 }, { random: seeded(2) });
    expect(result.low).toBeLessThan(0);
    expect(result.high).toBeGreaterThan(0);
    expect(result.enoughData).toBeFalse();
  });

  it("centres near zero when both groups convert alike", () => {
    const result = posteriorLift({ conversions: 100, total: 1000 }, { conversions: 100, total: 1000 }, { random: seeded(3) });
    expect(Math.abs(result.lift)).toBeLessThan(0.01);
    expect(result.low).toBeLessThan(0);
    expect(result.high).toBeGreaterThan(0);
  });

  it("handles empty groups", () => {
    const result = posteriorLift({ conversions: 0, total: 0 }, { conversions: 0, total: 0 }, { random: seeded(4) });
    expect(result.treatedRate).toBe(0);
    expect(Number.isFinite(result.lift)).toBeTrue();
  });
});