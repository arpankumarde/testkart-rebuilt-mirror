/**
 * Tcoins rules shared by the server and the checkout screens, so the amount a student sees is the
 * amount they are charged. One coin = one rupee and coins are always whole.
 */

export const TCOINS_SETTING_KEY = "tcoins_config";

/** Rupees one Tcoin is worth. Every coin-to-rupee conversion goes through tcoinsRupeeValue. */
export const TCOIN_RUPEE_VALUE = 1;

export function tcoinsRupeeValue(coins: number): number {
  return Math.round(coins * TCOIN_RUPEE_VALUE * 100) / 100;
}

/** Shown wherever a student or the server explains that the two never combine. */
export const ONE_OFFER_MESSAGE = "Only one offer can be applied per purchase. Choose either a Promo Code or TCoins.";

export type TcoinsConfig = {
  enabled: boolean;
  redeemPercent: number;
  maxRedeem: number;
  cashbackPercent: number;
  maxCashback: number;
  /** Days a coin batch lasts by default: every cashback batch, and the starting value for a grant. */
  expiryDays: number;
};

export const DEFAULT_TCOINS_CONFIG: TcoinsConfig = {
  enabled: false,
  redeemPercent: 10,
  maxRedeem: 200,
  cashbackPercent: 5,
  maxCashback: 100,
  expiryDays: 30,
};

const boundedNumber = (value: unknown, fallback: number, max: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;
};

export function parseTcoinsConfig(raw: string | null | undefined): TcoinsConfig {
  let parsed: Record<string, unknown> = {};
  try {
    const value = raw ? JSON.parse(raw) : null;
    if (value && typeof value === "object") parsed = value as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  return {
    enabled: parsed.enabled === true,
    redeemPercent: boundedNumber(parsed.redeemPercent, DEFAULT_TCOINS_CONFIG.redeemPercent, 100),
    maxRedeem: Math.floor(boundedNumber(parsed.maxRedeem, DEFAULT_TCOINS_CONFIG.maxRedeem, 100000)),
    cashbackPercent: boundedNumber(parsed.cashbackPercent, DEFAULT_TCOINS_CONFIG.cashbackPercent, 100),
    maxCashback: Math.floor(boundedNumber(parsed.maxCashback, DEFAULT_TCOINS_CONFIG.maxCashback, 100000)),
    expiryDays: Math.max(1, Math.floor(boundedNumber(parsed.expiryDays, DEFAULT_TCOINS_CONFIG.expiryDays, 3650))),
  };
}

// The epsilon keeps 10% of 400 at 40 coins despite float error.
const wholeCoins = (value: number): number => Math.max(0, Math.floor(value + 1e-6));

export function tcoinsRedeemableFor(
  config: Pick<TcoinsConfig, "enabled" | "redeemPercent" | "maxRedeem">,
  orderValue: number,
  balance: number
): number {
  if (!config.enabled) return 0;
  return Math.min(wholeCoins((orderValue * config.redeemPercent) / 100 / TCOIN_RUPEE_VALUE), config.maxRedeem, wholeCoins(balance));
}

export function tcoinsCashbackFor(config: Pick<TcoinsConfig, "enabled" | "cashbackPercent" | "maxCashback">, amountPaid: number): number {
  if (!config.enabled) return 0;
  return Math.min(config.maxCashback, wholeCoins((amountPaid * config.cashbackPercent) / 100 / TCOIN_RUPEE_VALUE));
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function tcoinsExpiryFrom(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

/** A batch of coins a student received, at the moment it became spendable. */
export type TcoinLot = { coins: number; at: Date; expiresAt: Date };
export type TcoinSpend = { coins: number; at: Date };
export type TcoinReplay = {
  balance: number;
  expired: number;
  /** Unspent, unexpired batches, soonest expiry first. */
  lots: { coins: number; expiresAt: Date }[];
};

/**
 * Plays a student's batches and spends in time order. A spend uses the batch that expires soonest,
 * a batch stops counting at its expiry, and a spend that finds too few coins (cashback taken back by
 * a refund after it was spent) is a debt the next batch pays off first.
 */
export function replayTcoins(lots: TcoinLot[], spends: TcoinSpend[], now: Date = new Date()): TcoinReplay {
  type Event = { at: number; lot?: TcoinLot; spend?: number };
  const events: Event[] = [
    ...lots.filter((lot) => lot.coins > 0).map((lot): Event => ({ at: lot.at.getTime(), lot })),
    ...spends.filter((s) => s.coins > 0).map((s): Event => ({ at: s.at.getTime(), spend: s.coins })),
  ].sort((a, b) => a.at - b.at || (a.lot ? 0 : 1) - (b.lot ? 0 : 1));

  let open: { coins: number; expiresAt: number }[] = [];
  let expired = 0;
  let debt = 0;
  const expireUpTo = (t: number) => {
    for (const lot of open) if (lot.expiresAt <= t) expired += lot.coins;
    open = open.filter((lot) => lot.expiresAt > t);
  };

  for (const event of events) {
    expireUpTo(event.at);
    if (event.lot) {
      const paidOff = Math.min(debt, event.lot.coins);
      debt -= paidOff;
      const coins = event.lot.coins - paidOff;
      const expiresAt = event.lot.expiresAt.getTime();
      if (coins <= 0) continue;
      if (expiresAt <= event.at) expired += coins;
      else open.push({ coins, expiresAt });
    } else {
      let need = event.spend ?? 0;
      open.sort((a, b) => a.expiresAt - b.expiresAt);
      for (const lot of open) {
        if (need === 0) break;
        const take = Math.min(lot.coins, need);
        lot.coins -= take;
        need -= take;
      }
      open = open.filter((lot) => lot.coins > 0);
      debt += need;
    }
  }
  expireUpTo(now.getTime());
  open.sort((a, b) => a.expiresAt - b.expiresAt);

  return {
    balance: open.reduce((sum, lot) => sum + lot.coins, 0),
    expired,
    lots: open.map((lot) => ({ coins: lot.coins, expiresAt: new Date(lot.expiresAt) })),
  };
}