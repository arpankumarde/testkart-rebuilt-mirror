import { db } from "./db";
import { Transaction } from "kysely";
import { DB } from "./schema";

/**
 * Creates an active teacher subscription record for a given plan.
 * This is called when a subscription transaction is verified as successful.
 */
export async function activateTeacherSubscription(
  teacherId: number,
  planId: number,
  trx: Transaction<DB>
) {
  const plan = await trx
    .selectFrom("subscriptionPlans")
    .select(["id", "name", "price", "durationDays", "billingCycle"])
    .where("id", "=", planId)
    .executeTakeFirst();

  if (!plan) {
    throw new Error(`Subscription plan ${planId} not found.`);
  }

  // Check if the teacher already has any active subscription
  const existingSubscription = await trx
    .selectFrom("teacherSubscriptions")
    .select("id")
    .where("teacherId", "=", teacherId)
    .where("status", "=", "active")
    .executeTakeFirst();

  if (existingSubscription) {
    console.log(`[activateTeacherSubscription] Teacher ${teacherId} already has an active subscription. Skipping creation.`);
    return;
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationDays);

  await trx
    .insertInto("teacherSubscriptions")
    .values({
      teacherId,
      planId,
      status: "active",
      startDate,
      endDate,
    })
    .execute();

  // Mark the teacher as verified
  await trx
    .updateTable("users")
    .set({ isVerified: true })
    .where("id", "=", teacherId)
    .execute();
}