import { Kysely, Transaction } from "kysely";
import { db } from "./db";
import { DB } from "./schema";

export type PlanBaseName = "Free" | "Starter" | "Individual" | "Business";

/**
 * Maps a subscription_plans.name value (e.g. "Starter Plan", billed monthly
 * or yearly) to its base tier name.
 */
export function getPlanBaseName(planName: string): PlanBaseName {
  const lower = planName.toLowerCase();
  if (lower.includes("business")) return "Business";
  if (lower.includes("individual")) return "Individual";
  if (lower.includes("starter")) return "Starter";
  return "Free";
}

/**
 * The base tier of the teacher's active, unexpired plan, or "Free" when there is none.
 * Pass the owner's id (effectiveTeacherId) so team managers inherit the owner's plan.
 */
export async function getTeacherPlanBaseName(
  teacherId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<PlanBaseName> {
  const queryBuilder = trx ?? db;
  const result = await queryBuilder
    .selectFrom("teacherSubscriptions")
    .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
    .select("subscriptionPlans.name")
    .where("teacherSubscriptions.teacherId", "=", teacherId)
    .where("teacherSubscriptions.status", "=", "active")
    .where("teacherSubscriptions.endDate", ">", new Date())
    .orderBy("teacherSubscriptions.createdAt", "desc")
    .limit(1)
    .executeTakeFirst();
  return getPlanBaseName(result?.name ?? "Free Plan");
}

const SPONSORSHIP_TIERS: PlanBaseName[] = ["Starter", "Individual", "Business"];

export const SPONSORSHIP_PLAN_REQUIRED_MESSAGE =
  "Sponsoring and directly enrolling students is available on the Starter plan and above. Upgrade your plan to use it.";

export type SponsorshipAccess = { allowed: boolean; planBaseName: PlanBaseName };

/** Student sponsorship / direct enrollment needs Starter or higher; Free teachers are blocked. */
export async function getSponsorshipAccess(
  teacherId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<SponsorshipAccess> {
  const planBaseName = await getTeacherPlanBaseName(teacherId, trx);
  return { allowed: SPONSORSHIP_TIERS.includes(planBaseName), planBaseName };
}
