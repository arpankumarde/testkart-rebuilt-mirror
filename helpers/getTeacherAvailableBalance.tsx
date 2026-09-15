import { db } from "./db";
import { Kysely, Transaction } from "kysely";
import { DB } from "./schema";
import {
  buildTeacherNetEarningsSql,
  buildTeacherSalesCountSql,
  buildTeacherWithdrawalsSql,
  buildTeacherSponsoredDeductionsSql,
  buildTeacherPrizeDeductionsSql,
  buildTeacherSubscriptionWalletPaymentsSql,
} from "./teacherEarningsSql";

export type TeacherBalanceBreakdown = {
  totalEarned: number;
  totalWithdrawn: number;
  totalSponsored: number;
  totalPrizeDeductions: number;
  totalSubscriptionWalletPayments: number;
  availableBalance: number;
  breakdown: {
    sales: { count: number; amount: number };
    withdrawals: { count: number; amount: number };
    sponsored: { count: number; amount: number };
    prizes: { count: number; amount: number };
    subscriptionPayments: { count: number; amount: number };
  };
};

/**
 * Calculates the full balance breakdown for a teacher.
 * Formula: availableBalance = totalEarned - totalWithdrawn - totalSponsored - totalPrizeDeductions - totalSubscriptionWalletPayments
 *
 * All the underlying math lives in helpers/teacherEarningsSql.tsx — the same
 * builders back the teacher-facing earnings page and every admin dashboard
 * that shows earnings/balance, so they can't drift out of sync the way they
 * did historically. Don't re-derive this logic here; extend the shared file
 * instead.
 */
export async function getTeacherAvailableBalance(
  teacherId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<TeacherBalanceBreakdown> {
  const queryBuilder = trx ?? db;

  const [
    earningsResult,
    salesCountResult,
    withdrawalsResult,
    sponsoredResult,
    prizeDeductionsResult,
    subWalletResult,
  ] = await Promise.all([
    buildTeacherNetEarningsSql(teacherId).execute(queryBuilder),
    buildTeacherSalesCountSql(teacherId).execute(queryBuilder),
    buildTeacherWithdrawalsSql(teacherId, "completed").execute(queryBuilder),
    buildTeacherSponsoredDeductionsSql(teacherId).execute(queryBuilder),
    buildTeacherPrizeDeductionsSql(teacherId).execute(queryBuilder),
    buildTeacherSubscriptionWalletPaymentsSql(teacherId).execute(queryBuilder),
    // Withdrawal/sponsored/prize row counts are display-only (no financial
    // math depends on them), so they're fetched with small direct counts
    // below rather than added to the shared SQL builders.
  ]);

  const [withdrawalsCountResult, sponsoredCountResult, prizesCountResult, subWalletCountResult] =
    await Promise.all([
      queryBuilder
        .selectFrom("teacherWithdrawals")
        .where("teacherId", "=", teacherId)
        .where("status", "=", "completed")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .executeTakeFirst(),
      queryBuilder
        .selectFrom("teacherSponsoredEnrollments")
        .where("teacherId", "=", teacherId)
        .where("paymentMethod", "=", "balance_deduction")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .executeTakeFirst(),
      queryBuilder
        .selectFrom("liveTests")
        .where("teacherId", "=", teacherId)
        .where((eb) =>
          eb.or([
            eb("prizeDistributionStatus", "=", "distributed"),
            eb.and([
              eb("prizeFundSource", "=", "teacher_wallet"),
              eb("prizeDistributionStatus", "=", "pending"),
            ]),
          ])
        )
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .executeTakeFirst(),
      queryBuilder
        .selectFrom("subscriptionTransactions")
        .where("teacherId", "=", teacherId)
        .where("paymentMethod", "=", "wallet")
        .where("status", "=", "completed")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .executeTakeFirst(),
    ]);

  const totalEarned = Number(earningsResult.rows[0]?.total ?? 0);
  const salesCount = Number(salesCountResult.rows[0]?.total ?? 0);
  const totalWithdrawn = Number(withdrawalsResult.rows[0]?.total ?? 0);
  const totalSponsored = Number(sponsoredResult.rows[0]?.total ?? 0);
  const totalPrizeDeductions = Number(prizeDeductionsResult.rows[0]?.total ?? 0);
  const totalSubscriptionWalletPayments = Number(subWalletResult.rows[0]?.total ?? 0);

  const withdrawalsCount = Number(withdrawalsCountResult?.count ?? 0);
  const sponsoredCount = Number(sponsoredCountResult?.count ?? 0);
  const prizesCount = Number(prizesCountResult?.count ?? 0);
  const subWalletCount = Number(subWalletCountResult?.count ?? 0);

  // Round to 2 decimal places to avoid floating-point drift, clamp to 0 minimum
  const availableBalance = Math.max(
    0,
    Math.round(
      (totalEarned - totalWithdrawn - totalSponsored - totalPrizeDeductions - totalSubscriptionWalletPayments) * 100
    ) / 100
  );

  return {
    totalEarned,
    totalWithdrawn,
    totalSponsored,
    totalPrizeDeductions,
    totalSubscriptionWalletPayments,
    availableBalance,
    breakdown: {
      sales: { count: salesCount, amount: totalEarned },
      withdrawals: { count: withdrawalsCount, amount: totalWithdrawn },
      sponsored: { count: sponsoredCount, amount: totalSponsored },
      prizes: { count: prizesCount, amount: totalPrizeDeductions },
      subscriptionPayments: { count: subWalletCount, amount: totalSubscriptionWalletPayments },
    },
  };
}
