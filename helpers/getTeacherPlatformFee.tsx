import { db } from "./db";
import { Kysely, Transaction } from "kysely";
import { DB } from "./schema";

/**
 * Retrieves the current platform fee percentage for a teacher based on their active subscription.
 * Defaults to 30% if the teacher does not have an active subscription.
 *
 * @param teacherId The ID of the teacher
 * @param trx Optional database transaction or connection
 * @returns A promise resolving to the platform fee percentage as a number
 */
export async function getTeacherPlatformFee(
  teacherId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<number> {
  const queryBuilder = trx ?? db;

  const result = await queryBuilder
    .selectFrom("teacherSubscriptions")
    .innerJoin(
      "subscriptionPlans",
      "teacherSubscriptions.planId",
      "subscriptionPlans.id"
    )
    .select([
      "subscriptionPlans.platformFeePercentage",
      "teacherSubscriptions.platformFeeOverride"
    ])
    .where("teacherSubscriptions.teacherId", "=", teacherId)
    .where("teacherSubscriptions.status", "=", "active")
    .where("teacherSubscriptions.endDate", ">", new Date())
    .orderBy("teacherSubscriptions.createdAt", "desc")
    .limit(1)
    .executeTakeFirst();

  if (result) {
    if (
      result.platformFeeOverride !== undefined &&
      result.platformFeeOverride !== null
    ) {
      return Number(result.platformFeeOverride);
    }
    
    if (
      result.platformFeePercentage !== undefined &&
      result.platformFeePercentage !== null
    ) {
      return Number(result.platformFeePercentage);
    }
  }

  // Default free plan platform fee percentage
  return 30;
}