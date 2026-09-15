import { db } from "./db";
import { Kysely, Transaction, sql } from "kysely";
import { DB } from "./schema";
import { getTeacherPlatformFee } from "./getTeacherPlatformFee";
import {
  PrizeTier,
  getTotalPrizePool,
  resolveLiveTestPrizeTiers,
  scalePrizeTiers,
} from "./liveTestPrizeTiers";

export async function calcLiveTestPrizeAmounts(
  liveTestId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<{
  tiers: PrizeTier[];
  totalPrizePool: number;
  multiplier: number;
  netAfterFee: number;
  totalRevenue: number;
}> {
  const queryBuilder = trx ?? db;

  const liveTest = await queryBuilder
    .selectFrom("liveTests")
    .where("id", "=", liveTestId)
    .select([
      "hasPrizes",
      "price",
      "firstPrize",
      "secondPrize",
      "thirdPrize",
      "prizeTiers",
      "teacherId",
    ])
    .executeTakeFirst();

  if (!liveTest) {
    throw new Error("Live test not found");
  }

  const configuredTiers = resolveLiveTestPrizeTiers(
    liveTest.prizeTiers,
    liveTest.firstPrize,
    liveTest.secondPrize,
    liveTest.thirdPrize
  );
  const configuredTotalPrizePool = getTotalPrizePool(configuredTiers);

  if (!liveTest.hasPrizes) {
    return {
      tiers: [],
      totalPrizePool: 0,
      multiplier: 0,
      netAfterFee: 0,
      totalRevenue: 0,
    };
  }

  const isPaid = Number(liveTest.price) > 0;
  let multiplier = 1;
  let totalRevenue = 0;
  let netAfterFee = 0;

  if (isPaid) {
    // Calculate total revenue from completed orders linked to this live test's enrollments
    const revenueResult = await queryBuilder
      .selectFrom("orderItems")
      .innerJoin(
        "liveTestEnrollments",
        "orderItems.orderId",
        "liveTestEnrollments.paymentOrderId"
      )
      .innerJoin("orders", "orderItems.orderId", "orders.id")
      .where("liveTestEnrollments.liveTestId", "=", liveTestId)
      .where("orders.status", "=", "completed")
      .select([
        sql<number>`sum(order_items.price_at_purchase - order_items.discount_amount)`.as(
          "totalRevenue"
        ),
      ])
      .executeTakeFirst();

    totalRevenue = Number(revenueResult?.totalRevenue || 0);
    
    // Calculate platform fee deduction
    const platformFee = await getTeacherPlatformFee(
      liveTest.teacherId,
      queryBuilder
    );
    netAfterFee = totalRevenue * (1 - platformFee / 100);

    // If net revenue is less than configured prize pool, calculate scale down multiplier
    if (netAfterFee < configuredTotalPrizePool && configuredTotalPrizePool > 0) {
      multiplier = netAfterFee / configuredTotalPrizePool;
    }
  }

  const scaledTiers = scalePrizeTiers(configuredTiers, multiplier);

  return {
    tiers: scaledTiers,
    totalPrizePool: Number((configuredTotalPrizePool * multiplier).toFixed(2)),
    multiplier,
    netAfterFee: Number(netAfterFee.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
  };
}
