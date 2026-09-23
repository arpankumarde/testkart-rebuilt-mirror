import { Transaction } from "kysely";
import { DB } from "./schema";

/**
 * Applies a confirmed autopay renewal charge to the subscription it was taken
 * for: extends the existing row by one plan period, matching a charge captured
 * in subscriptionRenew. New paid plans go through activatePaidSubscription.
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
