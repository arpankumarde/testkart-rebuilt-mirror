import { db } from "./db";
import { Kysely, Transaction } from "kysely";
import { DB } from "./schema";

/**
 * Checks if a teacher has an active subscription.
 * Can be used within a transaction by passing the transaction object.
 * @param teacherId The ID of the teacher.
 * @param trx Optional Kysely transaction object.
 * @returns A promise that resolves to true if the teacher has an active subscription, false otherwise.
 */
export async function hasActiveSubscription(
  teacherId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<boolean> {
  const queryBuilder = trx ?? db;
  const subscription = await queryBuilder
    .selectFrom("teacherSubscriptions")
    .select("id")
    .where("teacherId", "=", teacherId)
    .where("status", "=", "active")
    .where("endDate", ">", new Date())
    .executeTakeFirst();
  return !!subscription;
}