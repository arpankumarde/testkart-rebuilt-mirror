import { Kysely, Transaction } from "kysely";
import { db } from "./db";
import { DB } from "./schema";

// Teacher subscription plans stopped selling on 13-10-2026. A teacher whose paid
// plan is still active can renew that same plan (including restarting autopay);
// nobody can buy a new or different plan.
export const PLAN_PURCHASES_CLOSED_MESSAGE =
  "Subscription plans are no longer available. Your platform fee is applied to each sale automatically.";

export async function getRenewablePlanId(
  teacherId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<number | null> {
  const row = await (trx ?? db)
    .selectFrom("teacherSubscriptions")
    .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
    .select("teacherSubscriptions.planId")
    .where("teacherSubscriptions.teacherId", "=", teacherId)
    .where("teacherSubscriptions.status", "=", "active")
    .where("teacherSubscriptions.endDate", ">", new Date())
    .where("subscriptionPlans.price", ">", "0")
    .orderBy("teacherSubscriptions.endDate", "desc")
    .limit(1)
    .executeTakeFirst();
  return row?.planId ?? null;
}

export async function assertPlanRenewable(
  teacherId: number,
  planId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<void> {
  const renewablePlanId = await getRenewablePlanId(teacherId, trx);
  if (renewablePlanId !== planId) {
    throw new Error(PLAN_PURCHASES_CLOSED_MESSAGE);
  }
}