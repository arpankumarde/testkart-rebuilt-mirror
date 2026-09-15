// Shared model for flexible live-test prize structures: instead of fixed
// 1st/2nd/3rd fields, a teacher configures any number of rank-range tiers
// (e.g. "1st: ₹500", "2nd-3rd: ₹200 each", "4th-10th: ₹100 each"). Each tier
// pays `amountPerRank` to EVERY student who lands in [rankFrom, rankTo].
//
// Used on both the client (form editing/validation, review/leaderboard
// display) and the server (create/update persistence, prize distribution),
// so this file must stay framework-free (no React, no DB imports).

export interface PrizeTier {
  rankFrom: number;
  rankTo: number;
  amountPerRank: number;
}

/** Sorted ascending by starting rank - the canonical order for storage/display. */
export const sortPrizeTiers = (tiers: PrizeTier[]): PrizeTier[] =>
  [...tiers].sort((a, b) => a.rankFrom - b.rankFrom);

/** Highest rank covered by any tier, or 0 if there are none. Determines how many
 * top attempts need to be fetched to pay out / display prizes for. */
export const getMaxPrizeRank = (tiers: PrizeTier[]): number =>
  tiers.reduce((max, t) => Math.max(max, t.rankTo), 0);

/** Total amount that would be paid out if every tier's ranks are filled. */
export const getTotalPrizePool = (tiers: PrizeTier[]): number =>
  tiers.reduce((sum, t) => sum + t.amountPerRank * (t.rankTo - t.rankFrom + 1), 0);

/** The per-winner amount for a given 1-indexed rank, or 0 if uncovered. */
export const getPrizeForRank = (tiers: PrizeTier[], rank: number): number => {
  const tier = tiers.find((t) => rank >= t.rankFrom && rank <= t.rankTo);
  return tier ? tier.amountPerRank : 0;
};

/** Returns a human error message for the first problem found, or null if the
 * tier list is valid. Empty/zero-amount tiers are allowed here - callers that
 * want to require at least one funded tier should check separately. */
export const validatePrizeTiers = (tiers: PrizeTier[]): string | null => {
  for (const t of tiers) {
    if (!Number.isFinite(t.rankFrom) || t.rankFrom < 1) {
      return "Rank must be 1 or greater.";
    }
    if (!Number.isFinite(t.rankTo) || t.rankTo < t.rankFrom) {
      return "End rank must be greater than or equal to start rank.";
    }
    if (!Number.isFinite(t.amountPerRank) || t.amountPerRank < 0) {
      return "Prize amount cannot be negative.";
    }
  }
  const sorted = sortPrizeTiers(tiers);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].rankFrom <= sorted[i - 1].rankTo) {
      return "Rank ranges cannot overlap.";
    }
  }
  return null;
};

/** Scales every tier's per-rank amount by a multiplier (e.g. when revenue
 * can't cover the full configured pool), rounded to 2 decimals. */
export const scalePrizeTiers = (tiers: PrizeTier[], multiplier: number): PrizeTier[] =>
  tiers.map((t) => ({
    ...t,
    amountPerRank: Number((t.amountPerRank * multiplier).toFixed(2)),
  }));

/** Builds a single-rank-per-tier list from the legacy fixed 1st/2nd/3rd fields —
 * used to auto-convert existing live tests created before flexible tiers existed. */
export const legacyPrizesToTiers = (
  first: number,
  second: number,
  third: number
): PrizeTier[] => {
  const tiers: PrizeTier[] = [];
  if (first > 0) tiers.push({ rankFrom: 1, rankTo: 1, amountPerRank: first });
  if (second > 0) tiers.push({ rankFrom: 2, rankTo: 2, amountPerRank: second });
  if (third > 0) tiers.push({ rankFrom: 3, rankTo: 3, amountPerRank: third });
  return tiers;
};

/** Reads a stored prize_tiers value. Rows written after the database driver began
 * JSON-encoding jsonb parameters hold the list as a JSON string instead of an
 * array, so both shapes are accepted. Unreadable entries are dropped. */
export const parseStoredPrizeTiers = (value: unknown): PrizeTier[] => {
  let parsed: unknown = value;
  for (let depth = 0; depth < 2 && typeof parsed === "string"; depth++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const tiers: PrizeTier[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const tier = {
      rankFrom: Number(raw.rankFrom),
      rankTo: Number(raw.rankTo),
      amountPerRank: Number(raw.amountPerRank),
    };
    if (Number.isFinite(tier.rankFrom) && Number.isFinite(tier.rankTo) && Number.isFinite(tier.amountPerRank)) {
      tiers.push(tier);
    }
  }
  return tiers;
};

const toAmount = (value: unknown): number => {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
};

/** The tiers a live test pays: its stored tier list when it has one, otherwise
 * the legacy 1st/2nd/3rd columns. */
export const resolveLiveTestPrizeTiers = (
  storedTiers: unknown,
  firstPrize: unknown,
  secondPrize: unknown,
  thirdPrize: unknown
): PrizeTier[] => {
  const tiers = parseStoredPrizeTiers(storedTiers);
  return tiers.length > 0
    ? sortPrizeTiers(tiers)
    : legacyPrizesToTiers(toAmount(firstPrize), toAmount(secondPrize), toAmount(thirdPrize));
};

/** Derives the legacy 1st/2nd/3rd single-rank amounts from a tier list, so the
 * old columns (still read by a few lower-stakes display surfaces) stay populated
 * with a sensible value even though tiers are now the source of truth. */
export const tiersToLegacyPrizes = (
  tiers: PrizeTier[]
): { firstPrize: number; secondPrize: number; thirdPrize: number } => ({
  firstPrize: getPrizeForRank(tiers, 1),
  secondPrize: getPrizeForRank(tiers, 2),
  thirdPrize: getPrizeForRank(tiers, 3),
});
