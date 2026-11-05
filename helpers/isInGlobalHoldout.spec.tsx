import { isInGlobalHoldout } from "./isInGlobalHoldout";

describe("isInGlobalHoldout", () => {
  it("gives the same answer for the same user and salt", () => {
    for (let id = 1; id <= 200; id++) {
      expect(isInGlobalHoldout(id, "salt-a", 10)).toBe(isInGlobalHoldout(id, "salt-a", 10));
    }
  });

  it("holds out close to the requested share", () => {
    let held = 0;
    const total = 10000;
    for (let id = 1; id <= total; id++) if (isInGlobalHoldout(id, "salt-a", 10)) held++;
    expect(held / total).toBeGreaterThan(0.09);
    expect(held / total).toBeLessThan(0.11);
  });

  it("reshuffles under a different salt", () => {
    let differ = 0;
    for (let id = 1; id <= 1000; id++) {
      if (isInGlobalHoldout(id, "salt-a", 10) !== isInGlobalHoldout(id, "salt-b", 10)) differ++;
    }
    expect(differ).toBeGreaterThan(50);
  });

  it("holds out nobody without a salt or at 0 percent, and everybody at 100", () => {
    expect(isInGlobalHoldout(7, "", 10)).toBeFalse();
    expect(isInGlobalHoldout(7, "salt-a", 0)).toBeFalse();
    expect(isInGlobalHoldout(7, "salt-a", 100)).toBeTrue();
  });
});