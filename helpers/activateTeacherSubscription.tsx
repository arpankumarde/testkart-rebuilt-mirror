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

/**
 * Applies a confirmed autopay renewal charge to the subscription it was taken
 * for. activateTeacherSubscription skips teachers who already have an active
 * plan, which is exactly the renewal case, so renewals extend the existing row
 * by one plan period instead, matching a charge captured in subscriptionRenew.
 */
export async function extendRenewedSubscription(
  subscriptionId: number,
  teacherId: number,
  trx: Transaction<DB>
) {
  const subscription = await trx
    .selectFrom("teacherSubscriptions")
    .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
    .select(["teacherSubscriptions.endDate", "subscriptionPlans.durationDays"])
    .where("teacherSubscriptions.id", "=", subscriptionId)
    .where("teacherSubscriptions.teacherId", "=", teacherId)
    .executeTakeFirst();

  if (!subscription) {
    console.warn(`[extendRenewedSubscription] Subscription ${subscriptionId} for teacher ${teacherId} not found.`);
    return;
  }

  const now = new Date();
  const newEndDate = subscription.endDate ? new Date(subscription.endDate) : new Date(now);
  newEndDate.setDate(newEndDate.getDate() + subscription.durationDays);

  await trx
    .updateTable("teacherSubscriptions")
    .set({
      endDate: newEndDate,
      lastChargeDate: now,
      nextChargeDate: newEndDate,
      preDebitSentAt: null,
    })
    .where("id", "=", subscriptionId)
    .execute();

  await trx
    .updateTable("users")
    .set({ isVerified: true })
    .where("id", "=", teacherId)
    .execute();
}