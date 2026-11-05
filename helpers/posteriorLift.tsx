/**
 * Incremental conversion of a treated group over a holdout, as a Bayesian
 * estimate: each group's rate gets a Beta(1 + conversions, 1 + misses)
 * posterior, and the difference is sampled. Small samples give wide intervals,
 * so a lucky week reads as "not proven" rather than a win. Pure; pass a seeded
 * random source for repeatable results.
 */

export type LiftEstimate = {
  treatedRate: number;
  holdoutRate: number;
  /** Posterior mean of treated minus holdout rate. */
  lift: number;
  /** 90% interval of the lift. */
  low: number;
  high: number;
  /** Probability that the treated rate is higher. */
  probabilityPositive: number;
  enoughData: boolean;
};

export const MIN_HOLDOUT_FOR_LIFT = 30;

function standardNormal(random: () => number): number {
  let u = 0;
  while (u === 0) u = random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function gamma(shape: number, random: () => number): number {
  if (shape < 1) {
    const u = random() || Number.MIN_VALUE;
    return gamma(shape + 1, random) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = standardNormal(random);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function beta(a: number, b: number, random: () => number): number {
  const x = gamma(a, random);
  const y = gamma(b, random);
  return x / (x + y);
}

export function posteriorLift(
  treated: { conversions: number; total: number },
  holdout: { conversions: number; total: number },
  options: { draws?: number; random?: () => number } = {}
): LiftEstimate {
  const draws = options.draws ?? 2000;
  const random = options.random ?? Math.random;
  const tc = Math.max(0, Math.min(treated.conversions, treated.total));
  const hc = Math.max(0, Math.min(holdout.conversions, holdout.total));
  const tn = Math.max(0, treated.total);
  const hn = Math.max(0, holdout.total);

  const diffs: number[] = new Array(draws);
  let positive = 0;
  for (let i = 0; i < draws; i++) {
    const d = beta(1 + tc, 1 + tn - tc, random) - beta(1 + hc, 1 + hn - hc, random);
    diffs[i] = d;
    if (d > 0) positive++;
  }
  diffs.sort((a, b) => a - b);
  const at = (q: number) => diffs[Math.min(draws - 1, Math.max(0, Math.floor(q * (draws - 1))))];
  const lift = diffs.reduce((sum, d) => sum + d, 0) / draws;

  return {
    treatedRate: tn > 0 ? tc / tn : 0,
    holdoutRate: hn > 0 ? hc / hn : 0,
    lift,
    low: at(0.05),
    high: at(0.95),
    probabilityPositive: positive / draws,
    enoughData: hn >= MIN_HOLDOUT_FOR_LIFT && tn >= MIN_HOLDOUT_FOR_LIFT,
  };
}