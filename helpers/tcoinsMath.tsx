/**
 * Tcoins rules shared by the server and the checkout screens, so the amount a student sees is the
 * amount they are charged. One coin = one rupee and coins are always whole.
 */

export const TCOINS_SETTING_KEY = "tcoins_config";

export type TcoinsConfig = {
  enabled: boolean;
  redeemPercent: number;
  maxRedeem: number;
  cashbackPercent: number;
  maxCashback: number;
};

export const DEFAULT_TCOINS_CONFIG: TcoinsConfig = {
  enabled: false,
  redeemPercent: 10,
  maxRedeem: 200,
  cashbackPercent: 5,
  maxCashback: 100,
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
  };
}

// The epsilon keeps 10% of 400 at 40 coins despite float error.
const wholeCoins = (value: number): number => Math.max(0, Math.floor(value + 1e-6));

export function tcoinsRedeemableFor(config: TcoinsConfig, orderValue: number, balance: number): number {
  if (!config.enabled) return 0;
  return Math.min(wholeCoins((orderValue * config.redeemPercent) / 100), config.maxRedeem, wholeCoins(balance));
}

export function tcoinsCashbackFor(config: TcoinsConfig, amountPaid: number): number {
  if (!config.enabled) return 0;
  return Math.min(config.maxCashback, wholeCoins((amountPaid * config.cashbackPercent) / 100));
}