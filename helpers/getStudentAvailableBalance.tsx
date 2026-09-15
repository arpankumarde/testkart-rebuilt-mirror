import { db } from "./db";
import { Kysely, Transaction } from "kysely";
import { DB } from "./schema";
import { sql } from "kysely";

/**
 * Calculates a single student's available prize-money balance.
 * Formula: availableBalance = totalPrizeCredits - totalWithdrawn(completed|pending) - totalPurchaseDebits
 *
 * This mirrors the math in endpoints/student/wallet/balance_GET.ts and is
 * relied on by endpoints/student/wallet/purchase_POST.ts (wallet-balance
 * purchase gating), endpoints/student/withdrawal/request_POST.ts, and
 * endpoints/student/bank-details/add_POST.ts — kept here as a single source
 * of truth so these gates can't drift out of sync with each other.
 */
export async function getStudentAvailableBalance(
  studentId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<{ availableBalance: number }> {
  const queryBuilder = trx ?? db;

  const creditsResult = await queryBuilder
    .selectFrom("studentWalletTransactions")
    .where("studentId", "=", studentId)
    .where("transactionType", "in", ["prize_credit", "prize_lock_refund"])
    .select([sql<string>`sum(amount)`.as("totalAmount")])
    .executeTakeFirst();

  const totalCredits = Number(creditsResult?.totalAmount || 0);

  const withdrawalsResult = await queryBuilder
    .selectFrom("studentWithdrawals")
    .where("studentId", "=", studentId)
    .where("status", "in", ["completed", "pending"])
    .select([sql<string>`sum(amount)`.as("totalAmount")])
    .executeTakeFirst();

  const totalWithdrawn = Number(withdrawalsResult?.totalAmount || 0);

  const purchasesResult = await queryBuilder
    .selectFrom("studentWalletTransactions")
    .where("studentId", "=", studentId)
    .where("transactionType", "=", "purchase_debit")
    .select([sql<string>`sum(amount)`.as("totalAmount")])
    .executeTakeFirst();

  const totalPurchased = Number(purchasesResult?.totalAmount || 0);

  const availableBalance = Math.max(0, Math.round((totalCredits - totalWithdrawn - totalPurchased) * 100) / 100);

  return { availableBalance };
}

/**
 * Batch version of getStudentAvailableBalance for a list of student IDs —
 * used by admin listing pages so balances for a whole page of results can
 * be computed with 3 grouped queries total instead of per-row queries.
 * Returns a Map from studentId to their available balance (students with no
 * wallet activity at all simply won't have a Map entry; callers should
 * default missing entries to 0).
 */
export async function getStudentsAvailableBalances(
  studentIds: number[],
  trx?: Transaction<DB> | Kysely<DB>
): Promise<Map<number, number>> {
  const balanceMap = new Map<number, number>();
  if (studentIds.length === 0) return balanceMap;

  const queryBuilder = trx ?? db;

  const [creditsRows, withdrawalsRows, purchasesRows] = await Promise.all([
    queryBuilder
      .selectFrom("studentWalletTransactions")
      .where("studentId", "in", studentIds)
      .where("transactionType", "in", ["prize_credit", "prize_lock_refund"])
      .groupBy("studentId")
      .select(["studentId", sql<string>`sum(amount)`.as("totalAmount")])
      .execute(),
    queryBuilder
      .selectFrom("studentWithdrawals")
      .where("studentId", "in", studentIds)
      .where("status", "in", ["completed", "pending"])
      .groupBy("studentId")
      .select(["studentId", sql<string>`sum(amount)`.as("totalAmount")])
      .execute(),
    queryBuilder
      .selectFrom("studentWalletTransactions")
      .where("studentId", "in", studentIds)
      .where("transactionType", "=", "purchase_debit")
      .groupBy("studentId")
      .select(["studentId", sql<string>`sum(amount)`.as("totalAmount")])
      .execute(),
  ]);

  const creditsByStudent = new Map<number, number>(
    creditsRows.map((r) => [r.studentId, Number(r.totalAmount || 0)])
  );
  const withdrawnByStudent = new Map<number, number>(
    withdrawalsRows.map((r) => [r.studentId, Number(r.totalAmount || 0)])
  );
  const purchasedByStudent = new Map<number, number>(
    purchasesRows.map((r) => [r.studentId, Number(r.totalAmount || 0)])
  );

  for (const studentId of studentIds) {
    const totalCredits = creditsByStudent.get(studentId) ?? 0;
    const totalWithdrawn = withdrawnByStudent.get(studentId) ?? 0;
    const totalPurchased = purchasedByStudent.get(studentId) ?? 0;
    const availableBalance = Math.max(0, Math.round((totalCredits - totalWithdrawn - totalPurchased) * 100) / 100);
    balanceMap.set(studentId, availableBalance);
  }

  return balanceMap;
}
