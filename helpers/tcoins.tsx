import { sql, Kysely, Transaction } from "kysely";
import { db } from "./db";
import { DB } from "./schema";
import {
  TCOINS_SETTING_KEY,
  parseTcoinsConfig,
  tcoinsCashbackFor,
  tcoinsExpiryFrom,
  tcoinsRedeemableFor,
  tcoinsRupeeValue,
  replayTcoins,
  ONE_OFFER_MESSAGE,
  DEFAULT_TCOINS_CONFIG,
  type TcoinLot,
  type TcoinSpend,
  type TcoinsConfig,
} from "./tcoinsMath";

export { TCOINS_SETTING_KEY, type TcoinsConfig } from "./tcoinsMath";

/**
 * Tcoins: a non-withdrawable student balance, one coin = one rupee.
 *
 * Spending: a student can pay up to redeemPercent of an order's value with coins, capped at maxRedeem.
 * Earning: every paid order earns cashbackPercent of the cash actually paid, capped at maxCashback.
 * Coins never combine with a coupon (Spin & Win included), but a coupon order still earns cashback.
 *
 * There is no full ledger. Grants (admin form, autopilot offers) live in tcoin_grants. Each order
 * stores tcoins_redeemed and tcoins_cashback, and the rest of the balance is derived from order
 * status, so every completion, failure, cancel and refund path moves coins with no extra code:
 * cashback counts once its order is completed, and spent coins count while the order is pending or
 * completed, so a failed, cancelled or refunded order hands them back (to their original batches,
 * so coins returned after their batch expired stay expired).
 *
 * Every batch expires: a grant at tcoin_grants.expires_at, cashback at orders.tcoins_cashback_expires_at
 * (set from expiryDays when the order is created). helpers/tcoinsMath replayTcoins spends the batch
 * that expires soonest first.
 */

type Queryable = Kysely<DB> | Transaction<DB>;

export async function getTcoinsConfig(q: Queryable = db): Promise<TcoinsConfig> {
  const row = await q
    .selectFrom("platformSettings")
    .select("settingValue")
    .where("settingKey", "=", TCOINS_SETTING_KEY)
    .executeTakeFirst();
  return parseTcoinsConfig(row?.settingValue);
}

export type TcoinBalance = {
  balance: number;
  pendingCashback: number;
  totalEarned: number;
  totalSpent: number;
  totalExpired: number;
  /** Unspent batches still to expire, soonest first. */
  expiring: { coins: number; expiresAt: Date }[];
};

type TcoinMovements = { lots: TcoinLot[]; spends: TcoinSpend[]; pendingCashback: number };

/** Every student's coin batches and spends, or one student's when userId is given. */
export async function loadTcoinMovements(q: Queryable = db, userId?: number): Promise<Map<number, TcoinMovements>> {
  let orderQuery = q
    .selectFrom("orders")
    .where((eb) => eb.or([eb("tcoinsRedeemed", ">", 0), eb("tcoinsCashback", ">", 0)]))
    .where("status", "in", ["pending", "completed"])
    .select(["userId", "status", "tcoinsRedeemed", "tcoinsCashback", "tcoinsCashbackExpiresAt", "createdAt", "paidAt"]);
  let grantQuery = q.selectFrom("tcoinGrants").select(["userId", "coins", "createdAt", "expiresAt"]);
  if (userId !== undefined) {
    orderQuery = orderQuery.where("userId", "=", userId);
    grantQuery = grantQuery.where("userId", "=", userId);
  }
  const [orders, grants] = await Promise.all([orderQuery.execute(), grantQuery.execute()]);

  const byUser = new Map<number, TcoinMovements>();
  const forUser = (id: number) => {
    let entry = byUser.get(id);
    if (!entry) {
      entry = { lots: [], spends: [], pendingCashback: 0 };
      byUser.set(id, entry);
    }
    return entry;
  };

  for (const o of orders) {
    const entry = forUser(o.userId);
    const createdAt = o.createdAt ?? new Date();
    if (o.tcoinsRedeemed > 0) entry.spends.push({ coins: o.tcoinsRedeemed, at: createdAt });
    if (o.tcoinsCashback <= 0) continue;
    if (o.status === "pending") {
      entry.pendingCashback += o.tcoinsCashback;
    } else {
      const at = o.paidAt ?? createdAt;
      entry.lots.push({
        coins: o.tcoinsCashback,
        at,
        expiresAt: o.tcoinsCashbackExpiresAt ?? tcoinsExpiryFrom(at, DEFAULT_TCOINS_CONFIG.expiryDays),
      });
    }
  }
  for (const g of grants) {
    const entry = forUser(g.userId);
    // A negative grant is a manual take-back, spent like an order.
    if (g.coins >= 0) entry.lots.push({ coins: g.coins, at: g.createdAt, expiresAt: g.expiresAt });
    else entry.spends.push({ coins: -g.coins, at: g.createdAt });
  }
  return byUser;
}

export function tcoinBalanceFrom(movements: TcoinMovements | undefined, now: Date = new Date()): TcoinBalance {
  if (!movements) return { balance: 0, pendingCashback: 0, totalEarned: 0, totalSpent: 0, totalExpired: 0, expiring: [] };
  const replay = replayTcoins(movements.lots, movements.spends, now);
  return {
    balance: replay.balance,
    pendingCashback: movements.pendingCashback,
    totalEarned: movements.lots.reduce((sum, lot) => sum + lot.coins, 0),
    totalSpent: movements.spends.reduce((sum, s) => sum + s.coins, 0),
    totalExpired: replay.expired,
    expiring: replay.lots,
  };
}

export async function getTcoinBalance(userId: number, q: Queryable = db): Promise<TcoinBalance> {
  const movements = await loadTcoinMovements(q, userId);
  return tcoinBalanceFrom(movements.get(userId));
}

/** Held until commit, so two checkouts started together cannot spend the same coins. */
export async function lockTcoins(trx: Transaction<DB>, userId: number): Promise<void> {
  await sql`SELECT pg_advisory_xact_lock(hashtext('tcoins'), ${userId}::int)`.execute(trx);
}

export type TcoinsOrderPlan = {
  tcoinsRedeemed: number;
  tcoinsCashback: number;
  /** When this order's cashback batch expires; null when it earns none. Store it on the order row. */
  tcoinsCashbackExpiresAt: Date | null;
  /** What the student pays in cash (PayU or wallet balance) once coins are taken off. */
  amountToPay: number;
};

/**
 * Works out the coins an order spends and earns. Call it inside the order's transaction, after the
 * user's pending orders are cancelled and before the order row is inserted. Store the two coin
 * numbers and the cashback expiry on the row and charge amountToPay.
 */
export async function planTcoinsForOrder(
  trx: Transaction<DB>,
  input: {
    userId: number;
    /** The order value before coupons, after the items' own sale prices. */
    orderValue: number;
    /** What would be charged without coins, after any coupon. */
    amountBeforeTcoins: number;
    useTcoins: boolean;
    hasCoupon: boolean;
  }
): Promise<TcoinsOrderPlan> {
  const config = await getTcoinsConfig(trx);
  let tcoinsRedeemed = 0;

  if (input.useTcoins) {
    if (!config.enabled) {
      throw new Error("Tcoins are not available right now.");
    }
    if (input.hasCoupon) {
      throw new Error(ONE_OFFER_MESSAGE);
    }
    await lockTcoins(trx, input.userId);
    // A new checkout supersedes any unpaid one still holding coins.
    await trx
      .updateTable("orders")
      .set({ status: "cancelled" })
      .where("userId", "=", input.userId)
      .where("status", "=", "pending")
      .where("tcoinsRedeemed", ">", 0)
      .execute();
    const { balance } = await getTcoinBalance(input.userId, trx);
    tcoinsRedeemed = tcoinsRedeemableFor(config, input.orderValue, balance);
  }

  const amountToPay = Math.max(0, Math.round((input.amountBeforeTcoins - tcoinsRupeeValue(tcoinsRedeemed)) * 100) / 100);
  const tcoinsCashback = tcoinsCashbackFor(config, amountToPay);
  return {
    tcoinsRedeemed,
    tcoinsCashback,
    tcoinsCashbackExpiresAt: tcoinsCashback > 0 ? tcoinsExpiryFrom(new Date(), config.expiryDays) : null,
    amountToPay,
  };
}