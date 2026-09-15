import { schema, OutputType } from "./distribute-prizes_POST.schema";
import { db } from "../../helpers/db";
import superjson from "superjson";
import { getTeacherPlatformFee } from "../../helpers/getTeacherPlatformFee";
import { sendTemplateEmail } from "../../helpers/sendTemplateEmail";
import { sql } from "kysely";
import {
  PrizeTier,
  getMaxPrizeRank,
  getPrizeForRank,
  getTotalPrizePool,
  resolveLiveTestPrizeTiers,
} from "../../helpers/liveTestPrizeTiers";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const result = await db.transaction().execute(async (trx) => {
      // 1 & 2. Verify live test exists and has prizes
      const liveTest = await trx
        .selectFrom("liveTests")
        .where("id", "=", input.liveTestId)
        .selectAll()
        .executeTakeFirst();

      if (!liveTest) {
        throw new Error("Live test not found");
      }

      if (!liveTest.hasPrizes) {
        return { success: true, message: "Live test has no prizes configured.", distributed: false };
      }

      // 3. Check if already distributed
      if (liveTest.prizeDistributionStatus === "distributed") {
        return { success: true, message: "Prizes already distributed.", distributed: false };
      }

      // 4. Check if ended
      if (new Date() < new Date(liveTest.endTime)) {
        throw new Error("Live test has not ended yet.");
      }

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

      if (maxPrizeRank <= 0) {
        // No funded tiers — nothing to pay out, mark as distributed.
        await trx
          .updateTable("liveTests")
          .set({
            prizeDistributionStatus: "distributed",
            actualTotalDistributed: "0",
            prizeFundSource: Number(liveTest.price) > 0 ? "enrollment" : "teacher_wallet",
          })
          .where("id", "=", liveTest.id)
          .execute();
        return { success: true, message: "No prize tiers configured. Marked as distributed.", distributed: true };
      }

      // 5. Get leaderboard from test_attempts
      const topAttempts = await trx
        .selectFrom("testAttempts")
        .innerJoin("mockTestItems", "testAttempts.testId", "mockTestItems.id")
        .innerJoin(
          "liveTestEnrollments",
          "testAttempts.studentId",
          "liveTestEnrollments.studentId"
        )
        .where("liveTestEnrollments.liveTestId", "=", liveTest.id)
        .where("mockTestItems.packageId", "=", liveTest.mockTestId)
        .where("testAttempts.completedAt", "is not", null)
        .select([
          "testAttempts.studentId",
          "testAttempts.score",
          "testAttempts.completedAt",
        ])
        .orderBy("testAttempts.score", "desc")
        .orderBy("testAttempts.completedAt", "asc")
        .limit(maxPrizeRank)
        .execute();

      if (topAttempts.length === 0) {
        // No one completed the test, mark as distributed with 0
        await trx
          .updateTable("liveTests")
          .set({
            prizeDistributionStatus: "distributed",
            actualTotalDistributed: "0",
            prizeFundSource: Number(liveTest.price) > 0 ? "enrollment" : "teacher_wallet",
          })
          .where("id", "=", liveTest.id)
          .execute();
        return { success: true, message: "No students completed the test. Marked as distributed.", distributed: true };
      }

      // 6. Determine prize fund source
      const isPaid = Number(liveTest.price) > 0;
      const prizeFundSource = isPaid ? "enrollment" : "teacher_wallet";

      const totalPrizePool = getTotalPrizePool(configuredTiers);

      let multiplier = 1;

      // 7 & 8. Calculate funds
      if (isPaid) {
        // Calculate revenue
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

      // 9 & 10. Award prizes
      let actualTotalDistributed = 0;

      for (let i = 0; i < topAttempts.length; i++) {
        const attempt = topAttempts[i];
        const rank = i + 1;
        const originalAmount = getPrizeForRank(configuredTiers, rank);

        if (!originalAmount || originalAmount <= 0) continue;

        const actualAmount = Number((originalAmount * multiplier).toFixed(2));

        if (actualAmount > 0) {
          const distResult = await trx
            .insertInto("liveTestPrizeDistributions")
            .values({
              liveTestId: liveTest.id,
              studentId: attempt.studentId,
              rank: rank,
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
              description: `Prize for Rank ${rank} in Live Test: ${liveTest.title}`,
            })
            .execute();

          actualTotalDistributed += actualAmount;
        }
      }

      // 11. Update live_tests
      await trx
        .updateTable("liveTests")
        .set({
          prizeDistributionStatus: "distributed",
          prizeFundSource: prizeFundSource,
          actualTotalDistributed: actualTotalDistributed.toString(),
        })
        .where("id", "=", liveTest.id)
        .execute();

      return { success: true, message: `Prizes successfully distributed. Total: ₹${actualTotalDistributed}`, distributed: true };
    });
 
    if (result.distributed) {
      try {
        // 1. Fetch live test details
        const liveTest = await db.selectFrom("liveTests").select(["id", "title"]).where("id", "=", input.liveTestId).executeTakeFirst();
        if (liveTest) {
         // 2. Send wallet_credit_received to each prize winner
         const distributions = await db.selectFrom("liveTestPrizeDistributions")
           .innerJoin("users", "liveTestPrizeDistributions.studentId", "users.id")
           .select(["users.email", "users.displayName", "liveTestPrizeDistributions.actualAmount", "liveTestPrizeDistributions.rank"])
           .where("liveTestPrizeDistributions.liveTestId", "=", input.liveTestId)
           .execute();
 
          await Promise.all(distributions.filter(d => d.email).map(dist => 
           sendTemplateEmail("wallet_credit_received", dist.email!, {
             displayName: dist.displayName,
             amount: Number(dist.actualAmount).toFixed(2),
             reason: `Rank ${dist.rank} prize in Live Test: ${liveTest.title}`,
           }).catch(err => console.error("Failed to send wallet credit email:", err))
          ));
 
         // 3. Send live_test_results to ALL enrolled students
         const enrolledStudents = await db.selectFrom("liveTestEnrollments")
           .innerJoin("users", "liveTestEnrollments.studentId", "users.id")
           .select(["users.email", "users.displayName"])
           .where("liveTestEnrollments.liveTestId", "=", input.liveTestId)
           .execute();
 
          await Promise.all(enrolledStudents.filter(s => s.email).map(student =>
           sendTemplateEmail("live_test_results", student.email!, {
             studentName: student.displayName,
             testName: liveTest.title,
             liveTestId: String(input.liveTestId),
           }).catch(err => console.error("Failed to send live test results email:", err))
          ));
        }
      } catch (err) {
        console.error("Failed to send prize distribution notifications:", err);
      }
    }

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    console.error("Error distributing prizes:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400 }
    );
  }
}