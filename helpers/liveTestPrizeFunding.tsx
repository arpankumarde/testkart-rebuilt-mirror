import { Transaction } from "kysely";
import { DB } from "./schema";
import { getTeacherAvailableBalance } from "./getTeacherAvailableBalance";
import { lockWallet } from "./walletLock";

type LiveTestFundingFields = {
  id: number;
  teacherId: number;
  hasPrizes: boolean;
  price: string;
  totalPrizePool: string;
  prizeFundSource: string | null;
  prizeDistributionStatus: string | null;
};

/**
 * Throws when the teacher's balance can't cover the prize pool of a free live
 * test, which distribute-prizes pays from the teacher's wallet. Uses the
 * unclamped balance (pending withdrawals included) under the wallet lock. The
 * pool of a free test with prizes is already deducted while it is pending, so
 * it is only added on top when it isn't recorded that way yet.
 */
export async function assertTeacherCanFundPrizePool(
  trx: Transaction<DB>,
  liveTest: LiveTestFundingFields
): Promise<void> {
  if (!liveTest.hasPrizes || Number(liveTest.price) > 0) return;

  const totalPrizePool = Number(liveTest.totalPrizePool);
  if (!(totalPrizePool > 0)) return;

  await lockWallet(trx, liveTest.teacherId);
  const { rawBalance } = await getTeacherAvailableBalance(liveTest.teacherId, trx);

  const poolAlreadyDeducted =
    liveTest.prizeFundSource === "teacher_wallet" && liveTest.prizeDistributionStatus === "pending";
  const remaining = rawBalance - (poolAlreadyDeducted ? 0 : totalPrizePool);

  if (remaining < 0) {
    const balanceBeforePool = Math.max(0, remaining + totalPrizePool);
    throw new Error(
      `Insufficient balance to fund prize pool. Your available balance is ₹${balanceBeforePool.toFixed(2)} but the prize pool requires ₹${totalPrizePool.toFixed(2)}. Please add funds through test sales first.`
    );
  }
}
