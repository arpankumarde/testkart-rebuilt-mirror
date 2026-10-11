import { Kysely, Transaction, sql } from "kysely";
import { db } from "./db";
import { DB } from "./schema";

/**
 * Daily cap on AI-generated questions, per plan. null = unlimited.
 * Keyed by the plan's base name (see getPlanBaseName below).
 */
const DAILY_QUESTION_LIMITS: Record<string, number | null> = {
  Free: 50,
  Starter: 300,
  Individual: 1000,
  Business: null,
};

/**
 * Maps a subscription_plans.name value (e.g. "Starter Plan", billed monthly
 * or yearly) to the base tier name used as the key into DAILY_QUESTION_LIMITS.
 */
export function getPlanBaseName(planName: string): string {
  const lower = planName.toLowerCase();
  if (lower.includes("business")) return "Business";
  if (lower.includes("individual")) return "Individual";
  if (lower.includes("starter")) return "Starter";
  return "Free";
}

/**
 * The teacher's current active plan name, or "Free" if they have no active
 * subscription row at all (shouldn't normally happen - every teacher gets a
 * Free plan row - but this is the safe fallback).
 */
async function getTeacherPlanBaseName(
  teacherId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<string> {
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

/**
 * Sum of numberOfQuestions across this teacher's completed AI question
 * generations today (UTC calendar day). Only "done" attempts count - a
 * failed or still-pending call never consumed quota.
 */
async function getQuestionsGeneratedToday(
  teacherId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<number> {
  const queryBuilder = trx ?? db;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const result = await queryBuilder
    .selectFrom("aiGenerationLogs")
    .select(
      sql<string>`COALESCE(SUM((request_meta->>'numberOfQuestions')::int), 0)`.as("total")
    )
    .where("teacherId", "=", teacherId)
    .where("feature", "=", "question_generation")
    .where("status", "=", "done")
    .where("createdAt", ">=", startOfDay)
    .executeTakeFirst();

  return Number(result?.total ?? 0);
}

export type AiQuestionQuotaCheck = {
  allowed: boolean;
  limit: number | null; // null = unlimited
  usedToday: number;
  remainingToday: number | null; // null = unlimited
  planBaseName: string;
};

/**
 * Checks whether a teacher can generate `requestedCount` more AI questions
 * today under their plan's daily cap. Call this BEFORE paying for the AI API
 * call, so a request that would exceed the cap never reaches the provider.
 */
export async function checkAiQuestionQuota(
  teacherId: number,
  requestedCount: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<AiQuestionQuotaCheck> {
  const planBaseName = await getTeacherPlanBaseName(teacherId, trx);
  const limit = DAILY_QUESTION_LIMITS[planBaseName] ?? null;

  if (limit === null) {
    return { allowed: true, limit: null, usedToday: 0, remainingToday: null, planBaseName };
  }

  const usedToday = await getQuestionsGeneratedToday(teacherId, trx);
  const remainingToday = Math.max(0, limit - usedToday);

  return {
    allowed: usedToday + requestedCount <= limit,
    limit,
    usedToday,
    remainingToday,
    planBaseName,
  };
}
