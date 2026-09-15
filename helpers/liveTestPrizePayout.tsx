import { db } from "./db";
import { getTeacherPlatformFee } from "./getTeacherPlatformFee";
import { sendTemplateEmail } from "./sendTemplateEmail";
import { sql } from "kysely";
import {
  PrizeTier,
  getMaxPrizeRank,
  getPrizeForRank,
  getTotalPrizePool,
  resolveLiveTestPrizeTiers,
} from "./liveTestPrizeTiers";
import { getRankedLiveTestAttempts } from "./liveTestRanking";
import { LIVE_TEST_SUBMIT_GRACE_MS, liveTestResultsReleased } from "./liveTestAttemptWindow";

export type PrizeDistributionResult = {
  success: boolean;
  message: string;
  distributed: boolean;
};

const MAX_LIVE_TESTS_PER_RUN = 20;

// Tests that ended longer ago than this are settled quietly: winners still get
// their wallet credit email, but the results email to every enrolled student
// is skipped.
const RESULTS_EMAIL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Pays a live test's prizes into the winners' wallets once submissions have
 * closed. The live test row is locked for the whole transaction and its status
 * re-read under that lock, so concurrent calls pay out once; the unique
 * (live_test_id, rank) index on live_test_prize_distributions backs this up.
 */
export async function distributeLiveTestPrizes(liveTestId: number): Promise<PrizeDistributionResult> {
  const outcome = await db.transaction().execute(async (trx) => {
    const liveTest = await trx
      .selectFrom("liveTests")
      .where("id", "=", liveTestId)
      .selectAll()
      .forUpdate()
      .executeTakeFirst();

    if (!liveTest) {
      throw new Error("Live test not found");
    }

    const settle = (result: PrizeDistributionResult, notify = false) => ({
      result,
      notify,
      title: liveTest.title,
      endTime: new Date(liveTest.endTime),
    });

    if (!liveTest.hasPrizes) {
      return settle({ success: true, message: "Live test has no prizes configured.", distributed: false });
    }

    if (liveTest.prizeDistributionStatus === "distributed") {
      return settle({ success: true, message: "Prizes already distributed.", distributed: false });
    }

    if (!liveTestResultsReleased(liveTest)) {
      throw new Error("Live test submissions are still open.");
    }

    const isPaid = Number(liveTest.price) > 0;
    const prizeFundSource = isPaid ? "enrollment" : "teacher_wallet";

    // Configured prize tiers (arbitrary rank ranges). Accepts tiers stored as an
    // array or as a JSON string, and falls back to the legacy 1st/2nd/3rd columns
    // for live tests created before flexible tiers existed.
    const configuredTiers: PrizeTier[] = resolveLiveTestPrizeTiers(
      liveTest.prizeTiers,
      liveTest.firstPrize,
      liveTest.secondPrize,
      liveTest.thirdPrize
    );
    const maxPrizeRank = getMaxPrizeRank(configuredTiers);

    const markDistributed = (total: number) =>
      trx
        .updateTable("liveTests")
        .set({
          prizeDistributionStatus: "distributed",
          actualTotalDistributed: total.toString(),
          prizeFundSource,
        })
        .where("id", "=", liveTest.id)
        .execute();

    if (maxPrizeRank <= 0) {
      await markDistributed(0);
      return settle({ success: true, message: "No prize tiers configured. Marked as distributed.", distributed: true });
    }

    // Same ranking the leaderboard shows: one in-window attempt per enrolled student
    const topAttempts = (await getRankedLiveTestAttempts(trx, liveTest)).slice(0, maxPrizeRank);

    if (topAttempts.length === 0) {
      await markDistributed(0);
      return settle({ success: true, message: "No students completed the test. Marked as distributed.", distributed: true });
    }

    const totalPrizePool = getTotalPrizePool(configuredTiers);
    let multiplier = 1;

    // A paid test's prizes are capped by the enrollment revenue after the platform fee
    if (isPaid) {
      const revenueResult = await trx
        .selectFrom("orderItems")
        .innerJoin("liveTestEnrollments", "orderItems.orderId", "liveTestEnrollments.paymentOrderId")
        .innerJoin("orders", "orderItems.orderId", "orders.id")
        .where("liveTestEnrollments.liveTestId", "=", liveTest.id)
        .where("orders.status", "=", "completed")
        .select([
          sql<number>`sum(order_items.price_at_purchase - order_items.discount_amount)`.as("totalRevenue"),
        ])
        .executeTakeFirst();

      const totalRevenue = Number(revenueResult?.totalRevenue || 0);
      const platformFee = await getTeacherPlatformFee(liveTest.teacherId, trx);
      const netAfterFee = totalRevenue * (1 - platformFee / 100);

      if (netAfterFee < totalPrizePool && totalPrizePool > 0) {
        multiplier = netAfterFee / totalPrizePool;
      }
    }

    let actualTotalDistributed = 0;

    for (const attempt of topAttempts) {
      const originalAmount = getPrizeForRank(configuredTiers, attempt.rank);
      if (!originalAmount || originalAmount <= 0) continue;

      const actualAmount = Number((originalAmount * multiplier).toFixed(2));
      if (actualAmount <= 0) continue;

      const distResult = await trx
        .insertInto("liveTestPrizeDistributions")
        .values({
          liveTestId: liveTest.id,
          studentId: attempt.studentId,
          rank: attempt.rank,
          originalAmount: originalAmount.toString(),
          actualAmount: actualAmount.toString(),
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("studentWalletTransactions")
        .values({
          studentId: attempt.studentId,
          amount: actualAmount.toString(),
          transactionType: "prize_credit",
          referenceId: distResult.id,
          description: `Prize for Rank ${attempt.rank} in Live Test: ${liveTest.title}`,
        })
        .execute();

      actualTotalDistributed += actualAmount;
    }

    await markDistributed(actualTotalDistributed);

    return settle(
      { success: true, message: `Prizes successfully distributed. Total: ₹${actualTotalDistributed}`, distributed: true },
      true
    );
  });

  if (outcome.notify) {
    try {
      const distributions = await db
        .selectFrom("liveTestPrizeDistributions")
        .innerJoin("users", "liveTestPrizeDistributions.studentId", "users.id")
        .select(["users.email", "users.displayName", "liveTestPrizeDistributions.actualAmount", "liveTestPrizeDistributions.rank"])
        .where("liveTestPrizeDistributions.liveTestId", "=", liveTestId)
        .execute();

      await Promise.all(
        distributions
          .filter((d) => d.email)
          .map((dist) =>
            sendTemplateEmail("wallet_credit_received", dist.email!, {
              displayName: dist.displayName,
              amount: Number(dist.actualAmount).toFixed(2),
              reason: `Rank ${dist.rank} prize in Live Test: ${outcome.title}`,
            }).catch((err) => console.error("Failed to send wallet credit email:", err))
          )
      );

      if (Date.now() - outcome.endTime.getTime() <= RESULTS_EMAIL_MAX_AGE_MS) {
        const enrolledStudents = await db
          .selectFrom("liveTestEnrollments")
          .innerJoin("users", "liveTestEnrollments.studentId", "users.id")
          .select(["users.email", "users.displayName"])
          .where("liveTestEnrollments.liveTestId", "=", liveTestId)
          .execute();

        await Promise.all(
          enrolledStudents
            .filter((s) => s.email)
            .map((student) =>
              sendTemplateEmail("live_test_results", student.email!, {
                studentName: student.displayName,
                testName: outcome.title,
                liveTestId: String(liveTestId),
              }).catch((err) => console.error("Failed to send live test results email:", err))
            )
        );
      }
    } catch (err) {
      console.error("Failed to send prize distribution notifications:", err);
    }
  }

  return outcome.result;
}

/**
 * Scheduled job (static/__dev/scheduled-jobs.json): pays out every live test
 * with prizes whose submissions have closed. This replaced payouts triggered
 * from the leaderboard page.
 */
export async function liveTestPrizePayout(): Promise<void> {
  const closedBefore = new Date(Date.now() - LIVE_TEST_SUBMIT_GRACE_MS);

  const due = await db
    .selectFrom("liveTests")
    .select("id")
    .where("hasPrizes", "=", true)
    .where("prizeDistributionStatus", "=", "pending")
    .where("endTime", "<", closedBefore)
    .orderBy("endTime", "asc")
    .limit(MAX_LIVE_TESTS_PER_RUN)
    .execute();

  console.log(`[liveTestPrizePayout] ${due.length} live test(s) due for payout`);

  for (const { id } of due) {
    try {
      const result = await distributeLiveTestPrizes(id);
      console.log(`[liveTestPrizePayout] Live test ${id}: ${result.message}`);
    } catch (error) {
      console.error(`[liveTestPrizePayout] Live test ${id} failed:`, error);
    }
  }
}
