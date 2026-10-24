import { rotationForSlice } from "../components/SpinWinWheel";

/* Which slice sits under the pointer after turning the wheel by `rotation` degrees. */
function sliceUnderPointer(rotation: number, count: number): number {
  const slice = 360 / count;
  const offset = (((-rotation % 360) + 360) % 360) / slice;
  return Math.round(offset) % count;
}

describe("rotationForSlice", () => {
  it("lands on the requested slice from any start, with any jitter", () => {
    for (const count of [2, 5, 7, 8, 12]) {
      for (let index = 0; index < count; index++) {
        for (const from of [0, 37.5, 720, -95, 1234.5]) {
          for (const jitter of [-0.5, 0, 0.49]) {
            const target = rotationForSlice(index, count, from, 6, jitter);
            expect(sliceUnderPointer(target, count)).toBe(index);
          }
        }
      }
    }
  });

  it("always turns forward by at least the requested turns", () => {
    const target = rotationForSlice(3, 8, 100, 6, 0);
    expect(target - 100).toBeGreaterThanOrEqual(6 * 360 - 0.6 * 45);
  });
});
