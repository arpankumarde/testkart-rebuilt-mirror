import { sql, Kysely, Transaction } from "kysely";
import { db } from "./db";
import { DB } from "./schema";
import {
  TCOINS_SETTING_KEY,
  parseTcoinsConfig,
  tcoinsCashbackFor,
  tcoinsRedeemableFor,
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
 * There is no ledger table. Each order stores tcoins_redeemed and tcoins_cashback, and the balance is
 * derived from order status, so every completion, failure, cancel and refund path moves coins with no
 * extra code: cashback counts once its order is completed, and spent coins count while the order is
 * pending or completed, so a failed, cancelled or refunded order hands them back.
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
};

export async function getTcoinBalance(userId: number, q: Queryable = db): Promise<TcoinBalance> {
  const row = await q
    .selectFrom("orders")
    .where("userId", "=", userId)
    .where((eb) => eb.or([eb("tcoinsRedeemed", ">", 0), eb("tcoinsCashback", ">", 0)]))
    .select([
      sql<string>`coalesce(sum(case when status = 'completed' then tcoins_cashback else 0 end), 0)`.as("earned"),
      sql<string>`coalesce(sum(case when status in ('pending', 'completed') then tcoins_redeemed else 0 end), 0)`.as("spent"),
      sql<string>`coalesce(sum(case when status = 'pending' then tcoins_cashback else 0 end), 0)`.as("pending"),
    ])
    .executeTakeFirst();

  const totalEarned = Number(row?.earned ?? 0);
  const totalSpent = Number(row?.spent ?? 0);
  // A refund can take back cashback that was already spent, so the raw figure can dip below zero.
  return {
    balance: Math.max(0, totalEarned - totalSpent),
    pendingCashback: Number(row?.pending ?? 0),
    totalEarned,
    totalSpent,
  };
}

/** Held until commit, so two checkouts started together cannot spend the same coins. */
export async function lockTcoins(trx: Transaction<DB>, userId: number): Promise<void> {
  await sql`SELECT pg_advisory_xact_lock(hashtext('tcoins'), ${userId}::int)`.execute(trx);
}

export type TcoinsOrderPlan = {
  tcoinsRedeemed: number;
  tcoinsCashback: number;
  /** What the student pays in cash (PayU or wallet balance) once coins are taken off. */
  amountToPay: number;
};

/**
 * Works out the coins an order spends and earns. Call it inside the order's transaction, after the
 * user's pending orders are cancelled and before the order row is inserted. Store both coin numbers
 * on the row and charge amountToPay.
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
      throw new Error("Tcoins cannot be combined with a coupon. Remove the coupon to use Tcoins.");
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

  const amountToPay = Math.max(0, Math.round((input.amountBeforeTcoins - tcoinsRedeemed) * 100) / 100);
  return {
    tcoinsRedeemed,
    tcoinsCashback: tcoinsCashbackFor(config, amountToPay),
    amountToPay,
  };
}