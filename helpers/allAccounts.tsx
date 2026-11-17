import { sql, type Kysely, type Transaction } from "kysely";
import type { DB, UserRole } from "./schema";

type Executor = Kysely<DB> | Transaction<DB>;

/** Columns every student and teacher has, under the same names users used. */
export const SHARED_ACCOUNT_COLUMNS = [
  "id",
  "email",
  "displayName",
  "avatarUrl",
  "avatarFileId",
  "bio",
  "createdAt",
  "updatedAt",
  "isActive",
  "mobileNumber",
  "mobileVerified",
  "emailVerified",
  "slug",
  "signupSource",
  "onboardingCompleted",
  "billingDetails",
  "emailBouncedAt",
  "timezone",
  "suspensionKind",
  "suspendedUntil",
  "suspensionReason",
  "suspendedAt",
  "suspendedBy",
] as const;

/**
 * Every account, students and teachers, with the shared columns and its role - for reads that need an account but
 * not its side (testkart/misc/USER-SPLIT-SPEC.md, Phase 6). Use it as a table:
 *   db.selectFrom(allAccounts(db).as("account")) or .leftJoin(allAccounts(db).as("sender"), "sender.id", "x.senderId")
 * Same rows as the `accounts` view (which raw SQL uses); this keeps each column's real nullability for Kysely.
 * Postgres pushes id and role filters into both halves, so lookups by id use each table's primary key.
 * The executor is required so this file never imports helpers/db: helpers shared with pages import it too.
 */
export function allAccounts(executor: Executor) {
  return executor
    .selectFrom("students")
    .select([...SHARED_ACCOUNT_COLUMNS, sql<UserRole>`'student'::user_role`.as("role")])
    .unionAll(
      executor.selectFrom("teachers").select([...SHARED_ACCOUNT_COLUMNS, sql<UserRole>`'teacher'::user_role`.as("role")])
    );
}
