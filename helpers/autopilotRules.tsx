/**
 * Pure decision rules for the autopilot dispatcher (helpers/autopilotEngine):
 * which message variant to send and when a send may go out. Kept free of the
 * database so the specs can pin them down.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** The earliest time at or after `due` inside the daily IST send window [startHour, endHour). */
export function nextSendTime(due: Date, startHour: number, endHour: number): Date {
  const start = Math.max(0, Math.min(23, Math.floor(startHour)));
  const end = Math.max(start + 1, Math.min(24, Math.floor(endHour)));
  const ist = new Date(due.getTime() + IST_OFFSET_MS);
  const hour = ist.getUTCHours() + ist.getUTCMinutes() / 60;
  if (hour >= start && hour < end) return due;
  const dayStartIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const startToday = dayStartIst + start * HOUR_MS - IST_OFFSET_MS;
  return new Date(hour < start ? startToday : startToday + 24 * HOUR_MS);
}

export type VariantStats = { key: string; sends: number; conversions: number };

function sampleGamma(shape: number, random: () => number): number {
  if (shape < 1) return sampleGamma(shape + 1, random) * Math.pow(random() || Number.MIN_VALUE, 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      let u = 0;
      while (u === 0) u = random();
      x = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = random();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * Thompson sampling over a step's variants: each gets a Beta(1 + conversions,
 * 1 + misses) draw and the highest draw wins, so a variant that converts better
 * gets more traffic while a little keeps going to the others.
 */
export function pickVariant(variants: VariantStats[], random: () => number = Math.random): string {
  if (variants.length === 0) throw new Error("No variants to pick from");
  let best = variants[0].key;
  let bestDraw = -1;
  for (const variant of variants) {
    const wins = Math.max(0, Math.min(variant.conversions, variant.sends));
    const a = sampleGamma(1 + wins, random);
    const b = sampleGamma(1 + Math.max(0, variant.sends - wins), random);
    const draw = a / (a + b);
    if (draw > bestDraw) {
      bestDraw = draw;
      best = variant.key;
    }
  }
  return best;
}

/**
 * Tcoins offered on a recovery offer: a share of what Testkart keeps on the
 * cart, never more than checkout lets the student redeem on it (Tcoins redeem
 * at most redeemPercent of the order, up to maxRedeem), never more than what
 * is left of today's offer budget.
 */
export function offerCoins(params: {
  takeRupees: number;
  cartRupees: number;
  marginShare: number;
  redeemPercent: number;
  maxRedeem: number;
  budgetLeftRupees: number;
}): number {
  const byMargin = params.takeRupees * params.marginShare;
  const byRedeem = Math.min(params.cartRupees * (params.redeemPercent / 100), params.maxRedeem);
  const coins = Math.floor(Math.min(byMargin, byRedeem, params.budgetLeftRupees));
  return coins >= 5 ? coins : 0;
}