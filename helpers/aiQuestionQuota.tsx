import { Kysely, Transaction, sql } from "kysely";
import { db } from "./db";
import { DB } from "./schema";
import { getTeacherPlanBaseName } from "./teacherPlanAccess";

/**
 * Daily cap on AI-generated questions, per plan. null = unlimited.
 * Keyed by the plan's base name (getPlanBaseName in teacherPlanAccess).
 */
const DAILY_QUESTION_LIMITS: Record<string, number | null> = {
  Free: 50,
  Starter: 300,
  Individual: 1000,
  Business: null,
};

export { getPlanBaseName } from "./teacherPlanAccess";

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
